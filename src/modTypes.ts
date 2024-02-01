/* eslint-disable */
import path from 'path';
import { selectors, types } from 'vortex-api';
import { BPPAK_MODSFOLDER_PATH, PAK_MODSFOLDER_PATH,
  PAK_EXTENSIONS, IGNORE_CONFLICTS, LUA_EXTENSIONS } from './common';
import { resolveUE4SSPath, findInstallFolderByFile } from './util';

import { listPak } from './unrealPakParser';

//#region Utility
const hasModTypeInstruction = (instructions: types.IInstruction[]) => instructions.find(instr => instr.type === 'setmodtype');
//#endregion

//#region MOD_TYPE_PAK
export function getPakPath(api: types.IExtensionApi, game: types.IGame) {
  const discovery = selectors.discoveryByGame(api.getState(), game.id);
  if (!discovery || !discovery.path) {
    return '.';
  }
  const pakPath = path.join(discovery.path, PAK_MODSFOLDER_PATH);
  return pakPath;
}

export async function testPakPath(api: types.IExtensionApi, instructions: types.IInstruction[]): Promise<boolean> {
  if (hasModTypeInstruction(instructions)) {
    return Promise.resolve(false);
  }
  let modDir: string = undefined;
  // const modTypes: { [modType: string]: pakPath }
  const filtered = instructions
    .filter((inst: types.IInstruction) => (inst.type === 'copy') && (path.extname(inst.source) === '.pak'));
  for (const pak of filtered) {
    if (!modDir) {
      modDir = await findInstallFolderByFile(api, pak.source);
    }
    const data = await listPak(path.join(modDir, pak.source));
    if (data.modType === 'palworld-pak-modtype') {
      return true;
    }
  }

  return false;
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
  if (hasModTypeInstruction(instructions)) {
    return Promise.resolve(false);
  }
  // Pretty basic set up right now.
  const filtered = instructions
    .filter((inst: types.IInstruction) => (inst.type === 'copy')
      && (LUA_EXTENSIONS.includes(path.extname(inst.source as any))));
 
  const supported = filtered.length > 0;
  return Promise.resolve(supported) as any;
}
//#endregion

//#region BluePrint
export function getBPPakPath(api: types.IExtensionApi, game: types.IGame) {
  const discovery = selectors.discoveryByGame(api.getState(), game.id);
  if (!discovery || !discovery.path) {
    return '.';
  }
  const luaPath = path.join(discovery.path, BPPAK_MODSFOLDER_PATH);
  return luaPath;
}

export async function testBPPakPath(api: types.IExtensionApi, instructions: types.IInstruction[]): Promise<boolean> {
  if (hasModTypeInstruction(instructions)) {
    return Promise.resolve(false);
  }
  let modDir: string = undefined;
  // const modTypes: { [modType: string]: pakPath }
  const filtered = instructions
    .filter((inst: types.IInstruction) => (inst.type === 'copy') && (path.extname(inst.source) === '.pak'));
  for (const pak of filtered) {
    if (!modDir) {
      modDir = await findInstallFolderByFile(api, pak.source);
    }
    const data = await listPak(path.join(modDir, pak.source));
    if (data.modType === 'palworld-blueprint-modtype') {
      return true;
    }
  }

  return false;
  // const filteredPaks = instructions
  //   .filter((inst: types.IInstruction) => {
  //     if (inst.type !== 'copy') {
  //       return false;
  //     }
  //     if (!PAK_EXTENSIONS.includes(path.extname(inst.source as any))) {
  //       return false;
  //     }
  //     const segments = inst.source.toLowerCase().split(path.sep);
  //     if (!segments.includes('logicmods')) {
  //       return false;
  //     }
  //     return true;
  //   });
 
  // const excludeInstructions: types.IInstruction[] = instructions.filter((inst => {
  //   if (inst.type !== 'copy') return false;
  //   const segments = inst.source.toLowerCase().split(path.sep);
  //   if (IGNORE_CONFLICTS.includes(segments[segments.length - 1])) {
  //     return true;
  //   }
  //   return false;
  // }))

  // const supported = filteredPaks.length > 0 && excludeInstructions.length === 0;
  // return Promise.resolve(supported) as any;
}
//#endregion