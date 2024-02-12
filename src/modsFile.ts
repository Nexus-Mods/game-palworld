/* eslint-disable */
import path from 'path';
import { types, selectors, fs, util } from 'vortex-api';
import { MODS_FILE, GAME_ID, PLUGIN_REQUIREMENTS, MODS_FILE_BACKUP } from './common';
import { resolveUE4SSPath } from './util';

export async function onAddMod(api: types.IExtensionApi, modId: string) {
  try {
    await esureModsFileEntryAdded(api, modId);
  } catch (err) {
    api.showErrorNotification('Failed to add mod to mods file', err);
  }
}

export async function onRemoveMod(api: types.IExtensionApi, modId: string) {
  try {
    await esureModsFileEntryRemoved(api, modId);
  } catch (err) {
    api.showErrorNotification('Failed to remove mod from mods file', err);
  }
}

async function esureModsFileEntryAdded(api: types.IExtensionApi, modId: string) {
  // regardless of what happens next, the mods file needs to be updated.
  const ue4ssModsFile = await ensureModsFile(api);
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const mod = mods[modId];
  if (!mod) {
    throw new util.NotFound(modId);
  }
  const folderId = mod.attributes?.palworldFolderId ?? mod.installationPath;
  const data = await fs.readFileAsync(ue4ssModsFile, { encoding: 'utf8' });
  const lines: string[] = data.split(/\r\n/).filter(line => !!line);
  const lineIndex = lines.findIndex(line => line.includes(`${folderId} = 1`));
  if (lineIndex === - 1) {
    lines.splice(-2, 0, `${folderId} = 1`);
    await fs.writeFileAsync(ue4ssModsFile, lines.join('\r\n'), { encoding: 'utf8' });
  }
  return;
}

// Obviously ensure you call this function while the mod entry is still installed!!
async function esureModsFileEntryRemoved(api: types.IExtensionApi, modId: string) {
  // regardless of what happens next, the mods file needs to be updated.
  const ue4ssModsFile = await ensureModsFile(api);
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const mod = mods[modId];
  if (!mod) {
    // Not much we can do if the mod is gone. This can get called during deploy and purge
    //  too, so it's better we don't spam the user.
    return;
  }
  const folderId = mod.attributes?.palworldFolderId ?? mod.installationPath;
  const data = await fs.readFileAsync(ue4ssModsFile, { encoding: 'utf8' });
  const lines: string[] = data.split(/\r\n/);
  const lineIndex = lines.findIndex(line => line.includes(`${folderId} = 1`));
  if (lineIndex !== - 1) {
    lines.splice(lineIndex, 1);
    await fs.writeFileAsync(ue4ssModsFile, lines.join('\r\n'), { encoding: 'utf8' });
  }
  return;
}

export async function ensureModsFile(api: types.IExtensionApi): Promise<string> {
  const state = api.getState();
  const discovery: types.IDiscoveryResult = selectors.discoveryByGame(state, GAME_ID);
  if (discovery?.path === undefined) {
    throw new util.NotFound(GAME_ID);
  }
  const requirement = PLUGIN_REQUIREMENTS[0];
  const mod = await requirement.findMod(api);
  if (!mod) {
    throw new util.NotFound(requirement.userFacingName);
  }
  const ue4ssPath = resolveUE4SSPath(api);
  const relPath = path.join(ue4ssPath, 'Mods', MODS_FILE);
  const modsFilePath = path.join(discovery.path, relPath);
  const exists = await fs.statAsync(modsFilePath).then(() => true).catch(() => false);
  if (!exists) {
    const staging = selectors.installPathForGame(state, GAME_ID);
    const modsFileBackup = path.join(staging, mod.installationPath, MODS_FILE_BACKUP);
    await fs.copyAsync(modsFileBackup, modsFilePath);
  }

  return modsFilePath;
}

