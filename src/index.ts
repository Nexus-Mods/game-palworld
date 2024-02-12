/* eslint-disable */
import * as _ from 'lodash';
import path from 'path';

import { fs, log, types, selectors, util } from 'vortex-api';

import { DEFAULT_EXECUTABLE, GAME_ID, IGNORE_CONFLICTS,
  PAK_MODSFOLDER_PATH, STEAMAPP_ID, XBOX_EXECUTABLE, XBOX_ID,
  PLUGIN_REQUIREMENTS, MOD_TYPE_PAK, MOD_TYPE_LUA, MOD_TYPE_BP_PAK,
  BPPAK_MODSFOLDER_PATH, MOD_TYPE_UNREAL_PAK_TOOL, IGNORE_DEPLOY, MOD_TYPE_LUA_V2,
} from './common';

import { settingsReducer } from './reducers';

import { getStopPatterns } from './stopPatterns';
import {
  getBPPakPath, getPakPath, testBPPakPath, testPakPath, testUnrealPakTool,
  getLUAPath, testLUAPath, getLUAPathV2, testLUAPathV2,
} from './modTypes';
import { installLuaMod, installUE4SSInjector, testLuaMod, testUE4SSInjector } from './installers';
import { testBluePrintModManager, testUE4SSVersion } from './tests';

import { migrate } from './migrations';

import { dismissNotifications, resolveUE4SSPath } from './util';
import { download } from './downloader';
import { GamesMap, ModsMap } from './types';

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
                         'Open LUA Mods Folder', () => {
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

  context.registerInstaller('palworld-lua-installer', 10, testLuaMod as any,
    (files, destinationPath, gameId) => installLuaMod(context.api, files, destinationPath, gameId) as any);

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

  context.once(() => {
    // context.api.events.on('did-install-mod', async (gameId: string, archiveId: string, modId: string) => onModsInstalled(context.api, gameId, [modId]));
    context.api.events.on('mods-enabled', async (modIds: string[], enabled: boolean, gameId: string) => onModsEnabled(context.api, modIds, enabled, gameId));
    context.api.onAsync('will-remove-mods', async (gameId: string, modIds: string[]) => onModsRemoved(context.api, gameId, modIds));
    // context.api.events.on('did-install-mod', async (gameId, archiveId, modId) => {
    //   if (gameId !== GAME_ID) {
    //     return;
    //   }

    //   const state = context.api.getState();
    //   const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', gameId], {});
    //   const mod = mods?.[modId];
    //   if (mod.type !== MOD_TYPE_LUA) {
    //     return;
    //   }

    //   const installPath = selectors.installPathForGame(state, GAME_ID);
    //   const modPath = path.join(installPath, mod.installationPath);
    //   const exists = await fs.statAsync(path.join(modPath, 'enabled.txt')).then(() => true).catch(() => false);
    //   if (!exists) {
    //     await fs.writeFileAsync(path.join(modPath, 'enabled.txt'), '', { encoding: 'utf8' });
    //   }
    // })
    context.api.events.on('gamemode-activated', () => onGameModeActivated(context.api));
    context.api.onAsync('will-deploy', (profileId: string, deployment: types.IDeploymentManifest) => onWillDeployEvent(context.api, profileId, deployment));
    context.api.onAsync('did-deploy', (profileId: string, deployment: types.IDeploymentManifest) => onDidDeployEvent(context.api, profileId, deployment));
    context.api.onAsync('will-purge', (profileId: string) => onWillPurgeEvent(context.api, profileId));
    context.api.onAsync('did-purge', (profileId: string) => onDidPurgeEvent(context.api, profileId));
    context.api.onAsync('check-mods-version', (gameId: string, mods: types.IMod[], forced?: boolean) => onCheckModVersion(context.api, gameId, mods, forced));
  });

  return true;
}

async function setup(api: types.IExtensionApi, discovery: types.IDiscoveryResult): Promise<void> {

  if (!discovery || !discovery.path) return;

  // Make sure the folders exist
  const ensurePath = (filePath: string) => fs.ensureDirWritableAsync(path.join(discovery.path, filePath));
  try {
    const UE4SSPath = resolveUE4SSPath(api);
    await ensurePath(path.join(UE4SSPath, 'Mods'));
    await ensurePath(PAK_MODSFOLDER_PATH);
    await ensurePath(BPPAK_MODSFOLDER_PATH);
    await migrate(api);
    await download(api, PLUGIN_REQUIREMENTS);
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

async function onModsInstalled(api: types.IExtensionApi, gameId: string, modIds: string[]): Promise<void> {
  if (gameId !== GAME_ID) {
    return;
  }
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  for (const modId of modIds) {
    const mod = mods[modId];
    if ([MOD_TYPE_LUA, MOD_TYPE_LUA_V2].includes(mod?.type)) {
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

  try {
    await testUE4SSVersion(api);
    await testBluePrintModManager(api, 'gamemode-activated');
  } catch (err) {
    // All errors should've been handled in the test - if this
    //  notification is reported - please fix the test.
    api.showErrorNotification('BPModManager is disabled', err);
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
    await testBluePrintModManager(api, 'did-deploy');
    await onDidDeployLuaEvent(api, profile);
  } catch (err) {
    log('warn', 'failed to test BluePrint Mod Manager', err);
  }

  return Promise.resolve();
}

async function onDidDeployLuaEvent(api: types.IExtensionApi, profile: types.IProfile): Promise<void> {
  const modState = util.getSafe(profile, ['modState'], {});
  const enabled = Object.keys(modState).filter((key) => modState[key].enabled);
  const disabled = Object.keys(modState).filter((key) => !modState[key].enabled);
  await onModsInstalled(api, profile.gameId, enabled);
  await onModsRemoved(api, profile.gameId, disabled);
}

async function onWillPurgeEvent(api: types.IExtensionApi, profileId: string): Promise<void> {
  return;
}

async function onDidPurgeEvent(api: types.IExtensionApi, profileId: string): Promise<void> {
  return;
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

async function onCheckModVersion(api: types.IExtensionApi, gameId: string, mods: types.IMod[], forced?: boolean) {
  const profile = selectors.activeProfile(api.getState());
  if (profile.gameId !== GAME_ID || gameId !== GAME_ID) {
    return;
  }
  try {
    await testUE4SSVersion(api);
  } catch (err) {
    log('warn', 'failed to test UE4SS version', err);
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
