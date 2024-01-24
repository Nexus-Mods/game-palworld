import path from 'path';
import { selectors, types } from 'vortex-api';
import { PAK_MODSFOLDER_PATH, PAK_EXTENSIONS, IGNORE_CONFLICTS, LUA_EXTENSIONS } from './common';
import { resolveUE4SSPath } from './util';
//#region MOD_TYPE_PAK
export function getPakPath(api: types.IExtensionApi, game: types.IGame) {
  const discovery = selectors.discoveryByGame(api.getState(), game.id);
  if (!discovery || !discovery.path) {
    return '.';
  }
  const pakPath = path.join(discovery.path, PAK_MODSFOLDER_PATH);
  return pakPath;
}

export function testPakPath(instructions: types.IInstruction[]): Promise<boolean> {
  // Pretty basic set up right now.
  const filteredPaks = instructions
    .filter((inst: types.IInstruction) => (inst.type === 'copy')
      && (PAK_EXTENSIONS.includes(path.extname(inst.source as any))));
 
  const excludeInstructions: types.IInstruction[] = instructions.filter((inst => {
    if (inst.type !== 'copy') return false;
    const segments = inst.source.split(path.sep);
    if (IGNORE_CONFLICTS.includes(segments[segments.length - 1])) {
      return true;
    }
    return false;
  }))

  const supported = filteredPaks.length > 0 && excludeInstructions.length === 0;
  return Promise.resolve(supported) as any;
}
//#endregion

//#region MOD_TYPE_LUA
export function getLUAPath(api: types.IExtensionApi, game: types.IGame) {
  const discovery = selectors.discoveryByGame(api.getState(), game.id);
  if (!discovery || !discovery.path) {
    return '.';
  }
  const ue4ssPath = resolveUE4SSPath(api);
  const luaPath = path.join(discovery.path, ue4ssPath, 'Mods');
  return luaPath;
}

export function testLUAPath(instructions: types.IInstruction[]): Promise<boolean> {
  // Pretty basic set up right now.
  const filtered = instructions
    .filter((inst: types.IInstruction) => (inst.type === 'copy')
      && (LUA_EXTENSIONS.includes(path.extname(inst.source as any))));
 
  const supported = filtered.length > 0;
  return Promise.resolve(supported) as any;
}
//#endregion