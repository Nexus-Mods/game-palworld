/* eslint-disable */

import path from 'path';
import { actions, fs, log, selectors, types, util } from 'vortex-api';

import axios from 'axios';

import { setRequirementsUpdateChecked } from './actions';
import { GAME_ID, NOTIF_ID_REQUIREMENTS, NOTIF_ID_REQUIREMENTS_DUPLICATES,
  NOTIF_ID_UE4SS_UPDATE, PLUGIN_REQUIREMENTS } from './common';
import { isAutoManageEnabled, lastRequirementsUpdateCheck } from './selectors';
import { IPluginRequirement, IGitHubAsset, IGitHubRelease } from './types';
import { findRequirementDownload, findRequirementMods, isModEnabled, pickRequirementMod } from './util';

const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const GITHUB_TIMEOUT_MS = 30000;

// Installs missing requirements, and only missing ones. A requirement the user
//  disabled or removed is never touched again; one satisfied outside Vortex
//  (see isSatisfiedExternally) is left to the user.
export async function ensureRequirements(api: types.IExtensionApi): Promise<void> {
  if (!isAutoManageEnabled(api.getState())) {
    return;
  }

  for (const req of PLUGIN_REQUIREMENTS) {
    try {
      const candidates = await findRequirementMods(api, req);
      if (candidates.length > 1) {
        api.sendNotification({
          id: NOTIF_ID_REQUIREMENTS_DUPLICATES,
          type: 'warning',
          allowSuppress: true,
          message: `Multiple copies of "${req.userFacingName}" installed - remove the extras`,
        });
      }
      const mod = pickRequirementMod(api, candidates);
      if (mod !== undefined) {
        if (req.notifyUpdates && isModEnabled(api, mod.id)) {
          // Deliberately not awaited: a notification must never hold up activation.
          maybeNotifyUpdate(api, req, mod)
            .catch(err => log('warn', 'update check failed', { requirement: req.userFacingName, error: err.message }));
        }
        continue;
      }
      if (await req.isSatisfiedExternally?.(api) === true) {
        continue;
      }
      await installRequirement(api, req);
    } catch (err) {
      log('warn', 'failed to ensure requirement', { requirement: req.userFacingName, error: err.message });
    }
  }
}

async function installRequirement(api: types.IExtensionApi, req: IPluginRequirement): Promise<void> {
  api.sendNotification({
    id: NOTIF_ID_REQUIREMENTS,
    message: 'Installing Palworld Requirements',
    type: 'activity',
    noDismiss: true,
  });
  try {
    // Prefer an archive we already have over hitting GitHub.
    const dlId = findRequirementDownload(api, req);
    if (dlId) {
      await installDownload(api, dlId, req);
      return;
    }
    await downloadAndInstall(api, req);
  } catch (err) {
    api.showErrorNotification('Failed to download requirements', err, { allowReport: false });
  } finally {
    api.dismissNotification(NOTIF_ID_REQUIREMENTS);
  }
}

async function downloadAndInstall(api: types.IExtensionApi, req: IPluginRequirement): Promise<string> {
  const asset = await getLatestGithubReleaseAsset(req);
  if (!asset?.browser_download_url) {
    throw new util.NotFound(`download for ${req.userFacingName}`);
  }
  const tempPath = path.join(util.getVortexPath('temp'), asset.name);
  await doDownload(asset.browser_download_url, tempPath);
  return importAndInstall(api, req, tempPath, asset);
}

function githubPageUrl(req: IPluginRequirement): string {
  return req.githubUrl?.replace('api.github.com/repos', 'github.com');
}

// Stamps the installed mod's identity. Written once, at install time, so the name,
//  release link and freshness marker stay what the user installed.
async function installDownload(api: types.IExtensionApi, dlId: string, req: IPluginRequirement, asset?: IGitHubAsset): Promise<string> {
  const modId = await util.toPromise<string>(cb =>
    api.events.emit('start-install-download', dlId, true, cb));
  const profileId = selectors.lastActiveProfileForGame(api.getState(), GAME_ID);
  util.batchDispatch(api.store, [
    actions.setModAttributes(GAME_ID, modId, {
      installTime: new Date(),
      customFileName: req.userFacingName,
      palworldRequirement: req.attributeId,
      source: 'website',
      url: asset?.release?.html_url ?? githubPageUrl(req),
      description: 'Palworld modding requirement, installed automatically. '
        + 'Vortex leaves it alone if you disable or remove it; automatic management '
        + 'can be toggled under Settings > Mods.',
      ...(asset?.updated_at !== undefined ? { palworldRequirementBuildTime: asset.updated_at } : {}),
    }),
    actions.setModEnabled(profileId, modId, true),
  ]);
  return modId;
}

