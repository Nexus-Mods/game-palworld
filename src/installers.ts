/* eslint-disable */
import { selectors, types } from 'vortex-api';
import path from 'path';

import { GAME_ID, UE4SS_FILES, UE4SS_PATH_PREFIX, XBOX_UE4SS_XINPUT_REPLACEMENT } from './common';

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
  const instructions = files.reduce((accum, iter) => {
    const segments = iter.split(path.sep);
    if (path.extname(segments[segments.length - 1]) !== '') {
      // Apparently xinput1_3 isn't being loaded by the xbox gamepass version.
      //  we rename the file to xinput1_4
      const destination = iter === UE4SS_FILES[0]
        ? path.join(targetPath, XBOX_UE4SS_XINPUT_REPLACEMENT)
        : path.join(targetPath, iter);

      const instruction: types.IInstruction = {
        type: 'copy',
        source: iter,
        destination,
      }
      accum.push(instruction);
    }
    return accum;
  }, [])

  return { instructions };
}