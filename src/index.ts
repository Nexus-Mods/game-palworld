/* eslint-disable */
import * as _ from 'lodash';
import path from 'path';

import { fs, log, types, selectors, util } from 'vortex-api';

import { DEFAULT_EXECUTABLE, GAME_ID, IGNORE_CONFLICTS,
  PAK_MODSFOLDER_PATH, STEAMAPP_ID, XBOX_EXECUTABLE, XBOX_ID,
  PLUGIN_REQUIREMENTS, MOD_TYPE_PAK, MOD_TYPE_LUA, MOD_TYPE_BP_PAK,
  BPPAK_MODSFOLDER_PATH, MOD_TYPE_UNREAL_PAK_TOOL, IGNORE_DEPLOY, MOD_TYPE_LUA_V2, MOD_TYPE_CPP,
  MOD_TYPE_PALSCHEMA_FRAMEWORK, MOD_TYPE_PALSCHEMA_SUBMODULE,
  NOTIF_ID_REQUIREMENTS_OPTOUT, MOD_TYPE_PALSCHEMA_SUBMODULE_PAK
} from './common';

import { setAutoManageRequirements } from './actions';
import { requirementsReducer, settingsReducer } from './reducers';
import { IRemoveModOptions } from './types';
import Settings from './views/Settings';

import { getStopPatterns } from './stopPatterns';
import {
  getBPPakPath, getPakPath, testBPPakPath, testPakPath, testUnrealPakTool,
  getLUAPath, testLUAPath, getLUAPathV2, testLUAPathV2,
  getCppModPath, testCppModPath,
  testPalschemaFrameworkPath, testPalschemaSubmodulePath, getGameRootPath,
  getPalschemaSubmoduleDirectPath
} from './modTypes';
import {
  installLuaMod, installRootMod, installUE4SSInjector, testLuaMod, testRootMod, testUE4SSInjector, testCppMod, installCppMod,
  testPalschemaFramework, installPalschemaFramework, testPalschemaSubmodule, installPalschemaSubmodule
} from './installers';

import { migrate } from './migrations';

import { dismissNotifications, matchesRequirement, resolveUE4SSPath } from './util';
import { ensureRequirements } from './downloader';
import { isAutoManageEnabled } from './selectors';

import { onAddMod, onRemoveMod } from './modsFile';

const supportedTools: types.ITool[] = [];

const gameFinderQuery = {
  steam: [{ id: STEAMAPP_ID, prefer: 0 }],
  xbox: [{ id: XBOX_ID }],
};

const requiredFiles = [];
function getExecutable(discoveryPath) {
  const isCorrectExec = (exec) => {
    try {
      fs.statSync(path.join(discoveryPath, exec));
      requiredFiles.push(exec);
      return true;
    } catch (err) {
      return false;
    }
  };

  if (discoveryPath === undefined) {
    return DEFAULT_EXECUTABLE;
  }

  if (isCorrectExec(XBOX_EXECUTABLE)) {
    return XBOX_EXECUTABLE;
  }

  if (isCorrectExec(DEFAULT_EXECUTABLE)) {
    return DEFAULT_EXECUTABLE;
  }

  return DEFAULT_EXECUTABLE;
}

