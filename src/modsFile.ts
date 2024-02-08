import path from 'path';
import { types, selectors, fs, util } from 'vortex-api';
import { GAME_ID, MODS_FILE_BACKUP } from './common';
import { IDiscoveryResult } from 'vortex-api/lib/types/IState';
import { resolveUE4SSModsFilePath } from './util';

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
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const mod = mods[modId];
  if (!mod) {
    throw new util.NotFound(modId);
  }
  const folderId = mod.attributes?.palworldFolderId ?? mod.installationPath;
  const ue4ssModsFile = await ensureModsFile(api);
  const data = await fs.readFileAsync(ue4ssModsFile, { encoding: 'utf8' });
  const lines = data.split(/\n\r/);
  const lineIndex = lines.findIndex(line => line.includes(`${folderId} = 1`));
  if (lineIndex === - 1) {
    lines.push(`${folderId} = 1`);
    await fs.writeFileAsync(ue4ssModsFile, lines.join('\n'), { encoding: 'utf8' });
  }
}

// Obviously ensure you call this function while the mod entry is still installed!!
async function esureModsFileEntryRemoved(api: types.IExtensionApi, modId: string) {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const mod = mods[modId];
  if (!mod) {
    throw new util.NotFound(modId);
  }
  const folderId = mod.attributes?.palworldFolderId ?? mod.installationPath;
  const ue4ssModsFile = await ensureModsFile(api);
  const data = await fs.readFileAsync(ue4ssModsFile, { encoding: 'utf8' });
  const lines = data.split(/\n\r/);
  const lineIndex = lines.findIndex(line => line.includes(`${folderId} = 1`));
  if (lineIndex !== - 1) {
    lines.splice(lineIndex, 1);
    await fs.writeFileAsync(ue4ssModsFile, lines.join('\n'), { encoding: 'utf8' });
  }
}

export async function ensureModsFile(api: types.IExtensionApi): Promise<string> {
  const state = api.getState();
  const discovery: IDiscoveryResult = selectors.discoveryByGame(state, GAME_ID);
  if (discovery?.path === undefined) {
    throw new util.NotFound(GAME_ID);
  }
  const modsFilePath = resolveUE4SSModsFilePath(api);
  const exists = await fs.statAsync(modsFilePath).then(() => true).catch(() => false);
  if (!exists) {
    const relPathOfModsFile = path.relative(discovery.path, modsFilePath);
    const staging = selectors.installPathForGame(state, GAME_ID);
    const modsFileBackup = path.join(staging, path.dirname(relPathOfModsFile), MODS_FILE_BACKUP);
    await fs.copyAsync(modsFileBackup, modsFilePath);
  }

  return modsFilePath;
}

