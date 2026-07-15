/* eslint-disable */
import { fs, log, selectors, types, util } from 'vortex-api';
import path from 'path';

import { MODS_FILE_BACKUP, GAME_ID, UE4SS_2_5_2_FILES, UE4SS_SETTINGS_FILE,
  UE4SS_PATH_PREFIX, XBOX_UE4SS_XINPUT_REPLACEMENT, MODS_FILE, LUA_EXTENSIONS,
  UE4SS_FOLDER, UE4SS_IDENTIFIERS, UE4SS_LOADER_FILES, UE4SS_VERSION_PATTERN } from './common';

import { getTopLevelPatterns } from './stopPatterns';

//#region UE4SS Installer and test.
export async function testUE4SSInjector(files: string[], gameId: string): Promise<types.ISupportedResult> {
  // Lax on purpose: match any recognisable UE4SS file regardless of layout and let
  //  installUE4SSInjector normalise it.
  const supported = gameId === GAME_ID
    && files.some(file => UE4SS_IDENTIFIERS.includes(path.basename(file).toLowerCase()));
  return { supported, requiredFiles: [] };
}

export async function installUE4SSInjector(api: types.IExtensionApi, files: string[], destinationPath: string, gameId: string): Promise<types.IInstallResult> {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, gameId);
  const gameStore = discovery?.store ?? 'steam';
  // Store determines the binaries subfolder.
  const architecture = gameStore === 'xbox' ? 'WinGDK' : 'Win64';
  const targetPath = path.join(UE4SS_PATH_PREFIX, architecture);

  // Normalise the two shipped layouts (flat: payload at archive root; nested: payload
  //  under a top-level "ue4ss" folder) to the layout resolveUE4SSPath expects: everything
  //  under "ue4ss", with only the proxy loader beside the game executable.
  const isLoader = (filePath: string) => UE4SS_LOADER_FILES.includes(path.basename(filePath).toLowerCase());
  const toUe4ssRelative = (filePath: string) => {
    const segments = filePath.split(path.sep);
    if (segments[0]?.toLowerCase() === UE4SS_FOLDER) {
      segments.shift();
    }
    return segments.join(path.sep);
  };

  // Version from the install folder name; plain releases and git-describe builds both parse.
  //  Install still proceeds when it's unparseable - we just don't stamp a version.
  const expectedInstallDir = path.basename(destinationPath, '.installing');
  const version = UE4SS_VERSION_PATTERN.exec(expectedInstallDir)?.[1]
    ?? util.semverCoerce(expectedInstallDir)?.version;
  if (!version) {
    log('warn', 'Could not determine UE4SS version from install folder', expectedInstallDir);
  }

  const instructions: types.IInstruction[] = [];
  if (version) {
    instructions.push({ type: 'attribute', key: 'version', value: version });
  }

  for (const iter of files) {
    const segments = iter.split(path.sep);
    if (path.extname(segments[segments.length - 1]) === '') {
      // Skip directories and extensionless files (e.g. LICENSE).
      continue;
    }

    // Proxy loader goes beside the game exe, not under "ue4ss".
    //  Xbox doesn't load xinput1_3, so rename it to xinput1_4.
    let destination: string;
    if (isLoader(iter)) {
      const loaderName = (gameStore === 'xbox' && path.basename(iter).toLowerCase() === UE4SS_2_5_2_FILES[0].toLowerCase())
        ? XBOX_UE4SS_XINPUT_REPLACEMENT
        : path.basename(iter);
      destination = path.join(targetPath, loaderName);
    } else {
      destination = path.join(targetPath, UE4SS_FOLDER, toUe4ssRelative(iter));
    }

    if (path.basename(iter) === MODS_FILE) {
      // Never deploy mods.txt (it would overwrite the user's live mod list); keep a
      //  pristine copy for ensureModsFile() to seed from.
      const modsData: string = await fs.readFileAsync(path.join(destinationPath, iter), { encoding: 'utf8' });
      instructions.push({ type: 'generatefile', data: modsData, destination: MODS_FILE_BACKUP });
      continue;
    }

    if (path.basename(iter).toLowerCase() === UE4SS_SETTINGS_FILE.toLowerCase()) {
      // Disable the use of Unreal's object array cache regardless of game store - it's causing crashes.
      const data: string = await fs.readFileAsync(path.join(destinationPath, iter), { encoding: 'utf8' });
      const newData = data.replace(/bUseUObjectArrayCache = true/gm, 'bUseUObjectArrayCache = false');
      instructions.push({ type: 'generatefile', data: newData, destination });
      continue;
    }

    instructions.push({ type: 'copy', source: iter, destination });
  }

  instructions.push({ type: 'setmodtype', value: '' });
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

  const modsSegmentIdx = segments.map(seg => !!seg && seg.toLowerCase()).indexOf('mods');
  const folderId = (modsSegmentIdx !== -1)
    ? segments[modsSegmentIdx + 1]
    : (segments.length > 1)
      ? segments[0]
      : path.basename(destinationPath, '.installing');

  const attrInstr: types.IInstruction = {
    type: 'attribute',
    key: 'palworldFolderId',
    value: folderId,
  }
  const instructions = files.reduce((accum, iter) => {
    if (iter.endsWith(path.sep) || path.extname(iter) === '') {
      // No directories
      return accum;
    }
    const fileSegments = iter.split(path.sep);
    const destination = (modsSegmentIdx !== -1)
      ? path.join(fileSegments.slice(modsSegmentIdx).join(path.sep))
      : (fileSegments.length > 1)
        ? path.join('Mods', folderId, fileSegments.slice(1).join(path.sep))
        : path.join('Mods', folderId, iter);

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

//#region root mod
export async function testRootMod(files: string[], gameId: string): Promise<types.ISupportedResult> {
  const rightGame = gameId === GAME_ID;
  const runThroughPatterns = (patterns: string[]) => {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'i');
      for (const file of files) {
        const normal = file.replace(/\\/g, '/');
        if (regex.test(normal)) {
          return true;
        }
      }
    }
    return false;
  };
  const rightStructure = runThroughPatterns(getTopLevelPatterns(true));
  return Promise.resolve({ supported: rightGame && rightStructure, requiredFiles: [] });
}

export async function installRootMod(api: types.IExtensionApi, files: string[], destinationPath: string, gameId: string): Promise<types.IInstallResult> {
  const setModInstr: types.IInstruction = {
    type: 'setmodtype',
    value: '',
  };
  // I guess that if we're here - that means that we can just copy the files over?
  const instructions = files.reduce((accum, iter) => {
    if (iter.endsWith(path.sep) || path.extname(iter) === '') {
      // No directories
      return accum;
    }
    const instr: types.IInstruction = {
      type: 'copy',
      source: iter,
      destination: iter,
    }
    accum.push(instr);
    return accum;
  }, [setModInstr]);

  return Promise.resolve({ instructions });
}
//#endregion