function main(context: types.IExtensionContext) {
  context.registerReducer(['settings', 'palworld', 'migrations'], settingsReducer);
  context.registerReducer(['settings', 'palworld', 'requirements'], requirementsReducer);

  context.registerSettings('Mods', Settings, undefined,
    () => selectors.activeGameId(context.api.getState()) === GAME_ID, 51);
  // register a whole game, basic metadata and folder paths
  context.registerGame({
    id: GAME_ID,
    name: 'Palworld',
    mergeMods: true,
    queryArgs: gameFinderQuery,
    queryModPath: () => '.',
    logo: 'gameart.jpg',
    executable: getExecutable,
    requiredFiles,
    setup: (discovery) => setup(context.api, discovery) as any,
    supportedTools,
    requiresLauncher: requiresLauncher as any,
    details: {
      customOpenModsPath: PAK_MODSFOLDER_PATH,
      supportsSymlinks: true,
      steamAppId: parseInt(STEAMAPP_ID),
      stopPatterns: getStopPatterns(),
      ignoreDeploy: IGNORE_DEPLOY,
      ignoreConflicts: IGNORE_CONFLICTS
    },
  });

  context.registerAction('mod-icons', 300, 'open-ext', {},
                         'Open Logic Mods Folder', () => {
    const state = context.api.getState();
    const discovery = selectors.discoveryByGame(state, GAME_ID);
    const logicModsPath = path.join(discovery.path, BPPAK_MODSFOLDER_PATH);
    util.opn(logicModsPath).catch(() => null);
  }, () => {
    const state = context.api.getState();
    const gameId = selectors.activeGameId(state);
    return gameId === GAME_ID;
  });

  context.registerAction('mod-icons', 300, 'open-ext', {},
                         'Open LUA/CPP Mods Folder', () => {
    const state = context.api.getState();
    const discovery = selectors.discoveryByGame(state, GAME_ID);
    const ue4ssPath = resolveUE4SSPath(context.api);
    const openPath = path.join(discovery.path, ue4ssPath, 'Mods');
    util.opn(openPath).catch(() => null);
  }, () => {
    const state = context.api.getState();
    const gameId = selectors.activeGameId(state);
    return gameId === GAME_ID;
  });

  context.registerInstaller('palworld-ue4ss', 10, testUE4SSInjector as any,
    (files, destinationPath, gameId) => installUE4SSInjector(context.api, files, destinationPath, gameId) as any);

  // Both PalSchema installers must run after UE4SS (so a UE4SS archive is never mistaken
  //  for the framework) but before the lua and cpp installers - otherwise a submodule's
  //  placeholder main.lua would be claimed as a lua mod, and the framework's dlls/main.dll
  //  as a cpp mod.
  context.registerInstaller('palworld-palschema-framework', 12, testPalschemaFramework as any,
    (files, destinationPath, gameId) => installPalschemaFramework(context.api, files, destinationPath, gameId) as any);

  context.registerInstaller('palworld-palschema-submodule', 14, testPalschemaSubmodule as any,
    (files, destinationPath, gameId) => installPalschemaSubmodule(context.api, files, destinationPath, gameId) as any);

  // Runs after UE4SS to ensure that we don't accidentally install UE4SS as a root mod.
  //  But must run before lua and pak installers to ensure we don't install a root mod
  //  as a lua mod.
  context.registerInstaller('palworld-root-mod', 15, testRootMod as any,
    (files, destinationPath, gameId) => installRootMod(context.api, files, destinationPath, gameId) as any);

  context.registerInstaller('palworld-lua-installer', 30, testLuaMod as any,
    (files, destinationPath, gameId) => installLuaMod(context.api, files, destinationPath, gameId) as any);

  context.registerInstaller('palworld-cppmod-installer', 35, testCppMod as any,
    (files, destinationPath, gameId) => installCppMod(context.api, files, destinationPath, gameId) as any);

  context.registerModType(
    MOD_TYPE_UNREAL_PAK_TOOL,
    4,
    (gameId) => GAME_ID === gameId,
    () => undefined, // Don't deploy.
    testUnrealPakTool as any,
    { deploymentEssential: false, name: 'Unreal Pak Tool', noConflicts: true }
  );

  // BP_PAK modType must have a lower priority than regular PAKs
  //  this ensures that we get a chance to detect the LogicMods folder
  //  structure before we just deploy it to ~mods
  context.registerModType(
    MOD_TYPE_BP_PAK,
    5,
    (gameId) => GAME_ID === gameId,
    (game: types.IGame) => getBPPakPath(context.api, game),
    (instructions: types.IInstruction[]) => testBPPakPath(context.api, instructions) as any,
    { deploymentEssential: true, name: 'Blueprint Mod' }
  );

  // Both PalSchema types must take precedence over the lua and cpp types - the framework
  //  ships a main.dll which would otherwise match the cpp type, and a submodule's
  //  placeholder main.lua would match the lua type.
  context.registerModType(
    MOD_TYPE_PALSCHEMA_FRAMEWORK,
    6,
    (gameId) => GAME_ID === gameId,
    (game: types.IGame) => getLUAPathV2(context.api, game),
    testPalschemaFrameworkPath as any,
    { deploymentEssential: true, name: 'PalSchema Framework' }
  );

  // 1. PURE PalSchema (without .pak)
  context.registerModType(
    MOD_TYPE_PALSCHEMA_SUBMODULE, 
    7, 
    (gameId) => GAME_ID === gameId, 
    (game: types.IGame) => getPalschemaSubmoduleDirectPath(context.api, game), 
    (instructions: types.IInstruction[]) => Promise.resolve(false) as any,
    { deploymentEssential: true, name: 'PalSchema Submodule' }
  );

  // 2. MIXED PalSchema (with .pak)
  context.registerModType(
    MOD_TYPE_PALSCHEMA_SUBMODULE_PAK, 
    8, 
    (gameId) => GAME_ID === gameId, 
    (game: types.IGame) => getGameRootPath(context.api, game), 
    testPalschemaSubmodulePath, 
    { deploymentEssential: true, name: 'PalSchema Submodule (+Pak)' }
  );

  context.registerModType(
    MOD_TYPE_PAK,
    10,
    (gameId) => GAME_ID === gameId,
    (game: types.IGame) => getPakPath(context.api, game),
    (instructions: types.IInstruction[]) => testPakPath(context.api, instructions) as any,
    { deploymentEssential: true, name: 'Pak Mod' }
  );

  // V2 mod type has precedence.
  context.registerModType(
    MOD_TYPE_LUA_V2,
    9,
    (gameId) => GAME_ID === gameId,
    (game: types.IGame) => getLUAPathV2(context.api, game),
    testLUAPathV2 as any,
    { deploymentEssential: true, name: 'LUA Mod V2' }
  );

  context.registerModType(
    MOD_TYPE_LUA,
    10,
    (gameId) => GAME_ID === gameId,
    (game: types.IGame) => getLUAPath(context.api, game),
    testLUAPath as any,
    { deploymentEssential: true, name: 'LUA Mod', mergeMods: (mod: types.IMod) => mod.id }
  );

  context.registerModType(
    MOD_TYPE_CPP,
    10,
    (gameId) => GAME_ID === gameId,
    (game: types.IGame) => getCppModPath(context.api, game),
    testCppModPath as any,
    { deploymentEssential: true, name: 'CPP Mod' }
  );

  context.once(() => {
    context.api.events.on('mods-enabled', async (modIds: string[], enabled: boolean, gameId: string) => onModsEnabled(context.api, modIds, enabled, gameId));
    context.api.onAsync('will-remove-mods', async (gameId: string, modIds: string[], options?: IRemoveModOptions) => {
      await onRequirementsRemoved(context.api, gameId, modIds, options);
      return onModsRemoved(context.api, gameId, modIds);
    });
    context.api.events.on('gamemode-activated', () => onGameModeActivated(context.api));
    context.api.onAsync('will-deploy', (profileId: string, deployment: types.IDeploymentManifest) => onWillDeployEvent(context.api, profileId, deployment));
    context.api.onAsync('did-deploy', (profileId: string, deployment: types.IDeploymentManifest) => onDidDeployEvent(context.api, profileId, deployment));
    context.api.onAsync('will-purge', (profileId: string) => onWillPurgeEvent(context.api, profileId));
    context.api.onAsync('did-purge', (profileId: string) => onDidPurgeEvent(context.api, profileId));
  });

  return true;
}

