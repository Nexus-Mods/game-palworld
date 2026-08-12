/* eslint-disable */
import { fs, log, selectors, types, util } from 'vortex-api';
import path from 'path';

import { MODS_FILE_BACKUP, GAME_ID, UE4SS_2_5_2_FILES, UE4SS_SETTINGS_FILE,
  UE4SS_PATH_PREFIX, XBOX_UE4SS_XINPUT_REPLACEMENT, MODS_FILE, LUA_EXTENSIONS,
  UE4SS_FOLDER, UE4SS_IDENTIFIERS, UE4SS_LOADER_FILES, UE4SS_VERSION_PATTERN,
  CPPMOD_EXTENSIONS, UE_PAK_TOOL_FILES,
  PALSCHEMA_SUBMODULE_FOLDERS, PALSCHEMA_DATA_EXTENSIONS,
  PAK_EXTENSIONS, PAK_MODSFOLDER_PATH,
  MOD_TYPE_PALSCHEMA_FRAMEWORK, MOD_TYPE_PALSCHEMA_SUBMODULE, 
  MOD_TYPE_PALSCHEMA_SUBMODULE_PAK} from './common';

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

//#region PalSchema Framework
export async function testPalschemaFramework(files: string[], gameId: string): Promise<types.ISupportedResult> {
  const rightGame = gameId === GAME_ID;
  if (!rightGame) return { supported: false, requiredFiles: [] };

  const normalFiles = files.map(f => f.toLowerCase().replace(/\\/g, '/'));
  const hasDllsMain = normalFiles.some(f => f.endsWith('dlls/main.dll'));
  const hasScriptsMain = normalFiles.some(f => f.endsWith('scripts/main.lua'));
  const hasEnabledTxt = files.some(f => path.basename(f).toLowerCase() === 'enabled.txt');
  // A dlls/main.dll alone is NOT a reliable fingerprint: plain C++ mods (e.g.
  //  ModIntegratedStorageCpp) ship the same layout. Require a path segment
  //  literally named "palschema" (or a top-level folder literally named PalSchema)
  //  before claiming a match.
  const hasPalSchemaFolder = normalFiles.some(f => f.split('/').includes('palschema'));
  const hasPalSchemaTopFolder = normalFiles.some(f => f.split('/')[0] === 'palschema');

  const supported = hasDllsMain && (hasPalSchemaFolder || hasPalSchemaTopFolder) && (hasEnabledTxt || !hasScriptsMain);
  return { supported, requiredFiles: [] };
}

export async function installPalschemaFramework(api: types.IExtensionApi, files: string[], destinationPath: string, gameId: string): Promise<types.IInstallResult> {
  const setModInstr: types.IInstruction = {
    type: 'setmodtype',
    value: MOD_TYPE_PALSCHEMA_FRAMEWORK,
  };

  const attrInstr: types.IInstruction = {
    type: 'attribute',
    key: 'palworldFolderId',
    value: 'PalSchema',
  };

  let hasEnabledTxt = false;

  const instructions = files.reduce((accum, iter) => {
    if (iter.endsWith(path.sep) || iter.endsWith('/') || path.extname(iter) === '') {
      return accum;
    }
    if (path.basename(iter).toLowerCase() === 'enabled.txt') {
      hasEnabledTxt = true;
    }

    // Strip everything up to and including the framework's own folder, so archives that
    //  bake in a game path (Mods/PalSchema/..., Pal/Binaries/<arch>/ue4ss/Mods/PalSchema/...)
    //  land in the same place as one that ships a plain PalSchema folder.
    const segments = iter.split(/[\\/]/);
    const palschemaIdx = segments.findIndex(seg => seg.toLowerCase() === 'palschema');
    const relSegments = (palschemaIdx !== -1) ? segments.slice(palschemaIdx + 1) : segments;
    const relPath = (relSegments.length > 0) ? relSegments.join(path.sep) : path.basename(iter);
    const destination = path.join('Mods', 'PalSchema', relPath);

    accum.push({
      type: 'copy',
      source: iter,
      destination,
    });
    return accum;
  }, [setModInstr, attrInstr]);

  if (!hasEnabledTxt) {
    instructions.push({
      type: 'generatefile',
      data: '',
      destination: path.join('Mods', 'PalSchema', 'enabled.txt'),
    });
  }

  return { instructions };
}
//#endregion

