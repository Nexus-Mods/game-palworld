# Vortex Extension for Palworld

This is an extension for [Vortex](https://www.nexusmods.com/about/vortex/) to add support for Palworld. The [Steam](https://store.steampowered.com/app/1623730/Palworld/) and [Xbox](https://www.xbox.com/en-GB/games/store/palworld-game-preview/9NKV34XDW014) versions of Palworld are both supported, although there are differences between the two.

# Development

Clone repo and run `yarn install`

### Main Scripts

- `yarn build` will copy assets to the `/dist` folder, create the `/dist/info.json` from info within `/package.json` and pack the contents of `/dist` into `/out/palworld-x.x.x.zip`
- `yarn copyplugin` will copy contents of `/dist` to the plugins folder of the production build of Vortex. Normally located at `%APPDATA/Roaming/Vortex/plugins`
- `yarn copyplugindev` will copy contents of `/dist` to the plugins folder of the development build of Vortex. Normally located at `%APPDATA/Roaming/vortex_devel/plugins`
- `yarn buildcopydev` will build and contents of `/dist` to the plugins folder of the development build of Vortex. Normally located at `%APPDATA/Roaming/vortex_devel/plugins`

# Testing

Coming Soon

# Features

- Automatic game detection for Steam and Xbox
- Downloads and installs UE4SS if it doesn't exist
- Support for PAK mods
- Support for Lua\UE4SS mods
- Support for Blueprint\Logic mods

# Installation

This extension requires Vortex **1.9.10** or greater.

To install, click the Vortex button at the top of the [Palworld Extension page on Nexus Mods](https://www.nexusmods.com/site/mods/770), and then click Install.

You can also manually install it by click the Manual button at the top of the page and dragging it into the drop target labelled Drop File(s) in the Extensions page at the bottom right.

Afterwards, restart Vortex and you can begin installing supported Palworld mods with Vortex.

If you've already got a previous version, the extension should auto update on a Vortex restart.

# Game detection

The Palworld game extension enables Vortex to automatically locate installs from the Steam and Xbox apps.

It is also possible to manually set the game folder if the auto detection doesn't find the correct installation. A valid Palworld game folder contains:

- `Palworld.exe`

If your game lacks this file then it is likely that your installation has become corrupted somehow.

# Setup & Dependencies

There are 2 tools which are automatically downloaded and installed to help with modding this game.

- [UE4SS](https://github.com/UE4SS-RE/RE-UE4SS) - a generic mod loading and scripting system for Unreal Engine games 
- [UnrealPakTool](https://github.com/allcoolthingsatoneplace/UnrealPakTool) - enables reading of PAK file contents to help us determine what type of mod and where it needs to be deployed

# Mod Management

By default, Vortex will deploy files to the game's root folder and extracts the archive while preserving it's folder structure.

## PAK mods

If a PAK mod is detected, it's deployment folder is `\Pal\Content\Paks\~mods`.

## Lua\UE4SS mods

If a LUA mod is detected, it's deployment folder is `\Pal\Binaries\Win64\Mods`.

Starting in v0.1.5 of the Palworld Extension, Lua mods are now added to the `\Pal\Binaries\Win64\Mods\mods.txt` as the primary method for UE4SS detecting that the mod is installed and enabled.

> Previously, Vortex created an `enabled.txt` within the individual mods folder. This has since been proven to cause problems with collections and so now uses the above `mods.txt` method.

## Blueprint\Logic mods

If a Blueprint\Logic mod is detected, it's deployment folder is `\Pal\Content\Paks\LogicMods`. These mods are detected by reading the contents of the PAK file and looking at it's mount point. If this fails, then Vortex falls back to looking for the existence of a `LogicMods` folder within the archive.

## Unsupported mods

Vortex doesn't officially support managing of mods that are reshades, save game\config edits or require external tools (apart from UE4SS and UnrealPakTool). 

# Known Issues

- Due to erroneous metadata on Nexus Mods, the download file for UE4SS 3.0.0 might point to a different game and raise a notification. It is completely safe to ignore this.

# See also

- [Download the Extension (Nexus Mods)](https://www.nexusmods.com/site/mods/770)
- [Mods for Palworld (Nexus Mods)](https://www.nexusmods.com/palworld)
- [Vortex Forum (Nexus Mods)](https://forums.nexusmods.com/index.php?/forum/4306-vortex-support/)
- [Download Vortex (Nexus Mods)](https://www.nexusmods.com/about/vortex/)

# Thanks

- The [UE4SS](https://github.com/UE4SS-RE/RE-UE4SS) team for doing an amazing job.
- [UnrealPakTool](https://github.com/allcoolthingsatoneplace/UnrealPakTool) for enabling us peek inside the PAK files.
#### Palworld Modding Discord
- [Khejanin](https://github.com/Khejanin) for helping with PAK type detection. 
- Êçhëłøñ for some great deep dives into mod types and patterns.

# Changelog

Please check out [CHANGELOG.md](/CHANGELOG.md)

