/* eslint-disable */
import path from 'path';
import { fs, log, types, selectors } from 'vortex-api';

import { GAME_ID, NAMESPACE, NOTIF_ID_BP_MODLOADER_DISABLED, PLUGIN_REQUIREMENTS, UE4SS_ENABLED_FILE, UE4SS_FILES } from './common';
import { EventType } from './types';
import { findModByFile, resolveUE4SSPath } from './util';
import { download } from './downloader';

export async function testBluePrintModManager(api: types.IExtensionApi, eventType: EventType): Promise<void> {
  const state = api.getState();
  if (selectors.activeGameId(state) !== GAME_ID) {
    return;
  }

  let ue4ssMod = await findModByFile(api, '', UE4SS_FILES[1]);
  if (eventType === 'gamemode-activated') {
    // It's possible that the ue4ssMod didn't have a chance to install yet.
    //  Especially if the user just started to mod the game.
    if (ue4ssMod === undefined) {
      return;
    }
    // Make sure we disable the array cache.
    await api.emitAndAwait('deploy-single-mod', GAME_ID, ue4ssMod.id, false);
    await disableArrayCache(api, ue4ssMod);
    await api.emitAndAwait('deploy-single-mod', GAME_ID, ue4ssMod.id);
    return;
  } else {
    await download(api, PLUGIN_REQUIREMENTS);
    ue4ssMod = await findModByFile(api, '', UE4SS_FILES[1]);
  }

  const ue4ssRelPath = resolveUE4SSPath(api);
  const installPath = selectors.installPathForGame(state, GAME_ID);
  const ue4ssInstallPath = path.join(installPath, ue4ssMod.installationPath);
  const bpModLoaderPath = path.join(ue4ssInstallPath, ue4ssRelPath, 'Mods', 'BPModLoaderMod');
  const modLoaderExists = await fs.statAsync(bpModLoaderPath).then(() => true).catch(() => false);
  if (!modLoaderExists) {
    await reinstallUE4SS(api, ue4ssMod, bpModLoaderPath);
    return;
  }

  // It's better UX if we just enable the BPModLoader at this point - less hassle for the user.
  await enableBPModLoader(api, ue4ssMod, bpModLoaderPath);
  return;
}

async function reinstallUE4SS(api: types.IExtensionApi, ue4ssMod: types.IMod, bpModLoaderPath: string): Promise<void> {
  const autoFix = async () => {
    try {
      await download(api, PLUGIN_REQUIREMENTS, true);
      await enableBPModLoader(api, ue4ssMod, bpModLoaderPath);
    } catch (err) {
      api.showErrorNotification('Failed to re-install UE4SS', err);
      return;
      // return reinstallUE4SS(api, ue4ssMod, bpModLoaderPath);
    }
    return Promise.resolve();
  };
  const t = api.translate;
  api.sendNotification({
    message: 'UE4SS missing or corrupted',
    type: 'warning',
    actions: [
      { 
        title: 'More',
        action: (dismiss) => {
          api.showDialog('question', 'Re-install UE4SS', {
            bbcode: t('Unreal Engine 4 Scripting System (UE4SS) is required for many mods that are hosted on the website. Vortex can try to re-download and re-install the mod loader for you.[br][/br][br][/br]'
                    + 'Please click on Download to proceed.', { ns: NAMESPACE }),
          },
          [
            {
              label: 'Download',
              action: async () => {
                await autoFix();
                dismiss();
              },
              default: true,
            },
            { label: 'Close' },
          ])
        }
      },
      {
        title: 'Fix',
        action: async (dismiss) => {
          await autoFix();
          dismiss();
        }
      }
    ],
    allowSuppress: false,
    noDismiss: true,
    id: NOTIF_ID_BP_MODLOADER_DISABLED,
  });
}

async function enableBPModLoader(api: types.IExtensionApi, ue4ssMod: types.IMod, bpModLoaderPath: string): Promise<void> {
  const enabledFilePath = path.join(bpModLoaderPath, UE4SS_ENABLED_FILE);
  const exists = await fs.statAsync(enabledFilePath).then(() => true).catch(() => false);
  if (exists) {
    return;
  }
  // Make sure we remove the mod before proceeding.
  try {
    await api.emitAndAwait('deploy-single-mod', GAME_ID, ue4ssMod.id, false);
    await fs.writeFileAsync(enabledFilePath, '', { encoding: 'utf8' });
    await disableArrayCache(api, ue4ssMod);
  } catch (err) {
    api.showErrorNotification('Failed to enable BPModLoader', 'Please ensure that UE4SS\'s BPModLoader is enabled manually', { allowReport: false });
    return Promise.resolve();
  } finally {
    await api.emitAndAwait('deploy-single-mod', GAME_ID, ue4ssMod.id);
  }
}

async function disableArrayCache(api: types.IExtensionApi, ue4ssMod: types.IMod) {
  const state = api.getState();
  const stagingFolder = selectors.installPathForGame(state, GAME_ID);
  const modPath = path.join(stagingFolder, ue4ssMod.installationPath);
  const ue4ssRelPath = resolveUE4SSPath(api);
  const ue4ssConfigPath = path.join(modPath, ue4ssRelPath, UE4SS_FILES[1]);
  const data: string = await fs.readFileAsync(ue4ssConfigPath, { encoding: 'utf8' });
  const newData = data.replace(/bUseUObjectArrayCache = true/gm, 'bUseUObjectArrayCache = false');
  await fs.removeAsync(ue4ssConfigPath).catch(err => null);
  await fs.writeFileAsync(ue4ssConfigPath, newData, { encoding: 'utf8' });
}