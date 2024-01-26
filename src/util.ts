/* eslint-disable */
import path from 'path';
import { selectors, types, util } from 'vortex-api';
import turbowalk, { IWalkOptions, IEntry } from 'turbowalk';

import { UE4SS_PATH_PREFIX, GAME_ID, NOTIF_ID_BP_MODLOADER_DISABLED } from './common';

export function resolveUE4SSPath(api: types.IExtensionApi): string {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const architecture = discovery?.store === 'xbox' ? 'WinGDK' : 'Win64';
  return path.join(UE4SS_PATH_PREFIX, architecture);
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

export async function walkPath(dirPath: string, walkOptions?: IWalkOptions): Promise<IEntry[]> {
  walkOptions = walkOptions || { skipLinks: true, skipHidden: true, skipInaccessible: true };
  // We REALLY don't care for hidden or inaccessible files.
  walkOptions = { ...walkOptions, skipHidden: true, skipInaccessible: true, skipLinks: true };
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
  [NOTIF_ID_BP_MODLOADER_DISABLED].forEach(id => api.dismissNotification(id));
}