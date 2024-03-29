# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [0.1.8] - 2024-02-27

- Improved UE4SS test to ensure mods.txt.original is present (will inform user of corrupted UE4SS installation)

## [0.1.7] - 2024-02-20

- If PAK reading fails due to max buffer exceeded, it is retried with a larger buffer 
- Fix for false error when installing mods with a decimal point in the name  
- Fix for UnrealPak not being found when staging folder has whitespace in it's path  

## [0.1.6] - 2024-02-19

- Fixed mods.txt file addition/removal error notifications being suppressed

## [0.1.5] - 2024-02-07

- Added a root mod installer for mods that contain a valid folder structure resembling the game.
- Added "enabled.txt" to the ignore conflict list
- Added new LUA modType which deploys to the root folder of UE4SS
- LUAs are now added/removed from the mods.txt file upon mod installation/removal
- Added 'Open...' menu entries for the different root folders

## [0.1.4] - 2024-02-05

- Updated for UE4SS 3.0.0
- Added ability to check for UE4SS updates using the check for updates button in the mods page.
- Fixed attempts to re-download UE4SS on start-up and on deployment events.
- Fixed attempts to re-download UE4SS when running the bpmodloader tests.

## [0.1.3] - 2024-02-01

- Added Pak parser to better ascertain modTypes
- Added Unreal Pak Tool downloader
- Fixed attempts to re-download UE4SS and Unreal Pak Tool when mod is uninstalled (but archive still exists)

## [0.1.2] - 2024-01-31

- Added test to ensure that bUseUObjectArrayCache is set to false regardless of game store (on extension activation).
- Modified UE4SS installer to disable the ObjectArrayCache on scripting system installation.

## [0.1.1] - 2024-01-26

- Added support for Blueprint mods which are deployed into ../Paks/LogicMods/
- Added test to ensure that BPModLoader is enabled
- Added test to ensure that UE4SS is installed and deployed after every deployment event
- Fixed UE4SS downloader not waiting for the file to get fully downloaded and imported
- Fixed other minor issues

## [0.1.0] - 2024-01-23

- Initial version
- Supports Steam and Game Pass
- Supports Pak and Lua\UE4SS mods
- Auto downloads and installs UE4SS