async function setup(api: types.IExtensionApi, discovery: types.IDiscoveryResult): Promise<void> {

  if (!discovery || !discovery.path) return;

  // Make sure the folders exist
  const ensurePath = (filePath: string) => fs.ensureDirWritableAsync(path.join(discovery.path, filePath));
  try {
    const UE4SSPath = resolveUE4SSPath(api);
    const oldSegments = UE4SSPath.split(path.sep);
    oldSegments.pop();
    oldSegments.push('Mods');
    const oldScriptSystemPath = oldSegments.join(path.sep);
    await Promise.all([path.join(UE4SSPath, 'Mods'), oldScriptSystemPath, PAK_MODSFOLDER_PATH, BPPAK_MODSFOLDER_PATH].map(ensurePath));
    await migrate(api);
    await ensureRequirements(api);
  } catch (err) {
    api.showErrorNotification('Failed to setup Palworld extension', err);
    return;
  }
}

async function onModsRemoved(api: types.IExtensionApi, gameId: string, modIds: string[]): Promise<void> {
  if (gameId !== GAME_ID) {
    return;
  }
  for (const modId of modIds) {
    await onRemoveMod(api, modId);
  }
  return;
}

// Removing a requirement mod turns automatic management off, so it doesn't come back
//  on the next activation. Disabling is respected per-mod instead (see ensureRequirements).
//  Only a direct user action counts: Vortex leaves the reason unset for those and sets one
//  for removals it performs itself (updates, replacements, unmanaging the game).
async function onRequirementsRemoved(api: types.IExtensionApi, gameId: string, modIds: string[],
                                     options?: IRemoveModOptions): Promise<void> {
  const userInitiated = (options?.reason ?? 'user_manual') === 'user_manual'
    && options?.willBeReplaced !== true;
  if (gameId !== GAME_ID || !userInitiated || !isAutoManageEnabled(api.getState())) {
    return;
  }
  const mods = api.getState().persistent?.mods?.[GAME_ID] ?? {};
  const isRequirement = (mod: types.IMod) => (mod !== undefined)
    && PLUGIN_REQUIREMENTS.some(req => matchesRequirement(mod, req));
  if (!modIds.some(modId => isRequirement(mods[modId]))) {
    return;
  }
  api.store.dispatch(setAutoManageRequirements(false));
  api.sendNotification({
    id: NOTIF_ID_REQUIREMENTS_OPTOUT,
    type: 'info',
    message: 'Palworld requirements no longer auto-managed. Re-enable in Settings > Mods.',
  });
}

