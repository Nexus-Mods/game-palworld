import path from 'path';
import { types, util } from 'vortex-api';
import { PluginRequirements } from './types';

export const EXECUTABLE = 'Palworld.exe'; // path to executable, relative to game root

export const NS = 'game-palworld';
export const GAME_ID = 'palworld';
export const XBOX_ID = 'PocketpairInc.Palworld';
export const STEAMAPP_ID = '1623730';

export const UE4SS_PATH_PREFIX = path.join('Pal', 'Binaries');
export const PAK_MODSFOLDER_PATH = path.join('Pal', 'Content', 'Paks'); // relative to game root

export const PAK_EXTENSIONS = ['.pak', '.utoc', '.ucas'];
export const IGNORE_CONFLICTS = ['ue4sslogicmod.info', '.ue4sslogicmod', '.logicmod'];
export const IGNORE_DEPLOY = [path.join('**', 'enabled.txt')];
export const STOP_PATTERNS = ['[^/]*\\.pak$'];

export const XBOX_UE4SS_XINPUT_REPLACEMENT = 'xinput1_4.dll';
export const UE4SS_FILES = [
  'xinput1_3.dll', 'UE4SS-settings.ini',
];

export const PLUGIN_REQUIREMENTS: PluginRequirements = {
  steam: [],
  xbox: [],
}