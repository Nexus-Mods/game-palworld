/* eslint-disable */
import { fs, selectors, types } from 'vortex-api';
import path from 'path';

import { GAME_ID, UE4SS_FILES, UE4SS_PATH_PREFIX } from './common';

//#region UE4SS Installer and test.
export async function testUE4SSInjector(files: string[], gameId: string): Promise<types.ISupportedResult> {
  const supported = gameId === GAME_ID && files.some(file => UE4SS_FILES.includes(file));
  return { supported, requiredFiles: UE4SS_FILES };
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
      // UE4SS 3.0.0 uses dwmapi.dll instead of xinput1_3.dll or xinput1_4.dll
      const destination = path.join(targetPath, iter);

      if (iter === UE4SS_FILES[1]) {
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