async function importAndInstall(api: types.IExtensionApi, req: IPluginRequirement, filePath: string, asset?: IGitHubAsset): Promise<string> {
  // import-downloads reports the imported ids as its only callback argument, so this
  //  can't go through util.toPromise (which expects an error first).
  const dlIds = await new Promise<string[]>(resolve =>
    api.events.emit('import-downloads', [filePath], (ids: string[]) => resolve(ids)));
  const dlId = dlIds?.[0];
  if (dlId === undefined) {
    throw new util.NotFound(filePath);
  }
  api.store.dispatch(actions.setDownloadModInfo(dlId, 'source', 'other'));
  return installDownload(api, dlId, req, asset);
}

// The Okaetsu release tag is rolling, so freshness is the asset's updated_at compared
//  against the value stamped at install time.
async function maybeNotifyUpdate(api: types.IExtensionApi, req: IPluginRequirement, mod: types.IMod): Promise<void> {
  if (Date.now() - lastRequirementsUpdateCheck(api.getState()) < UPDATE_CHECK_INTERVAL_MS) {
    return;
  }
  api.store.dispatch(setRequirementsUpdateChecked(Date.now()));

  const installedTime = Date.parse(mod.attributes?.['palworldRequirementBuildTime']);
  if (Number.isNaN(installedTime)) {
    // Installed from a local archive or by an older version, so there's no baseline.
    return;
  }
  const asset = await getLatestGithubReleaseAsset(req);
  const latestTime = Date.parse(asset?.updated_at);
  if (Number.isNaN(latestTime) || latestTime <= installedTime) {
    return;
  }
  api.sendNotification({
    id: NOTIF_ID_UE4SS_UPDATE,
    type: 'info',
    allowSuppress: true,
    message: `${req.userFacingName} update available`,
    actions: [
      {
        title: 'Update',
        action: (dismiss) => {
          dismiss();
          updateRequirement(api, req, mod)
            .catch(err => api.showErrorNotification('Failed to update requirement', err, { allowReport: false }));
        },
      },
    ],
  });
}

async function updateRequirement(api: types.IExtensionApi, req: IPluginRequirement, oldMod: types.IMod): Promise<void> {
  const modId = await downloadAndInstall(api, req);
  if (modId === oldMod.id) {
    // Vortex replaced the mod in place, so there's no previous build left to retire.
    return;
  }
  // Retire the previous build but leave removing it to the user.
  const profileId = selectors.lastActiveProfileForGame(api.getState(), GAME_ID);
  api.store.dispatch(actions.setModEnabled(profileId, oldMod.id, false));
}

// Returns null on any failure (offline, rate limit, no matching asset); callers decide
//  whether that's worth telling the user about.
export async function getLatestGithubReleaseAsset(requirement: IPluginRequirement): Promise<IGitHubAsset | null> {
  const wantedName = requirement.archiveFileName.toLowerCase();
  const chooseAsset = (release: IGitHubRelease): IGitHubAsset | undefined => {
    const assets = release.assets ?? [];
    const asset = assets.find(iter => iter.name.toLowerCase() === wantedName)
      ?? (requirement.fileArchivePattern !== undefined
        ? assets.find(iter => requirement.fileArchivePattern.test(iter.name))
        : undefined);
    return asset !== undefined ? { ...asset, release } : undefined;
  }
  try {
    const response = await axios.get(`${requirement.githubUrl}/releases`, { timeout: GITHUB_TIMEOUT_MS });
    assertNotRateLimited(response);
    if (response.status === 200) {
      for (const release of response.data as IGitHubRelease[]) {
        const asset = chooseAsset(release);
        if (asset !== undefined) {
          return asset;
        }
      }
    }
  } catch (error) {
    log('warn', 'failed to fetch latest release', { repo: requirement.githubUrl, error: error.message });
  }

  return null;
}

function assertNotRateLimited(response: { status?: number, headers?: any }): void {
  const callsRemaining = parseInt(response.headers?.['x-ratelimit-remaining'] ?? '0', 10);
  if ([403, 404].includes(response?.status) && (callsRemaining === 0)) {
    const resetDate = parseInt(response.headers?.['x-ratelimit-reset'] ?? '0', 10);
    log('info', 'GitHub rate limit exceeded', { reset_at: (new Date(resetDate)).toString() });
    throw new util.ProcessCanceled('GitHub rate limit exceeded');
  }
}

export async function doDownload(downloadUrl: string, destination: string): Promise<void> {
  const response = await axios({
    method: 'get',
    url: downloadUrl,
    responseType: 'arraybuffer',
    headers: {
      "Accept-Encoding": "gzip, deflate",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36"
    },
  });
  assertNotRateLimited(response);
  await fs.writeFileAsync(destination, Buffer.from(response.data));
}