//#region PalSchema Submodule
export async function testPalschemaSubmodule(files: string[], gameId: string): Promise<types.ISupportedResult> {
  const rightGame = gameId === GAME_ID;
  if (!rightGame) return { supported: false, requiredFiles: [] };

  const normalFiles = files.map(f => f.toLowerCase().replace(/\\/g, '/'));
  // A PalSchema submodule is: data folders (see PALSCHEMA_SUBMODULE_FOLDERS) + optional
  //  placeholder main.lua/enabled.txt. Reject only things that make it a *different* mod
  //  kind: a real Lua script (scripts/main.lua) or a C++ mod (dlls/).
  const hasRealLuaScript = normalFiles.some(f => f.endsWith('scripts/main.lua'));
  const hasDllsDir = normalFiles.some(f => f.includes('/dlls/'));
  if (hasRealLuaScript || hasDllsDir) return { supported: false, requiredFiles: [] };

  const inSubmoduleFolder = (filePath: string) => {
    const segments = filePath.toLowerCase().split(/[\\/]/);
    return segments.slice(0, -1).some(seg => PALSCHEMA_SUBMODULE_FOLDERS.includes(seg));
  };

  const hasSubmoduleFolder = files.some(inSubmoduleFolder);
  if (!hasSubmoduleFolder) return { supported: false, requiredFiles: [] };

  // Some authors ship a submodule and the PAK it depends on in one archive (e.g. Nexus
  //  1135/988). We handle those, but a bare PAK mod that merely happens to have a folder
  //  named items/ or resources/ full of textures is not a submodule - so when a PAK is
  //  present, require actual PalSchema data too. PalSchema only ever loads .json/.jsonc.
  const hasPak = normalFiles.some(f => PAK_EXTENSIONS.some(ext => f.endsWith(ext)));
  if (hasPak) {
    const hasSubmoduleData = files.some(f =>
      PALSCHEMA_DATA_EXTENSIONS.includes(path.extname(f).toLowerCase()) && inSubmoduleFolder(f));
    return { supported: hasSubmoduleData, requiredFiles: [] };
  }

  return { supported: true, requiredFiles: [] };
}

export async function installPalschemaSubmodule(api: types.IExtensionApi, files: string[], destinationPath: string, gameId: string): Promise<types.IInstallResult> {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, gameId);
  const architecture = discovery?.store === 'xbox' ? 'WinGDK' : 'Win64';

  const validFiles = files.filter(f => !f.endsWith(path.sep) && !f.endsWith('/') && path.extname(f) !== '');

  // Some archives ship the PAK a submodule depends on alongside it (e.g. Nexus 1135/988).
  //  Those two halves deploy to completely different roots, so split them here. Anything
  //  already under a Content/Paks prefix travels with the PAK - .utoc/.ucas siblings must
  //  sit beside their .pak.
  const isPakFile = (f: string) => {
    if (PAK_EXTENSIONS.includes(path.extname(f).toLowerCase())) {
      return true;
    }
    const normal = f.toLowerCase().replace(/\\/g, '/');
    return normal.includes('content/paks/');
  };

  const pakFiles = validFiles.filter(isPakFile);
  const schemaFiles = validFiles.filter(f => !isPakFile(f));

  // Some authors ship submodules with a full game-path prefix baked in, e.g.
  //   Mods/PalSchema/mods/<Name>/...          (Multiclimate Shields)
  //   Pal/Binaries/Win64/ue4ss/Mods/PalSchema/mods/<Name>/...  (Work Book Crafting EZ)
  //   Pal/Binaries/Win64/Mods/PalSchema/mods/<Name>/...  (pre-UE4SS-3.0 layout, Nexus 1135)
  // Find the "palschema/mods/" marker once and strip everything before it so the submodule
  //  lands under the ue4ss Mods folder regardless of what the archive claimed.
  const findMarker = (segments: string[]): number => {
    for (let i = 0; i < segments.length - 1; i++) {
      if (segments[i].toLowerCase() === 'palschema' && segments[i + 1].toLowerCase() === 'mods') {
        return i + 2; // first index AFTER 'palschema/mods/'
      }
    }
    return -1;
  };

  // Derive the name from the PalSchema half only - a PAK sitting at the archive root would
  //  otherwise break the "all files share one top folder" check below.
  const segsOf = (f: string) => f.split(/[\\/]/);
  const anySegs = schemaFiles.map(segsOf).find(s => findMarker(s) !== -1);
  const markerIdx = anySegs !== undefined ? findMarker(anySegs) : -1;

  // Establish the mod name + prefix stripping state.
  let modName: string = undefined;
  let hasMarker = false;
  let detectedTopFolder: string = undefined;

  if (markerIdx !== -1) {
    const contentSegs = anySegs.slice(markerIdx);
    const first = contentSegs[0];
    if (first && !PALSCHEMA_SUBMODULE_FOLDERS.includes(first.toLowerCase())) {
      modName = first;
      hasMarker = true;
    }
  }

  if (!modName) {
    const firstSegments = schemaFiles.map(f => f.split(/[\\/]/)[0]);
    const allSameTopFolder = firstSegments.length > 0 && firstSegments.every(s => s.toLowerCase() === firstSegments[0].toLowerCase());
    const topFolderCandidate = firstSegments[0];
    if (allSameTopFolder && topFolderCandidate && !PALSCHEMA_SUBMODULE_FOLDERS.includes(topFolderCandidate.toLowerCase())) {
      modName = topFolderCandidate;
      detectedTopFolder = topFolderCandidate;
    }
  }

  if (!modName) {
    const jsonFiles = schemaFiles.filter(f => PALSCHEMA_DATA_EXTENSIONS.includes(path.extname(f).toLowerCase()));
    if (jsonFiles.length > 0) {
      const topJson = jsonFiles.find(f => f.split(/[\\/]/).length === 1);
      const targetJson = topJson || jsonFiles[0];
      modName = path.basename(targetJson, path.extname(targetJson));
    }
  }

  if (!modName) {
    modName = path.basename(destinationPath, '.installing');
  }

  // Check if .pak files exist
  const hasPakFiles = pakFiles.length > 0;
  const targetModType = hasPakFiles ? MOD_TYPE_PALSCHEMA_SUBMODULE_PAK : MOD_TYPE_PALSCHEMA_SUBMODULE;

  const setModInstr: types.IInstruction = {
    type: 'setmodtype',
    value: targetModType,
  };

  const attrInstr: types.IInstruction = {
    type: 'attribute',
    key: 'palworldFolderId',
    value: modName,
  };

  let submoduleRoot = '';
  if (hasPakFiles) {
    // MIXED: Builds the full path from the game root (as before)
    submoduleRoot = path.join(UE4SS_PATH_PREFIX, architecture, UE4SS_FOLDER,
                              'Mods', 'PalSchema', 'mods', modName);
  } else {
    // PURE: Vortex is already in the PalSchema/mods folder due to the direct mod type
    submoduleRoot = modName;
  }

  const instructions = schemaFiles.reduce((accum, iter) => {
    const baseName = path.basename(iter).toLowerCase();
    
    let segments = iter.split(/[\\/]/);
    if (hasMarker) {
      const fileMarkerIdx = findMarker(segments);
      if (fileMarkerIdx !== -1) {
        if (segments[fileMarkerIdx]?.toLowerCase() === modName.toLowerCase()) {
          segments = segments.slice(fileMarkerIdx + 1);
        } else {
          segments = segments.slice(fileMarkerIdx);
        }
      } else {
        segments = [path.basename(iter)];
      }
    } else if (detectedTopFolder) {
      if (segments[0].toLowerCase() === detectedTopFolder.toLowerCase() && segments.length > 1) {
        segments = segments.slice(1);
      } else {
        segments = [path.basename(iter)];
      }
    }

    if (segments.length === 0 || segments.every(s => !s)) {
      segments = [path.basename(iter)];
    }

    const relPath = segments.join(path.sep);
    const destination = path.join(submoduleRoot, relPath);

    accum.push({
      type: 'copy',
      source: iter,
      destination,
    });
    return accum;
  }, [setModInstr, attrInstr]);

  // The PAK half goes to ~mods by basename, flattening whatever prefix the archive used.
  for (const iter of pakFiles) {
    instructions.push({
      type: 'copy',
      source: iter,
      destination: path.join(PAK_MODSFOLDER_PATH, path.basename(iter)),
    });
  }

  return { instructions };
}
//#endregion

