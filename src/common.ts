import path from 'path';
import { util } from 'vortex-api';

export const EXECUTABLE = "Palworld.exe"; // path to executable, relative to game root

export const NS = 'game-palworld';
export const GAME_ID = 'palworld';
export const XBOX_ID = 'PocketpairInc.Palworld';
export const STEAMAPP_ID = '1623730';

export const MODSFOLDER_PATH = path.join("Pal", "Content", "Paks"); // relative to game root

export const PAK_EXTENSIONS = [".pak", ".utoc", ".ucas"];
export const IGNORE_CONFLICTS = ["ue4sslogicmod.info", ".ue4sslogicmod", ".logicmod"];
export const IGNORE_DEPLOY = [path.join('**', 'enabled.txt')];
export const STOP_PATTERNS = ["[^/]*\\.pak$"];