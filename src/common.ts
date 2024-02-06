/* eslint-disable */
import path from 'path';
import { types } from 'vortex-api';
import { IPluginRequirement } from './types';
import { findDownloadIdByFile, findModByFile, resolveVersionByPattern, findDownloadIdByPattern } from './util';

export const NAMESPACE = 'game-palworld';

export const NOTIF_ID_BP_MODLOADER_DISABLED = 'notif-palworld-bp-modloader-disabled';
export const NOTIF_ID_REQUIREMENTS = 'palworld-requirements-download-notification';

export const DEFAULT_EXECUTABLE = 'Palworld.exe'; // path to executable, relative to game root
export const XBOX_EXECUTABLE = 'gamelaunchhelper.exe';

export const NS = 'game-palworld';
export const GAME_ID = 'palworld';
export const XBOX_ID = 'PocketpairInc.Palworld';
export const STEAMAPP_ID = '1623730';

export const UE4SS_PATH_PREFIX = path.join('Pal', 'Binaries');
export const PAK_MODSFOLDER_PATH = path.join('Pal', 'Content', 'Paks', '~mods'); // relative to game root
export const BPPAK_MODSFOLDER_PATH = path.join('Pal', 'Content', 'Paks', 'LogicMods');

export const LUA_EXTENSIONS = ['.lua'];
export const PAK_EXTENSIONS = ['.pak', '.utoc', '.ucas'];
export const IGNORE_CONFLICTS = ['ue4sslogicmod.info', '.ue4sslogicmod', '.logicmod'];

export const UE4SS_ENABLED_FILE = 'enabled.txt';
export const XBOX_UE4SS_XINPUT_REPLACEMENT = 'xinput1_4.dll';
export const UE4SS_FILES = [
  'xinput1_3.dll', 'UE4SS-settings.ini',
];

export const UE_PAK_TOOL_FILES = [
  'UnrealPak.exe',
];

export const TOP_LEVEL_DIRECTORIES = [
  'Engine', 'Pal', 'Resources',
];

export const MOD_TYPE_PAK = 'palworld-pak-modtype';
export const MOD_TYPE_LUA = 'palworld-lua-modtype';
export const MOD_TYPE_BP_PAK = 'palworld-blueprint-modtype';
export const MOD_TYPE_UNREAL_PAK_TOOL = 'palworld-unreal-pak-tool-modtype';

export type PakModType = 'palworld-pak-modtype' | 'palworld-blueprint-modtype';

export const UE4SS_XINPUT_FILENAME = 'UE4SS_v3.0.0.zip';
export const UE4SS_DWMAPI = 'dwmapi.dll';
export const UE_PAK_TOOL_FILENAME = 'UnrealPakTool.zip';

export const PLUGIN_REQUIREMENTS: IPluginRequirement[] = [
  {
    archiveFileName: UE4SS_XINPUT_FILENAME,
    modType: '',
    assemblyFileName: UE4SS_DWMAPI,
    userFacingName: 'UE4 Scripting System',
    githubUrl: 'https://api.github.com/repos/UE4SS-RE/RE-UE4SS',
    findMod: (api: types.IExtensionApi) => findModByFile(api, '', UE4SS_FILES[1]),
    findDownloadId: (api: types.IExtensionApi) => findDownloadIdByPattern(api, PLUGIN_REQUIREMENTS[0]),
    fileArchivePattern: new RegExp(/^UE4SS.*v(\d+\.\d+\.\d+)/, 'i'),
    resolveVersion: (api: types.IExtensionApi) => resolveVersionByPattern(api, PLUGIN_REQUIREMENTS[0]),
  },
  {
    archiveFileName: UE_PAK_TOOL_FILENAME,
    modType: MOD_TYPE_UNREAL_PAK_TOOL,
    userFacingName: 'Unreal Pak Tool',
    githubUrl: 'https://api.github.com/repos/allcoolthingsatoneplace/UnrealPakTool',
    findMod: (api: types.IExtensionApi) => findModByFile(api, MOD_TYPE_UNREAL_PAK_TOOL, UE_PAK_TOOL_FILES[0]),
    findDownloadId: (api: types.IExtensionApi) => findDownloadIdByFile(api, UE_PAK_TOOL_FILENAME),
  },
]