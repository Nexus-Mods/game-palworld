# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [0.1.3] - 2024-02-01

- Added Pak parser to better ascertain modTypes
- Added Unreal Pak Tool downloader

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