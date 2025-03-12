/* eslint-disable */
import https from 'https';
import fs from 'fs';
import path from 'path';
import ini from 'ini';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = 'https://raw.githubusercontent.com/UE4SS-RE/RE-UE4SS/main/assets/MemberVarLayoutTemplates/MemberVariableLayout_5_01_Template.ini';
const outputPath = path.join(__dirname, 'src', 'assets', 'MemberVariableLayout_5_01_Template.ini');
if (fs.existsSync(outputPath)) {
  console.log('File already exists. Skipping download.');
} else {
  https.get(url, (response) => {
    if (response.statusCode === 200) {
      const file = fs.createWriteStream(outputPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Download completed.');
        generateMemberVariableLayout();
      });
    } else {
      console.log(`Failed to download file: ${response.statusCode}`);
    }
  }).on('error', (err) => {
    console.error(`Error: ${err.message}`);
  });
}

const generateMemberVariableLayout = () => {
  fs.readFile(outputPath, 'utf-8', (err, data) => {
    if (err) {
      console.error(`Error reading file: ${err.message}`);
      return;
    }
  
    const config = ini.parse(data);
    const uEnumSection = {
      CppForm: '0x58',
      CppType: '0x30',
      EnumDisplayNameFn: '0x60',
      EnumFlags_Internal: '0x5C',
      EnumPackage: '0x68',
      Names: '0x48'
    };
  
    let needsUpdate = false;
    if (!config.UEnum) {
      config.UEnum = uEnumSection;
      needsUpdate = true;
    } else {
      for (const key in uEnumSection) {
        if (config.UEnum[key] !== uEnumSection[key]) {
          config.UEnum[key] = uEnumSection[key];
          needsUpdate = true;
        }
      }
    }
  
    if (needsUpdate) {
      const newOutputPath = path.join(__dirname, 'src', 'assets', 'MemberVariableLayout.ini');
      fs.writeFile(newOutputPath, ini.stringify(config), (err) => {
        if (err) {
          console.error(`Error writing file: ${err.message}`);
        } else {
          console.log('File updated and saved as MemberVariableLayout.ini');
        }
      });
    } else {
      console.log('No updates needed.');
    }
  });
};