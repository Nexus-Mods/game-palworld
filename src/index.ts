/* eslint-disable */

import path from 'path';

import { actions, fs, types, selectors, util } from 'vortex-api';

import { DEFAULT_EXECUTABLE, GAME_ID, IGNORE_CONFLICTS, IGNORE_DEPLOY,
  PAK_MODSFOLDER_PATH, STEAMAPP_ID, XBOX_EXECUTABLE, XBOX_ID,
  PLUGIN_REQUIREMENTS, MOD_TYPE_PAK, MOD_TYPE_LUA } from './common';

import { getStopPatterns } from './stopPatterns';
import { getLUAPath, getPakPath, testLUAPath, testPakPath } from './modTypes';
import { installUE4SSInjector, testUE4SSInjector } from './installers';

import { resolveUE4SSPath } from './util';
import { download } from './downloader';

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
      supportsSymlinks: true,
      steamAppId: parseInt(STEAMAPP_ID),
      stopPatterns: getStopPatterns(),
      //ignoreDeploy: IGNORE_DEPLOY,
      ignoreConflicts: IGNORE_CONFLICTS
    },
  });

  context.registerInstaller('palworld-ue4ss', 10, testUE4SSInjector as any,
    (files, destinationPath, gameId) => installUE4SSInjector(context.api, files, destinationPath, gameId) as any);
  
  context.registerModType(
    MOD_TYPE_PAK,
    10,
    (gameId) => GAME_ID === gameId,
    (game: types.IGame) => getPakPath(context.api, game),
    testPakPath as any,
    { deploymentEssential: true, name: 'Pak Mod' }
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
    //context.api.setStylesheet('starfield', path.join(__dirname, 'starfield.scss'));
    context.api.events.on('gamemode-activated', () => onGameModeActivated(context.api));
    context.api.onAsync('will-deploy', (profileId: string, deployment: types.IDeploymentManifest) => onWillDeployEvent(context.api, profileId, deployment));
    context.api.onAsync('did-deploy', (profileId: string, deployment: types.IDeploymentManifest) => onDidDeployEvent(context.api, profileId, deployment));
    context.api.onAsync('will-purge', (profileId: string) => onWillPurgeEvent(context.api, profileId));
    context.api.onAsync('did-purge', (profileId: string) => onDidPurgeEvent(context.api, profileId));
    // context.api.onAsync('intercept-file-changes', (intercepted: types.IFileChange[], cb: (result: types.IFileChange[]) => void) => {
    //   return onInterceptFileChanges(context.api, intercepted, cb);
    // });
  });

  return true;
}

async function setup(api: types.IExtensionApi, discovery: types.IDiscoveryResult): Promise<void> {

  if (!discovery || !discovery.path) return;

  // Make sure the folders exist
  const ensurePath = (filePath: string) => fs.ensureDirWritableAsync(path.join(discovery.path, filePath));
  const UE4SSPath = resolveUE4SSPath(api);
  await ensurePath(path.join(UE4SSPath, 'Mods'));
  await ensurePath(PAK_MODSFOLDER_PATH);
  await download(api, PLUGIN_REQUIREMENTS);
}


async function onGameModeActivated(api: types.IExtensionApi) {
  const state = api.getState();
  const activeGameId = selectors.activeGameId(state);

  if (activeGameId !== GAME_ID) {
    //dismissNotifications(api);
  }

  return;
}

async function onDidDeployEvent(api: types.IExtensionApi, profileId: string, deployment: types.IDeploymentManifest): Promise<void> {
  const state = api.getState();
  const gameId = selectors.profileById(state, profileId)?.gameId;
  if (gameId !== GAME_ID) {
    return Promise.resolve();
  }

  return Promise.resolve();
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
