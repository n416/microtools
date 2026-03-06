import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CharacterNames } from './src/character_dictionary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directoryPath = path.join(__dirname, 'public', 'settings');

function resolveCharacters(text) {
  return text.replace(/<Char\s+role="([^"]+)"(?:\s+callrole="([^"]+)")?\s+var="([^"]+)"\s*\/>/g, (match, role, callrole, variant) => {
    const charData = CharacterNames[role];
    if (!charData) return `[Unknown Char: ${role}]`;

    if (variant === 'furigana' || variant === 'age') {
      return charData[variant] || `[Unknown Prop: ${variant}]`;
    }

    if (callrole) {
      if (charData.callers?.[callrole]?.[variant]) {
        return charData.callers[callrole][variant];
      }
      if (charData.callers?.system?.[variant]) {
        return charData.callers.system[variant];
      }
      return `[Unknown Var: ${role}/${callrole} or system/${variant}]`;
    }

    return `[Missing CallRole: ${role}]`;
  });
}

function processDirectory(dirPath) {
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      console.error("Could not list the directory.", err);
      process.exit(1);
    }

    files.forEach((file) => {
      const filePath = path.join(dirPath, file);

      fs.stat(filePath, (error, stat) => {
        if (error) {
          console.error("Error stating file.", error);
          return;
        }

        if (stat.isFile() && filePath.endsWith('.mdx')) {
          fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
              console.error(`Error reading file ${filePath}`, err);
              return;
            }

            const resolvedData = resolveCharacters(data);

            if (data !== resolvedData) {
              fs.writeFile(filePath, resolvedData, 'utf8', (err) => {
                if (err) {
                  console.error(`Error writing file ${filePath}`, err);
                } else {
                  console.log(`Successfully processed ${file}`);
                }
              });
            } else {
              console.log(`No changes needed for ${file}`);
            }
          });
        }
      });
    });
  });
}

console.log('Starting conversion of MDX character tags...');
processDirectory(directoryPath);
