import { types } from 'vortex-api';

import { PakModType } from './common';

export type LoadOrder = ILoadOrderEntry[];
export type EventType = 'did-deploy' | 'gamemode-activated';

export interface IPakFileInfo {
  fileName: string;
  offset: number;
  size: number;
  sha1: string;
  compression: string;
}

export interface IPakExtractionInfo {
  mountPoint: string;
  files: IPakFileInfo[];
  modType: PakModType | null;
}

export interface IGitHubRelease {
  url: string;
  html_url: string;
  id: number;
  tag_name: string;
  name: string;
  assets: IGitHubAsset[];
  prerelease: boolean;
}

export interface IGitHubAsset {
  url: string;
  id: number;
  name: string;
  label: string | null;
  state: string;
  size: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  browser_download_url: string;
  release: IGitHubRelease;
}

export interface IGithubDownload {
  fileName: string;
  url: string;
}

export type GamesMap = { [gameId: string]: ModsMap };
export type ModsMap = { [modId: string]: types.IMod };

// Subset of Vortex's IRemoveModOptions used by the removal handler. Vortex leaves
//  reason unset for direct user actions and sets one for removals it drives itself
//  (version_update, profile_replace, stop_managing_game, collection_*, health_check).
export interface IRemoveModOptions {
  reason?: string;
  willBeReplaced?: boolean;
}

export type PluginRequirements = { [storeId: string]: IPluginRequirement[] }
export interface IPluginRequirement {
  // Name of both the GitHub release asset and the local archive, matched case-insensitively.
  archiveFileName: string;
  modType: string;
  // Stable identity, stamped onto the mod as attributes.palworldRequirement.
  attributeId: string;
  // customFileName values older extension versions gave this requirement's mods.
  legacyNames?: string[];
  // File identifying this requirement inside a mod's staging folder.
  identifierFile?: string;
  userFacingName?: string;
  githubUrl?: string;
  // Matches local download archives, including Vortex-suffixed re-downloads.
  fileArchivePattern?: RegExp;
  // Enables the notify-only update check.
  notifyUpdates?: boolean;
  // Reports the requirement as satisfied without a Vortex-managed mod.
  isSatisfiedExternally?: (api: types.IExtensionApi) => Promise<boolean>;
}

export interface ISerializableData {
  // The prefix we want to add to the folder name on deployment.
  prefix: string;
}

export interface ILoadOrderEntry {
  // An arbitrary unique Id.
  id: string;

  // This property is required by the FBLO API functions.
  // This game will not be using checkboxes so we're just going to
  // assign "true" when we build the load order entry instance.
  enabled: boolean;

  // Human readable name for the mod - this is what we display to the user
  // in the load order page.
  name: string;

  // The modId as stored by Vortex in its application state. Remember, in
  //  other games, 1 modId could have several mod entries in the load order
  //  page that are tied to it. That's why we have two separate id properties.
  modId?: string;

  // Any additional data we want to store in the load order file.
  data?: ISerializableData;
}
