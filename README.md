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

- 

# Installation

This extension requires Vortex **1.9.10** or greater.

To install, click the Vortex button at the top of the [Palworld Extension page on Nexus Mods](https://www.nexusmods.com/site/mods/xxx), and then click Install.

You can also manually install it by click the Manual button at the top of the page and dragging it into the drop target labelled Drop File(s) in the Extensions page at the bottom right.

Afterwards, restart Vortex and you can begin installing supported Palworld mods with Vortex.

If you've already got a previous version, the extension should auto update on a Vortex restart.

# Game detection

The Palworld game extension enables Vortex to automatically locate installs from the Steam and Xbox apps.

It is also possible to manually set the game folder if the auto detection doesn't find the correct installation. A valid Palworld game folder contains:

- `Palworld.exe`

If your game lacks this file then it is likely that your installation has become corrupted somehow.

## Important note if managing the game through xbox game pass:

Currently the game discovery will resolve to the game's default `WindowsApps` location - Vortex's access to this directory is very limited due to the game store locking the files in a system owned virtual file system. As a workaround, please install the game into an external location, e.g. `C:/XboxGames/` and manually set the game folder inside Vortex to the `C:\XboxGames\Palworld` folder. You should then be able to create the folder junction and mod your game.

# Mod Management

By default, Vortex will deploy files to the game's `/Pal/content/Pak` folder and extracts the archive while preserving the folder structure.

# Known Issues

- 

# See also

- [Download the Extension (Nexus Mods)](https://www.nexusmods.com/site/mods/xxx)
- [Mods for Palworld (Nexus Mods)](https://www.nexusmods.com/palworld)
- [Vortex Forum (Nexus Mods)](https://forums.nexusmods.com/index.php?/forum/4306-vortex-support/)
- [Download Vortex (Nexus Mods)](https://www.nexusmods.com/about/vortex/)

# Thanks

- 

# Changelog

Please check out [CHANGELOG.md](/CHANGELOG.md)
