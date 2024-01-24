import path from 'path';
import { selectors, types } from 'vortex-api';

import { UE4SS_PATH_PREFIX, GAME_ID } from './common';

export function resolveUE4SSPath(api: types.IExtensionApi): string {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const architecture = discovery?.store === 'xbox' ? 'WinGDK' : 'Win64';
  return path.join(UE4SS_PATH_PREFIX, architecture);
}