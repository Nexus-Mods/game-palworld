/* eslint-disable */
import path from 'path';
import { types, selectors, fs, util } from 'vortex-api';
import { MODS_FILE, GAME_ID, PLUGIN_REQUIREMENTS, MODS_FILE_BACKUP } from './common';
import { resolveUE4SSPath } from './util';

export async function onAddMod(api: types.IExtensionApi, modId: string) {
  try {
    await ensureModsFileEntryAdded(api, modId);
  } catch (err) {
    api.showErrorNotification('Failed to add mod to mods file', err);
  }
}

export async function onRemoveMod(api: types.IExtensionApi, modId: string) {
  try {
    await ensureModsFileEntryRemoved(api, modId);
  } catch (err) {
    api.showErrorNotification('Failed to remove mod from mods file', err);
  }
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function ensureModsFileEntryAdded(api: types.IExtensionApi, modId: string) {
  let ue4ssModsFile;
  try {
    ue4ssModsFile = await ensureModsFile(api);
  } catch (err) {
    if (err instanceof util.NotFound) {
      // If UE4SS isn't installed - there's not much we can do.
      return;
    }
    throw err;
  }
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const mod = mods[modId];
  if (!mod) {
    throw new util.NotFound(modId);
  }
  const folderId = mod.attributes?.palworldFolderId ?? mod.installationPath;
  const data = await fs.readFileAsync(ue4ssModsFile, { encoding: 'utf8' });
  const eol = data.includes('\r\n') ? '\r\n' : '\n';
  const lines: string[] = data.split(/\r?\n/);
  
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  const entryRegex = new RegExp(`^\\s*${escapeRegExp(folderId)}\\s*:\\s*[01]`, 'i');
  const lineIndex = lines.findIndex(line => entryRegex.test(line));
  if (lineIndex !== -1) {
    lines[lineIndex] = `${folderId} : 1`;
  } else {
    lines.push(`${folderId} : 1`);
  }
  lines.push('');
  await fs.writeFileAsync(ue4ssModsFile, lines.join(eol), { encoding: 'utf8' });
  return;
}

// Obviously ensure you call this function while the mod entry is still installed!!
export async function ensureModsFileEntryRemoved(api: types.IExtensionApi, modId: string) {
  // regardless of what happens next, the mods file needs to be updated.
  let ue4ssModsFile;
  try {
    ue4ssModsFile = await ensureModsFile(api);
  } catch (err) {
    if (err instanceof util.NotFound) {
      // If UE4SS isn't installed - there's not much we can do.
      return;
    }
    throw err;
  }
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
  const eol = data.includes('\r\n') ? '\r\n' : '\n';
  const lines: string[] = data.split(/\r?\n/);

  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  const entryRegex = new RegExp(`^\\s*${escapeRegExp(folderId)}\\s*:\\s*[01]`, 'i');
  const lineIndex = lines.findIndex(line => entryRegex.test(line));
  if (lineIndex !== -1) {
    lines.splice(lineIndex, 1);
    if (lines.length > 0) {
      lines.push('');
    }
    await fs.writeFileAsync(ue4ssModsFile, lines.join(eol), { encoding: 'utf8' });
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

