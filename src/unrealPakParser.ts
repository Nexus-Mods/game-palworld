/* eslint-disable */
import * as child_process from 'child_process';
import * as path from 'path';
import { log, types, util } from 'vortex-api'

import { MOD_TYPE_BP_PAK, MOD_TYPE_PAK, UE_PAK_TOOL_FILES } from './common';
import { IPakExtractionInfo } from './types';
import { formatBytes, resolveUnrealPakToolPath } from './util';

const DEFAULT_BLUEPRINT_SEGMENT = 'mods';
const INCREASED_MAX_BUFFER_SIZE = 1024 * 1024 * 10; // 10MB - default is 1MB, max we've come across as needing is 4MB

function normalizePath(filePath: string): string {
  const trimmed = filePath.replace(/\//g, path.sep);

  // Not sure why path normalize doesn't work here
  // const normaltest = path.normalize(trimmed);

  let normal: string[] = [];
  const segments = trimmed.split(path.sep);
  for (const segment of segments) {
    if (segment !== '..' && segment !== '.') {
      normal.push(segment);
    }
  }
  return normal.join(path.sep);
}

function parsePakListLog(logText: string): IPakExtractionInfo | null {
  const lines = logText.split('\n');
  const extractionInfo: IPakExtractionInfo = {
    mountPoint: '',
    files: [],
    modType: null,
  };

  let mountPointSegments: string[] = [];
  for (const line of lines) {
    if (line.startsWith('LogPakFile: Display: Mount point')) {
      const mountPoint: string = line.split('Mount point')[1].trim();
      if (mountPoint) {
        const normalMount = normalizePath(mountPoint);
        extractionInfo.mountPoint = normalMount;
        mountPointSegments = normalMount.split(path.sep).map(segment => segment.toLowerCase());
      }
    } else if (line.startsWith('LogPakFile: Display: "')) {
      const fileInfo = line.match(/"([^"]+)".*offset: (\d+), size: (\d+) bytes, sha1: ([^,]+), compression: ([^\.]+)/);
      if (fileInfo && fileInfo.length === 6) {
        const [_, fileName, offset, size, sha1, compression] = fileInfo;
        const normalFileName = normalizePath(fileName);
        const fileNameSegments = normalFileName.split(path.sep).map(segment => segment.toLowerCase());
        const hasModsSegment = fileNameSegments.includes(DEFAULT_BLUEPRINT_SEGMENT) || mountPointSegments.includes(DEFAULT_BLUEPRINT_SEGMENT);
        if (!extractionInfo.modType && hasModsSegment) {
          extractionInfo.modType = MOD_TYPE_BP_PAK;
        }
        extractionInfo.files.push({
          fileName,
          offset: parseInt(offset),
          size: parseInt(size),
          sha1,
          compression,
        });
      }
    }
  }

  // If no files were found, return null
  if (extractionInfo.files.length === 0) {
    return null;
  }

  if (!extractionInfo.modType) {
    // If no mod type was found, assume it's a PAK
    extractionInfo.modType = MOD_TYPE_PAK;
  }

  return extractionInfo;
}

export async function listPak(api: types.IExtensionApi, filePath: string, execOptions?: child_process.ExecOptions): Promise<IPakExtractionInfo | null> {
  const unrealPakToolToolPath = await resolveUnrealPakToolPath(api);
  if (!unrealPakToolToolPath) {
    return Promise.reject(new util.NotFound('UnrealPakTool'));
  }
  const execPath = path.join(unrealPakToolToolPath, 'UnrealPakTool', UE_PAK_TOOL_FILES[0]);
  const command = `"${execPath}" "${filePath}" -list`;
  return new Promise<IPakExtractionInfo | null>((resolve, reject) => {
    child_process.exec(command, execOptions, async (error, stdout, stderr) => {
      if (error) {
        log('error', `Error listing ${filePath}: ${error.message}`);

        // if max buffer error, try again with a new max buffer size
        if(error.code.toString() === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {          

          // if we've already tried again with a larger buffer, give up
          if(execOptions !== undefined) {
            log('error', `Already tried again with a larger buffer, giving up.`);
            return reject(new Error(error.message))              
          }        

          log('info', `Trying again with an increased buffer size (${formatBytes(INCREASED_MAX_BUFFER_SIZE)}) ${filePath}`);
          // try again with 10mb buffer
          try {
            const res = await listPak(api, filePath, {maxBuffer: INCREASED_MAX_BUFFER_SIZE}); 
            return resolve(res);   
          } catch (err) {
            return reject(err);
          }
        }

        return reject(new Error(error.message));
      }
      if (stderr) {
        log('error', `Error listing ${filePath}: ${stderr}`);
        return reject(new Error(stderr));
      }
      if (stdout) {
        const result = parsePakListLog(stdout);
        return resolve(result);
      }
    });
  })
}

// const paks: { [modType: string]: string } = {};
// export async function listPakFiles(api: types.IExtensionApi, directory: string): Promise<PakModType | null> {
//   let files: string[] = [];
//   try {
//     files = await fs.readdirAsync(directory).filter(file => path.extname(file) === PAK_EXTENSIONS[0]);
//     for (const file of files) {
//       const filePath = path.join(directory, file);
//       const listResult: IPakExtractionInfo | null = await listPak(filePath);
//       if (listResult?.modType) {
//         paks[listResult.modType] = filePath;
//       }
//     }
//     if (Object.keys(paks).length > 1) {
//       // We expect only one modType as a result of this action.
//       //  Yet the paks included in this mod have different modTypes.
//       // TODO: handle this case in the UI.
//       api.showErrorNotification('Error listing pak file contents', 'The paks included in this mod have different modTypes.', { allowReport: false });
//       return null;
//     }

//     return Object.keys(paks)[0] as PakModType;
//   } catch (err) {
//     api.showErrorNotification('Error listing pak file contents', err);
//   }

//   return null;
// }

// for (const ModFile of LogicModsDir.__files) {
//   const ModName: string = ModFile.__name;
//   const ModNameNoExtension: string | null = ModName.match("(.+)%..+$")?.[1];
//   const FileExtension: string | null = ModName.match("^.+(%..+)$")?.[1];

//   if (FileExtension === ".pak" && !Mods[ModNameNoExtension as string]) {
//     Mods[ModNameNoExtension as string] = {
//       AssetName: DefaultModConfig.AssetName,
//       AssetNameAsFName: DefaultModConfig.AssetNameAsFName,
//       AssetPath: `/Game/Mods/${ModNameNoExtension}/ModActor`
//     };
//   }
// }