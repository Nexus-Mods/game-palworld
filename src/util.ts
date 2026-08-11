/* eslint-disable */
import path from 'path';
import { actions, fs, selectors, types, util } from 'vortex-api';
import turbowalk, { IWalkOptions, IEntry } from 'turbowalk';

import { UE4SS_PATH_PREFIX, GAME_ID,
  NOTIF_ID_BP_MODLOADER_DISABLED, REQUIREMENT_PAK_TOOL,
  NOTIF_ID_UE4SS_UPDATE, getRequirement,
  UE4SS_DLL, UE4SS_LOADER_FILES, UE_PAK_TOOL_FILES,
} from './common';

import { IPluginRequirement } from './types';

export function pathExists(filePath: string): Promise<boolean> {
  return fs.statAsync(filePath).then(() => true).catch(() => false);
}

export function resolveUE4SSPath(api: types.IExtensionApi): string {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const architecture = discovery?.store === 'xbox' ? 'WinGDK' : 'Win64';
  return path.join(UE4SS_PATH_PREFIX, architecture, 'ue4ss');
}

export async function resolveUnrealPakToolPath(api: types.IExtensionApi): Promise<string | null> {
  const mod = await findRequirementMod(api, getRequirement(REQUIREMENT_PAK_TOOL));
  if (!mod) {
    return null;
  }
  const stagingFolder = selectors.installPathForGame(api.getState(), GAME_ID);
  return path.join(stagingFolder, mod.installationPath);
}