async function onModsInstalled(api: types.IExtensionApi, gameId: string, modIds: string[]): Promise<void> {
  if (gameId !== GAME_ID) {
    return;
  }
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  for (const modId of modIds) {
    const mod = mods[modId];
    if ([MOD_TYPE_LUA, MOD_TYPE_LUA_V2, MOD_TYPE_CPP, MOD_TYPE_PALSCHEMA_FRAMEWORK].includes(mod?.type)) {
      await onAddMod(api, modId);
    } 
  }
  return;
}

async function onModsEnabled(api: types.IExtensionApi, modIds: string[], enabled: boolean, gameId: string) {
  if (gameId !== GAME_ID) {
    return;
  }
  const func = enabled ? onModsInstalled : onModsRemoved;
  await func(api, gameId, modIds);
}

async function onGameModeActivated(api: types.IExtensionApi) {
  const state = api.getState();
  const activeGameId = selectors.activeGameId(state);
  if (activeGameId !== GAME_ID) {
    dismissNotifications(api);
    return;
  }
}

async function onDidDeployEvent(api: types.IExtensionApi, profileId: string, deployment: types.IDeploymentManifest): Promise<void> {
  const state = api.getState();
  const profile = selectors.profileById(state, profileId); 
  const gameId = profile?.gameId;
  if (gameId !== GAME_ID) {
    return Promise.resolve();
  }

  try {
    await onDidDeployLuaEvent(api, profile);
  } catch (err) {
    log('warn', 'failed to test BluePrint Mod Manager', err);
  }

  try {
    await onDidDeployCppModEvent(api, profile);
  } catch (err) {
    log('warn', 'failed to deploy cpp mod', err);
  }

  return Promise.resolve();
}

const isLuaMod = (mod: types.IMod) => {
  if (!mod?.type) {
    return false;
  }
  return [MOD_TYPE_LUA, MOD_TYPE_LUA_V2, MOD_TYPE_PALSCHEMA_FRAMEWORK].includes(mod.type);
}

