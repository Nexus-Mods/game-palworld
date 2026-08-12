/* eslint-disable */
import path from 'path';
import { IPluginRequirement } from './types';
import { isUE4SSDeployedUnmanaged } from './util';

export const NAMESPACE = 'game-palworld';

export const NOTIF_ID_BP_MODLOADER_DISABLED = 'notif-palworld-bp-modloader-disabled';
export const NOTIF_ID_REQUIREMENTS = 'palworld-requirements-download-notification';
export const NOTIF_ID_UE4SS_UPDATE = 'palworld-ue4ss-version-update';
export const NOTIF_ID_REQUIREMENTS_OPTOUT = 'palworld-requirements-optout';
export const NOTIF_ID_REQUIREMENTS_DUPLICATES = 'palworld-requirements-duplicates';

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
export const CPPMOD_EXTENSIONS = ['.dll'];
export const PAK_EXTENSIONS = ['.pak', '.utoc', '.ucas'];

export const MODS_FILE = 'mods.txt';
export const MODS_FILE_BACKUP = 'mods.txt.original';
export const UE4SS_ENABLED_FILE = 'enabled.txt';

export const IGNORE_CONFLICTS = [UE4SS_ENABLED_FILE, 'ue4sslogicmod.info', '.ue4sslogicmod', '.logicmod'];
export const IGNORE_DEPLOY = [MODS_FILE, MODS_FILE_BACKUP, UE4SS_ENABLED_FILE];

export const UE4SS_DWMAPI = 'dwmapi.dll';
export const XBOX_UE4SS_XINPUT_REPLACEMENT = 'xinput1_4.dll';
export const UE4SS_MEMBER_VARIABLE_LAYOUT_FILE = 'MemberVariableLayout.ini';
export const UE4SS_SETTINGS_FILE = 'UE4SS-settings.ini';
export const UE4SS_2_5_2_FILES = ['xinput1_3.dll', UE4SS_SETTINGS_FILE];
export const UE4SS_3_0_0_FILES = [UE4SS_DWMAPI, UE4SS_SETTINGS_FILE];

// Core UE4SS assembly and the folder the payload is nested under.
export const UE4SS_DLL = 'UE4SS.dll';
export const UE4SS_FOLDER = 'ue4ss';

// Any of these present in an archive marks it as a UE4SS installation.
export const UE4SS_IDENTIFIERS = [UE4SS_SETTINGS_FILE, UE4SS_DLL, UE4SS_DWMAPI].map(f => f.toLowerCase());

// Proxy loaders that sit next to the game executable rather than under "ue4ss".
export const UE4SS_LOADER_FILES = [UE4SS_DWMAPI.toLowerCase(), 'xinput1_3.dll'];

// Captures the version from a UE4SS folder name, e.g.
//    "UE4SS_v3.0.1"                -> 3.0.1
//    "UE4SS_v3.0.1-1011-gb50986bd" -> 3.0.1-1011-gb50986bd
export const UE4SS_VERSION_PATTERN = /v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?)/i;

export const UE_PAK_TOOL_FILES = [
  'UnrealPak.exe',
];

export const TOP_LEVEL_DIRECTORIES = [
  'Engine', 'Pal', 'Resources',
];

export const MOD_TYPE_PAK = 'palworld-pak-modtype';
export const MOD_TYPE_LUA = 'palworld-lua-modtype';
export const MOD_TYPE_LUA_V2 = 'palworld-lua-modtype-v2';
export const MOD_TYPE_CPP = 'palworld-cpp-modtype';
export const MOD_TYPE_BP_PAK = 'palworld-blueprint-modtype';
export const MOD_TYPE_UNREAL_PAK_TOOL = 'palworld-unreal-pak-tool-modtype';
export const MOD_TYPE_PALSCHEMA_FRAMEWORK = 'palworld-palschema-framework-modtype';
export const MOD_TYPE_PALSCHEMA_SUBMODULE = 'palworld-palschema-submodule-modtype';
export const MOD_TYPE_PALSCHEMA_SUBMODULE_PAK = 'palworld-palschema-submodule-pak-modtype';

// The data folders a PalSchema submodule can contain. PalSchema applies different logic
//  based on the subfolder name, and each of its loaders declares the folder it handles by
//  passing it to PalModLoaderBase - see src/Loader/Pal*ModLoader.cpp in
//  https://github.com/Okaetsu/PalSchema. Keep this in sync with that set; a submodule using
//  only folders absent from this list won't be detected.
export const PALSCHEMA_SUBMODULE_FOLDERS = [
  'appearance', 'blueprints', 'buildings', 'enums', 'helpguide', 'items', 'npcs',
  'pals', 'raw', 'resources', 'skins', 'spawns', 'translations',
];

// The only file types PalSchema parses; everything else in a mod folder is inert to it.
export const PALSCHEMA_DATA_EXTENSIONS = ['.json', '.jsonc'];

export type PakModType = 'palworld-pak-modtype' | 'palworld-blueprint-modtype';

export const UE4SS_FILENAME = 'UE4SS-Palworld.zip';
export const UE_PAK_TOOL_FILENAME = 'UnrealPakTool.zip';
export const REQUIREMENT_UE4SS = 'ue4ss';
export const REQUIREMENT_PAK_TOOL = 'unrealpaktool';
export const PLUGIN_REQUIREMENTS: IPluginRequirement[] = [
  {
    archiveFileName: UE4SS_FILENAME,
    modType: '',
    attributeId: REQUIREMENT_UE4SS,
    legacyNames: ['UE4 Scripting System'],
    identifierFile: UE4SS_SETTINGS_FILE,
    userFacingName: 'UE4SS (Okaetsu RE-UE4SS)',
    githubUrl: 'https://api.github.com/repos/Okaetsu/RE-UE4SS',
    notifyUpdates: true,
    isSatisfiedExternally: (api) => isUE4SSDeployedUnmanaged(api),
    // Matches the Okaetsu release asset (and Vortex-suffixed re-downloads of it) while
    //  rejecting the UE4SS-Palworld_zDev.zip dev build.
    fileArchivePattern: new RegExp(/^UE4SS-Palworld(?!_zDev).*\.zip$/, 'i'),
  },
  {
    archiveFileName: UE_PAK_TOOL_FILENAME,
    modType: MOD_TYPE_UNREAL_PAK_TOOL,
    attributeId: REQUIREMENT_PAK_TOOL,
    identifierFile: UE_PAK_TOOL_FILES[0],
    userFacingName: 'Unreal Pak Tool',
    githubUrl: 'https://api.github.com/repos/allcoolthingsatoneplace/UnrealPakTool',
    fileArchivePattern: new RegExp(/^UnrealPakTool.*\.zip$/, 'i'),
  },
]

export function getRequirement(attributeId: string): IPluginRequirement {
  return PLUGIN_REQUIREMENTS.find(req => req.attributeId === attributeId);
}