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

# Mod Management

By default, Vortex will deploy files to the game's root folder and extracts the archive while preserving it's folder structure.

## PAK mods

If a PAK mod is detected, it's deployment folder is `\Pal\Content\Paks\~mods`.

## Lua\UE4SS mods

If a LUA mod is detected, it's deployment folder is `\Pal\Content\Paks\LogicMods`.

LUA mods are only detected by UE4SS if they contain an `enabled.txt` file in the mods root folder. For example, if `\Pal\Binaries\Win64\Mods\<MODFOLDER>\enabled.txt` doesn't exist, then it won't be loaded by UE4SS. Vortex does create this file if it doesn't exist during mod deployment.

> Lua mods can also be detected by UE4SS if it has an entry in it's `\Pal\Binaries\Win64\Mods\mods.txt` file but it's more complicated for Vortex to manage this file and so the existence of `enabled.txt` is the better solution.

## Blueprint\Logic mods

If a Blueprint\Logic mod is detected, it's deployment folder is `\Pal\Binaries\Win64\Mods`.

## Unsupported mods

Vortex doesn't officially support managing of mods that are reshades, save game\config edits or require external tools (apart from UE4SS). 

# See also

- [Download the Extension (Nexus Mods)](https://www.nexusmods.com/site/mods/770)
- [Mods for Palworld (Nexus Mods)](https://www.nexusmods.com/palworld)
- [Vortex Forum (Nexus Mods)](https://forums.nexusmods.com/index.php?/forum/4306-vortex-support/)
- [Download Vortex (Nexus Mods)](https://www.nexusmods.com/about/vortex/)

# Thanks

To all those that work on [UE4SS](https://github.com/UE4SS-RE/RE-UE4SS), you are doing an epic job.

# Changelog

Please check out [CHANGELOG.md](/CHANGELOG.md)
