/* eslint-disable */
import path from 'path';
import semver from 'semver';
import { fs, types, selectors, util } from 'vortex-api';

import { GAME_ID, MODS_FILE_BACKUP, NAMESPACE, NOTIF_ID_BP_MODLOADER_DISABLED,
  PLUGIN_REQUIREMENTS, UE4SS_ENABLED_FILE, UE4SS_SETTINGS_FILE,
  UE4SS_MEMBER_VARIABLE_LAYOUT_FILE } from './common';
import { EventType } from './types';
import { findModByFile, resolveUE4SSPath } from './util';
import { download, getLatestGithubReleaseAsset } from './downloader';

export async function testMemberVariableLayout(api: types.IExtensionApi, eventType: EventType) {
  const t = api.translate;
  const state = api.getState();
  if (selectors.activeGameId(state) !== GAME_ID) {
    return;
  }

  let ue4ssMod = await findModByFile(api, '', UE4SS_SETTINGS_FILE);
  if (ue4ssMod === undefined) {
    return;
  }
  const stagingFolder = selectors.installPathForGame(state, GAME_ID);
  const modPath = path.join(stagingFolder, ue4ssMod.installationPath);
  const ue4ssRelPath = resolveUE4SSPath(api);
  const ue4ssVariableLayout = path.join(modPath, ue4ssRelPath, UE4SS_MEMBER_VARIABLE_LAYOUT_FILE);
  const variableLayoutExists = await fs.statAsync(ue4ssVariableLayout).then(() => true).catch(() => false);
  if (variableLayoutExists) {
    return;
  }

  const autoFix = async () => {
    try {
      await util.toPromise(cb => api.events.emit('purge-mods', true, cb));
      const source = path.join(__dirname, UE4SS_MEMBER_VARIABLE_LAYOUT_FILE);
      await fs.copyAsync(source, ue4ssVariableLayout);
      await util.toPromise(cb => api.events.emit('deploy-mods', cb));
    } catch (err) {
      api.showErrorNotification('Failed to apply Member Variable Layout', err);
      return;
    }
    return Promise.resolve();
  };

  api.sendNotification({
    id: 'palworld-ue4ss-member-variable-layout',
    type: 'warning',
    message: 'UE4SS MemberVariableLayout.ini missing',
    allowSuppress: false,
    actions: [
      {
        title: 'More',
        action: (dismiss) => {
          api.showDialog('question', 'Apply Member Variable Layout', {
            bbcode: t('The MemberVariableLayout.ini file is missing from your UE4SS installation. This file is required for some mods to function correctly.[br][/br][br][/br]'
                    + 'Would you like to apply the default layout?'),
          }, [
            {
              label: 'Apply',
              action: async () => {
                await autoFix();
                dismiss();
              },
              default: true,
            },
            { label: 'Close' },
          ]);
        }
      },
      {
        title: 'Fix',
        action: async (dismiss) => {
          await autoFix();
          dismiss();
        }
      }
    ],
  });
}

export async function testUE4SSVersion(api: types.IExtensionApi, eventType?: EventType) {
  const t = api.translate;
  const requirement = PLUGIN_REQUIREMENTS[0];
  const currentVersion = await requirement.resolveVersion(api);
  const latest = await getLatestGithubReleaseAsset(api, requirement);
  const versionMatch = latest.name.match(/v?(\d+\.\d+\.\d+(-\w+(\.\d+)?)?)/);
  if (!versionMatch) {
    throw new Error('Unable to determine version from release asset');
  }
  const latestVersion = versionMatch[1];
  const coercedVersion = util.semverCoerce(latestVersion, { includePrerelease: true});
  if (coercedVersion.version === currentVersion || semver.satisfies(`^${coercedVersion.version}`, currentVersion, { includePrerelease: true })) {
    return;
  }

  const more = (dismiss) => {
    api.showDialog('question', 'Update UE4SS', {
      bbcode: t('A new UE4SS update has been released "v{{latestVersion}}" - your modding environment is currently set to "v{{currentVersion}}".[br][/br][br][/br]'
              + 'Would you like to update? (if your modding environment is functioning correctly, there may be no reason to update.)', { replace: { currentVersion, latestVersion: coercedVersion.version } }),
    }, [
      {
        label: 'Download', default: true, action: () => {
          download(api, [requirement]);
          dismiss();
        }
      },
      { label: 'Close', action: () => dismiss() }
    ])
  }

  api.sendNotification({
    message: 'UE4SS update available',
    type: 'warning',
    allowSuppress: true,
    id: 'palworld-ue4ss-version',
    actions: [
      { title: 'More', action: more },
      {
        title: 'Download', action: (dismiss) => {
          download(api, [requirement]);
          dismiss();
        }
      }
    ]
  });
}