// The archive nests the tool in an "UnrealPakTool" folder, but Vortex's default installer
//  flattens a redundant top-level folder, so the executable sits at either depth depending
//  on which version installed it. Walk as a last resort so any layout still resolves.
export async function resolveUnrealPakToolExecutable(api: types.IExtensionApi): Promise<string | null> {
  const modPath = await resolveUnrealPakToolPath(api);
  if (!modPath) {
    return null;
  }
  const executable = UE_PAK_TOOL_FILES[0];
  const candidates = [
    path.join(modPath, executable),
    path.join(modPath, 'UnrealPakTool', executable),
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  const files = await walkPath(modPath);
  const found = files.find(file => path.basename(file.filePath).toLowerCase() === executable.toLowerCase());
  return found?.filePath ?? null;
}

export function isModEnabled(api: types.IExtensionApi, modId: string): boolean {
  const state = api.getState();
  const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
  return selectors.profileById(state, profileId)?.modState?.[modId]?.enabled ?? false;
}

// Cheap recognition: the identity we stamp at install time, or a display name this
//  and older extension versions assigned.
export function matchesRequirement(mod: types.IMod, requirement: IPluginRequirement): boolean {
  if (mod?.attributes?.['palworldRequirement'] === requirement.attributeId) {
    return true;
  }
  const knownNames = [requirement.userFacingName, ...(requirement.legacyNames ?? [])];
  return knownNames.includes(mod?.attributes?.['customFileName']);
}

// All installed mods (regardless of enable-state) that could be an instance of the
//  given requirement. Mods only the staging-folder walk recognises get the identity
//  attribute stamped, so subsequent lookups take the cheap path.
export async function findRequirementMods(api: types.IExtensionApi, requirement: IPluginRequirement): Promise<types.IMod[]> {
  const state = api.getState();
  const mods = state.persistent?.mods?.[GAME_ID] ?? {};
  const candidates = Object.values(mods).filter(mod => mod.type === requirement.modType);

  const named = candidates.filter(mod => matchesRequirement(mod, requirement));
  if (named.length > 0) {
    return named;
  }

  if (!requirement.identifierFile) {
    return [];
  }
  const identifierFile = requirement.identifierFile.toLowerCase();
  const installationPath = selectors.installPathForGame(state, GAME_ID);
  const found = await Promise.all(candidates.map(async mod => {
    const files = await walkPath(path.join(installationPath, mod.installationPath));
    return files.some(file => path.basename(file.filePath).toLowerCase() === identifierFile) ? mod : undefined;
  }));
  const result = found.filter(mod => mod !== undefined);
  if (result.length > 0) {
    util.batchDispatch(api.store, result.map(mod =>
      actions.setModAttribute(GAME_ID, mod.id, 'palworldRequirement', requirement.attributeId)));
  }
  return result;
}

// Best single candidate: an enabled copy wins, otherwise the most recently installed.
export function pickRequirementMod(api: types.IExtensionApi, candidates: types.IMod[]): types.IMod {
  const installTime = (mod: types.IMod) => {
    const time = Date.parse(mod.attributes?.['installTime']);
    return Number.isNaN(time) ? 0 : time;
  };
  return candidates.find(mod => isModEnabled(api, mod.id))
    ?? candidates.reduce((best, mod) => installTime(mod) > installTime(best) ? mod : best, candidates[0]);
}

export async function findRequirementMod(api: types.IExtensionApi, requirement: IPluginRequirement): Promise<types.IMod> {
  return pickRequirementMod(api, await findRequirementMods(api, requirement));
}

// A UE4SS installation the user set up themselves (https://pwmodding.wiki/docs/users/ue4ss/installation):
//  the "ue4ss" payload folder and/or a proxy loader DLL inside Pal/Binaries/<arch>/.
//  Only meaningful when no Vortex-managed UE4SS mod exists - deployed files would
//  otherwise be our own. ensureModsFile applies the same idea to mods.txt.
export async function isUE4SSDeployedUnmanaged(api: types.IExtensionApi): Promise<boolean> {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  if (!discovery?.path) {
    return false;
  }
  const ue4ssPath = path.join(discovery.path, resolveUE4SSPath(api));
  if (await pathExists(path.join(ue4ssPath, UE4SS_DLL))) {
    return true;
  }
  const binariesPath = path.dirname(ue4ssPath);
  const loaders = await Promise.all(UE4SS_LOADER_FILES.map(loader =>
    pathExists(path.join(binariesPath, loader))));
  return loaders.includes(true);
}

// Id of a finished download holding this requirement's archive, if we already have one.
export function findRequirementDownload(api: types.IExtensionApi, requirement: IPluginRequirement): string | null {
  const downloads = api.getState().persistent?.downloads?.files ?? {};
  const matches = (localPath: string) => (requirement.fileArchivePattern !== undefined)
    ? requirement.fileArchivePattern.test(localPath)
    : path.basename(localPath).toLowerCase() === requirement.archiveFileName.toLowerCase();
  const entry = Object.entries(downloads)
    .find(([, dl]) => !!dl.localPath && matches(dl.localPath));
  return entry?.[0] ?? null;
}

// This function is used to find the mod folder of a mod which is still in the installation phase.
export async function findInstallFolderByFile(api: types.IExtensionApi, filePath: string): Promise<string> {
  const installationPath = selectors.installPathForGame(api.getState(), GAME_ID);
  const pathContents = await fs.readdirAsync(installationPath);
  const modFolders = pathContents.filter(folder => path.extname(folder) === '.installing');
  if (modFolders.length === 1) {
    return path.join(installationPath, modFolders[0]);
  } else {
    for (const folder of modFolders) {
      const modPath = path.join(installationPath, folder);
      const files = await walkPath(modPath);
      if (files.find(file => file.filePath.endsWith(filePath))) {
        return path.join(installationPath, folder);
      }
    }
  }
  return undefined;
}

export async function walkPath(dirPath: string, walkOptions?: IWalkOptions): Promise<IEntry[]> {
  walkOptions = !!walkOptions
    ? { ...walkOptions, skipHidden: true, skipInaccessible: true, skipLinks: true }
    : { skipLinks: true, skipHidden: true, skipInaccessible: true };
  const walkResults: IEntry[] = [];
  return new Promise<IEntry[]>(async (resolve, reject) => {
    await turbowalk(dirPath, (entries: IEntry[]) => {
      walkResults.push(...entries);
      return Promise.resolve() as any;
      // If the directory is missing when we try to walk it; it's most probably down to a collection being
      //  in the process of being installed/removed. We can safely ignore this.
    }, walkOptions).catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err));
    return resolve(walkResults);
  });
}

// Staging folder file operations require the mod to be purged and re-deployed once the
//  staging operation is complete. This function will remove the mod with the specified modId
//  and run the specified function before re-deploying the mod.
// IMPORTANT: all operations within the provided functor should ensure to only apply to the provided
//  modId to ensure we avoid deployment corruption.
export async function runStagingOperationOnMod(api: types.IExtensionApi, modId: string, func: (...args: any[]) => Promise<void>): Promise<void> {
  try {
    await api.emitAndAwait('deploy-single-mod', GAME_ID, modId, false);
    await func(api, modId);
    await api.emitAndAwait('deploy-single-mod', GAME_ID, modId);
  } catch (err) {
    api.showErrorNotification('Failed to run staging operation', err);
    return;
  }
}

export function dismissNotifications(api: types.IExtensionApi) {
  // We're not dismissing the downloader notifications intentionally.
  [NOTIF_ID_BP_MODLOADER_DISABLED, NOTIF_ID_UE4SS_UPDATE].forEach(id => api.dismissNotification(id));
}

export function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}