/* eslint-disable */
import path from 'path';
import { fs, selectors, types, util } from 'vortex-api';
import turbowalk, { IWalkOptions, IEntry } from 'turbowalk';

import { UE4SS_PATH_PREFIX, GAME_ID, NOTIF_ID_BP_MODLOADER_DISABLED, PLUGIN_REQUIREMENTS, MOD_TYPE_UNREAL_PAK_TOOL } from './common';

export function resolveUE4SSPath(api: types.IExtensionApi): string {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const architecture = discovery?.store === 'xbox' ? 'WinGDK' : 'Win64';
  return path.join(UE4SS_PATH_PREFIX, architecture);
}

export async function resolveUnrealPakToolPath(api: types.IExtensionApi): Promise<string | null> {
  const state = api.getState();
  const requirement = PLUGIN_REQUIREMENTS.find(req => req.modType === MOD_TYPE_UNREAL_PAK_TOOL);
  if (!requirement) {
    return null;
  }
  const mod: types.IMod = await requirement.findMod(api);
  if (mod) {
    const stagingFolder = selectors.installPathForGame(state, GAME_ID);
    return path.join(stagingFolder, mod.installationPath);
  }
}

export function getMods(api: types.IExtensionApi, modType: string): types.IMod[] {
  const state = api.getState();
  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  return Object.values(mods).filter((mod: types.IMod) => mod.type === modType || mod.type === '') as types.IMod[];
}

export async function findModByFile(api: types.IExtensionApi, modType: string, fileName: string): Promise<types.IMod> {
  const mods = getMods(api, modType);
  const installationPath = selectors.installPathForGame(api.getState(), GAME_ID);
  for (const mod of mods) {
    const modPath = path.join(installationPath, mod.installationPath);
    const files = await walkPath(modPath);
    if (files.find(file => file.filePath.endsWith(fileName))) {
      return mod;
    }
  }
  return undefined;
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

export function dismissNotifications(api: types.IExtensionApi) {
  // We're not dismissing the downloader notifications intentionally.
  [NOTIF_ID_BP_MODLOADER_DISABLED].forEach(id => api.dismissNotification(id));
}