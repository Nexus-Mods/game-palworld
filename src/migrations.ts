import path from 'path';
import semver from 'semver';
import { actions, fs, selectors, types, util } from 'vortex-api';

import { setPalworldMigrationVersion } from './actions';

import { GAME_ID, PLUGIN_REQUIREMENTS, MODS_FILE, MODS_FILE_BACKUP, MOD_TYPE_LUA_V2, UE4SS_PATH_PREFIX, MOD_TYPE_LUA } from './common';
import { resolveUE4SSPath, runStagingOperationOnMod } from './util';

const MIGRATIONS = {
  '0.1.5': migrate015,
  '0.1.9': migrate019,
};

export async function migrate(api: types.IExtensionApi): Promise<void> {
  const state = api.getState();
  const requiredMigrations = [];
  const lastMigrationVersion = util.getSafe(state, ['settings', 'palworld', 'migrations', 'palworldMigrationVersion'], '0.0.0');
  for (const [version, migration] of Object.entries(MIGRATIONS)) {
    if (semver.gt(version, lastMigrationVersion)) {
      requiredMigrations.push({ version, migration });
    }
  }

  if (requiredMigrations.length === 0) {
    return;
  }

  try {
    for (const entry of requiredMigrations) {
      await entry.migration(api);
    }
    const newVersion = requiredMigrations[requiredMigrations.length - 1].version;
    api.store.dispatch(setPalworldMigrationVersion(newVersion));
  } catch (err) {
    api.showErrorNotification('Failed to migrate', err);
  }

  return;
}

export async function migrate019(api: types.IExtensionApi): Promise<void> {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const architecture = discovery?.store === 'xbox' ? 'WinGDK' : 'Win64';
  const oldPath = path.join(discovery.path, UE4SS_PATH_PREFIX, architecture, 'Mods');
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const batchedActions = [];
  const oldPathExists = await fs.statAsync(oldPath).then(() => true).catch(() => false);
  if (!oldPathExists) {
    // Nothing to do here.
    return;
  }
  await api.emitAndAwait('purge-mods-in-path', GAME_ID, MOD_TYPE_LUA_V2, oldPath);
  await api.emitAndAwait('purge-mods-in-path', GAME_ID, MOD_TYPE_LUA, oldPath);
  const luaMods = Object.values(mods)
    .filter(mod => [MOD_TYPE_LUA, MOD_TYPE_LUA_V2].includes(mod.type));

  for (const mod of luaMods) {
    batchedActions.push(actions.setModType(GAME_ID, mod.id, MOD_TYPE_LUA_V2));
  }
  util.batchDispatch(api.store, batchedActions);
  await util.toPromise(cb => api.events.emit('deploy-mods', cb));
  return;
}

export async function migrate015(api: types.IExtensionApi): Promise<void> {
  const requirement = PLUGIN_REQUIREMENTS[0];
  const mod: types.IMod = await requirement.findMod(api);
  if (mod?.id) {
    await runStagingOperationOnMod(api, mod.id, removeModsFile);
  }
  return;
}

// Something tells me this is going to be used perfusely.
export async function removeModsFile(api: types.IExtensionApi): Promise<void> {
  const requirement = PLUGIN_REQUIREMENTS[0];
  const ue4ssMod = await requirement.findMod(api);
  if (!ue4ssMod) {
    // You lucky dog.
    return;
  }
  const state = api.getState();
  const staging = selectors.installPathForGame(state, GAME_ID);
  const modPath = path.join(staging, (await ue4ssMod).installationPath);
  const ue4ssRelPath = resolveUE4SSPath(api);
  const modFilePath = path.join(modPath, ue4ssRelPath, 'Mods', MODS_FILE);
  const exists = await fs.statAsync(modFilePath).then(() => true).catch((err) => false);
  if (exists) {
    await fs.linkAsync(modFilePath, path.join(modPath, ue4ssRelPath, 'Mods', MODS_FILE_BACKUP));
    await fs.unlinkAsync(modFilePath);
  }
}