export async function testBluePrintModManager(api: types.IExtensionApi, eventType: EventType): Promise<void> {
  const state = api.getState();
  if (selectors.activeGameId(state) !== GAME_ID) {
    return;
  }

  let ue4ssMod = await findModByFile(api, '', UE4SS_SETTINGS_FILE);
  if (eventType === 'gamemode-activated') {
    // It's possible that the ue4ssMod didn't have a chance to install yet.
    //  Especially if the user just started to mod the game.
    if (ue4ssMod === undefined) {
      return;
    }
    // Make sure we disable the array cache.
    await api.emitAndAwait('deploy-single-mod', GAME_ID, ue4ssMod.id, false);
    await disableArrayCache(api, ue4ssMod);
    await api.emitAndAwait('deploy-single-mod', GAME_ID, ue4ssMod.id);
    return;
  } else {
    if (!ue4ssMod) {
      await download(api, PLUGIN_REQUIREMENTS);
      ue4ssMod = await findModByFile(api, '', UE4SS_SETTINGS_FILE);
    }
  }

  const ue4ssRelPath = resolveUE4SSPath(api);
  const installPath = selectors.installPathForGame(state, GAME_ID);
  const ue4ssInstallPath = path.join(installPath, ue4ssMod.installationPath);
  const bpModLoaderPath = path.join(ue4ssInstallPath, ue4ssRelPath, 'Mods', 'BPModLoaderMod');
  const modLoaderExists = await fs.statAsync(bpModLoaderPath).then(() => true).catch(() => false);
  const hasBackupFile = await fs.statAsync(path.join(ue4ssInstallPath, MODS_FILE_BACKUP)).then(() => true).catch(() => false);
  if (!modLoaderExists || !hasBackupFile) {
    await reinstallUE4SS(api, ue4ssMod, bpModLoaderPath);
    return;
  }

  // It's better UX if we just enable the BPModLoader at this point - less hassle for the user.
  await enableBPModLoader(api, ue4ssMod, bpModLoaderPath);
  return;
}

async function reinstallUE4SS(api: types.IExtensionApi, ue4ssMod: types.IMod, bpModLoaderPath: string): Promise<void> {
  const autoFix = async () => {
    try {
      await download(api, [PLUGIN_REQUIREMENTS[0]], true);
      // We've re-downloaded ue4ss, so we need to find it again.
      ue4ssMod = await PLUGIN_REQUIREMENTS[0].findMod(api);
      // await enableBPModLoader(api, ue4ssMod, bpModLoaderPath);
    } catch (err) {
      api.showErrorNotification('Failed to re-install UE4SS', err);
      return;
      // return reinstallUE4SS(api, ue4ssMod, bpModLoaderPath);
    }
    return Promise.resolve();
  };
  const t = api.translate;
  api.sendNotification({
    message: 'UE4SS missing or corrupted',
    type: 'warning',
    actions: [
      { 
        title: 'More',
        action: (dismiss) => {
          api.showDialog('question', 'Re-install UE4SS', {
            bbcode: t('Unreal Engine 4 Scripting System (UE4SS) is required for many mods that are hosted on the website. Vortex can try to re-download and re-install the mod loader for you.[br][/br][br][/br]'
                    + 'Please click on Download to proceed.', { ns: NAMESPACE }),
          },
          [
            {
              label: 'Download',
              action: async () => {
                await autoFix();
                dismiss();
              },
              default: true,
            },
            { label: 'Close' },
          ])
        }
      },
      {
        title: 'Fix',
        action: async (dismiss) => {
          await autoFix();
          dismiss();
        }
      }
    ],
    allowSuppress: false,
    noDismiss: true,
    id: NOTIF_ID_BP_MODLOADER_DISABLED,
  });
}

async function enableBPModLoader(api: types.IExtensionApi, ue4ssMod: types.IMod, bpModLoaderPath: string): Promise<void> {
  const enabledFilePath = path.join(bpModLoaderPath, UE4SS_ENABLED_FILE);
  const exists = await fs.statAsync(enabledFilePath).then(() => true).catch(() => false);
  if (exists) {
    return;
  }
  // Make sure we remove the mod before proceeding.
  try {
    await api.emitAndAwait('deploy-single-mod', GAME_ID, ue4ssMod.id, false);
    await fs.writeFileAsync(enabledFilePath, '', { encoding: 'utf8' });
    await disableArrayCache(api, ue4ssMod);
  } catch (err) {
    api.showErrorNotification('Failed to enable BPModLoader', 'Please ensure that UE4SS\'s BPModLoader is enabled manually', { allowReport: false });
    return Promise.resolve();
  } finally {
    await api.emitAndAwait('deploy-single-mod', GAME_ID, ue4ssMod.id);
  }
}

async function disableArrayCache(api: types.IExtensionApi, ue4ssMod: types.IMod) {
  const state = api.getState();
  const stagingFolder = selectors.installPathForGame(state, GAME_ID);
  const modPath = path.join(stagingFolder, ue4ssMod.installationPath);
  const ue4ssRelPath = resolveUE4SSPath(api);
  const ue4ssConfigPath = path.join(modPath, ue4ssRelPath, UE4SS_SETTINGS_FILE);
  const data: string = await fs.readFileAsync(ue4ssConfigPath, { encoding: 'utf8' });
  const newData = data.replace(/bUseUObjectArrayCache = true/gm, 'bUseUObjectArrayCache = false');
  await fs.removeAsync(ue4ssConfigPath).catch(err => null);
  await fs.writeFileAsync(ue4ssConfigPath, newData, { encoding: 'utf8' });
}