const isCppMod = (mod: types.IMod) => {
  if (!mod?.type) {
    return false;
  }
  return [MOD_TYPE_CPP].includes(mod.type);
}

async function onDidDeployLuaEvent(api: types.IExtensionApi, profile: types.IProfile): Promise<void> {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modState = util.getSafe(profile, ['modState'], {});
  const enabled = Object.keys(modState).filter((key) => isLuaMod(mods?.[key]) && modState[key].enabled);
  const disabled = Object.keys(modState).filter((key) => isLuaMod(mods?.[key]) && !modState[key].enabled);
  await onModsInstalled(api, profile.gameId, enabled);
  await onModsRemoved(api, profile.gameId, disabled);
}

async function onDidPurgeLuaEvent(api: types.IExtensionApi, profile: types.IProfile): Promise<void> {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modState = util.getSafe(profile, ['modState'], {});
  const enabled = Object.keys(modState).filter((key) => isLuaMod(mods?.[key]) && modState[key].enabled);
  const disabled = Object.keys(modState).filter((key) => isLuaMod(mods?.[key]) && !modState[key].enabled);
  await onModsRemoved(api, profile.gameId, [].concat(enabled, disabled));
}

async function onDidDeployCppModEvent(api: types.IExtensionApi, profile: types.IProfile): Promise<void> {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modState = util.getSafe(profile, ['modState'], {});
  const enabled = Object.keys(modState).filter((key) => isCppMod(mods?.[key]) && modState[key].enabled);
  const disabled = Object.keys(modState).filter((key) => isCppMod(mods?.[key]) && !modState[key].enabled);
  await onModsInstalled(api, profile.gameId, enabled);
  await onModsRemoved(api, profile.gameId, disabled);
}

async function onDidPurgeCppModEvent(api: types.IExtensionApi, profile: types.IProfile): Promise<void> {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modState = util.getSafe(profile, ['modState'], {});
  const enabled = Object.keys(modState).filter((key) => isCppMod(mods?.[key]) && modState[key].enabled);
  const disabled = Object.keys(modState).filter((key) => isCppMod(mods?.[key]) && !modState[key].enabled);
  await onModsRemoved(api, profile.gameId, [].concat(enabled, disabled));
}

async function onWillPurgeEvent(api: types.IExtensionApi, profileId: string): Promise<void> {
  return;
}

async function onDidPurgeEvent(api: types.IExtensionApi, profileId: string): Promise<void> {
  const state = api.getState();
  const profile = selectors.profileById(state, profileId); 
  const gameId = profile?.gameId;
  if (gameId !== GAME_ID) {
    return Promise.resolve();
  }

  try {
    await onDidPurgeLuaEvent(api, profile);
  } catch (err) {
    log('warn', 'failed to remove lua entries from mods.txt', err);
  }

  try {
    await onDidPurgeCppModEvent(api, profile);
  } catch (err) {
    log('warn', 'failed to remove cpp mod entries from mods.txt', err);
  }

  return Promise.resolve();
}

async function onWillDeployEvent(api: types.IExtensionApi, profileId: any, deployment: types.IDeploymentManifest): Promise<void> {

  const state = api.getState();
  const profile = selectors.activeProfile(state);

  if (profile?.gameId !== GAME_ID) {
    return Promise.resolve();
  }

  const discovery = selectors.discoveryByGame(state, GAME_ID);
  if (!discovery?.path || discovery?.store !== 'xbox') {
    // Game not discovered or not Xbox? bail.
    return Promise.resolve();
  }
}

async function requiresLauncher(gamePath: string, store?: string) {
  // If Xbox, we'll launch via Xbox app
  if (store === 'xbox') {
    return Promise.resolve({
      launcher: 'xbox',
      addInfo: {
        appId: XBOX_ID,
        parameters: [{ appExecName: 'AppPalShipping' }],
      },
    });
  } else {
    return Promise.resolve(undefined);
  }
}

export default main;
