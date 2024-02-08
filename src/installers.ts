/* eslint-disable */
import { fs, selectors, types } from 'vortex-api';
import path from 'path';

import { MODS_FILE_BACKUP, GAME_ID, UE4SS_2_5_2_FILES, UE4SS_SETTINGS_FILE,
  UE4SS_PATH_PREFIX, XBOX_UE4SS_XINPUT_REPLACEMENT, UE4SS_DWMAPI, MODS_FILE, LUA_EXTENSIONS } from './common';

//#region UE4SS Installer and test.
export async function testUE4SSInjector(files: string[], gameId: string): Promise<types.ISupportedResult> {
  const supported = gameId === GAME_ID && files.some(file => file.toLowerCase() === UE4SS_SETTINGS_FILE.toLowerCase());
  return { supported, requiredFiles: [] };
}

export async function installUE4SSInjector(api: types.IExtensionApi, files: string[], destinationPath: string, gameId: string): Promise<types.IInstallResult> {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, gameId);
  const gameStore = discovery.store ?? 'steam';
  // Different gamestores means different target path.
  const architecture = gameStore === 'xbox' ? 'WinGDK' : 'Win64';
  const targetPath = path.join(UE4SS_PATH_PREFIX, architecture);
  const instructions = await files.reduce(async (accumP, iter) => {
    const accum = await accumP;
    const segments = iter.split(path.sep);
    if (path.extname(segments[segments.length - 1]) !== '') {
      // Apparently xinput1_3 isn't being loaded by the xbox gamepass version.
      //  we rename the file to xinput1_4 - going to leave this in for backwards compatibility
      //  although it's not required.
      const destination = gameStore === 'xbox' && iter === UE4SS_2_5_2_FILES[0]
        ? path.join(targetPath, XBOX_UE4SS_XINPUT_REPLACEMENT)
        : path.join(targetPath, iter);

      if (iter === MODS_FILE) {
        const modsData: string = await fs.readFileAsync(path.join(destinationPath, iter), { encoding: 'utf8' });
        const modsInstr: types.IInstruction = {
          type: 'generatefile',
          data: modsData,
          destination: MODS_FILE_BACKUP,
        }
        accum.push(modsInstr);
        return accum;
      }

      if (iter === UE4SS_SETTINGS_FILE) {
        // Disable the use of Unreal's object array cache regardless of game store - it's causing crashes.
        const data: string = await fs.readFileAsync(path.join(destinationPath, iter), { encoding: 'utf8' });
        const newData = data.replace(/bUseUObjectArrayCache = true/gm, 'bUseUObjectArrayCache = false');
        const createInstr: types.IInstruction = {
          type: 'generatefile',
          data: newData,
          destination,
        }
        accum.push(createInstr);
        return accum;
      }

      const instruction: types.IInstruction = {
        type: 'copy',
        source: iter,
        destination,
      }
      accum.push(instruction);
    }
    return accum;
  }, Promise.resolve([]))
  instructions.push({
    type: 'setmodtype',
    value: '',
  })
  return { instructions };
}
//#endregion
//#region LUA
export async function testLuaMod(files: string[], gameId: string): Promise<types.ISupportedResult> {
  const rightGame = gameId === GAME_ID;
  const rightFile = files.some(file => LUA_EXTENSIONS.includes(path.extname(file)));
  const supported = rightGame && rightFile;
  return { supported, requiredFiles: [] };
}

export async function installLuaMod(api: types.IExtensionApi, files: string[], destinationPath: string, gameId: string): Promise<types.IInstallResult> {
  const luaFiles = files.filter(file => LUA_EXTENSIONS.includes(path.extname(file)));
  // We want the lua with the shortest path first as we're going to use that
  //  to ascertain if the mod requires a parent directory added or not.
  luaFiles.sort((a, b) => a.length - b.length);
  const shortest = luaFiles[0];
  const segments = shortest.split(path.sep);
  const parentDirectory = segments.length > 1 ? '' : path.basename(destinationPath);
  const folderId = parentDirectory ?? destinationPath;
  const attrInstr: types.IInstruction = {
    type: 'attribute',
    key: 'palworldFolderId',
    value: folderId,
  }
  const instructions = files.reduce((accum, iter) => {
    if (path.extname(iter) === '') {
      // Get rid of directories
      return accum;
    }
    const destination = parentDirectory ? path.join(parentDirectory, 'Mods', iter) : path.join('Mods', iter);
    const instruction: types.IInstruction = {
      type: 'copy',
      source: iter,
      destination,
    };
    accum.push(instruction);
    return accum;
  }, [attrInstr]);
  return Promise.resolve({ instructions });
}
//#endregion