//#region LUA/CppMod install function
// Helper function to avoid repeating the same code for cpp and lua mods since they both go into Mods folder.
async function installModInModsFolder(api: types.IExtensionApi, files: string[], destinationPath: string, gameId: string, extensions: string[]): Promise<types.IInstallResult> {
  const allowedExtensions = [...CPPMOD_EXTENSIONS, ...LUA_EXTENSIONS];

  const isExtensionAllowed = extensions.some((extension) => {
    if (allowedExtensions.includes(extension)) {
      return true;
    }
  });

  if (!isExtensionAllowed)
  {
    return Promise.reject('Failed to install mod, extension(s) provided are not allowed in Mods folder');
  }

  const modFiles = files.filter(file => extensions.includes(path.extname(file)));
  // We want the mod with the shortest path first as we're going to use that
  //  to ascertain if the mod requires a parent directory added or not.
  modFiles.sort((a, b) => a.length - b.length);
  const shortest = modFiles[0];
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

//#region LUA
export async function testLuaMod(files: string[], gameId: string): Promise<types.ISupportedResult> {
  const rightGame = gameId === GAME_ID;
  const rightFile = files.some(file => LUA_EXTENSIONS.includes(path.extname(file)));
  const supported = rightGame && rightFile;
  return { supported, requiredFiles: [] };
}

export async function installLuaMod(api: types.IExtensionApi, files: string[], destinationPath: string, gameId: string): Promise<types.IInstallResult> {
  return installModInModsFolder(api, files, destinationPath, gameId, LUA_EXTENSIONS);
}
//#endregion

//#region CppMod
export async function testCppMod(files: string[], gameId: string): Promise<types.ISupportedResult> {
  const rightGame = gameId === GAME_ID;
  const rightFile = files.some(file => CPPMOD_EXTENSIONS.includes(path.extname(file)));
  // The Unreal Pak Tool ships a bundle of UnrealPak-*.dll files but is not a cpp mod:
  //  it must keep the archive's own layout, which is where listPak looks for the
  //  executable. Deploying it into the ue4ss Mods folder breaks pak inspection.
  const isPakTool = files.some(file => UE_PAK_TOOL_FILES.includes(path.basename(file)));
  const supported = rightGame && rightFile && !isPakTool;
  return { supported, requiredFiles: [] };
}

export async function installCppMod(api: types.IExtensionApi, files: string[], destinationPath: string, gameId: string): Promise<types.IInstallResult> {
  return installModInModsFolder(api, files, destinationPath, gameId, CPPMOD_EXTENSIONS);
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