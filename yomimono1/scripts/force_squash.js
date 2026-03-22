import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const settingsDir = path.join(__dirname, '../public/settings');
const files = fs.readdirSync(settingsDir).filter(f => f.endsWith('.mdx'));

let linesRemoved = 0;
const TARGET_REDUCTIONS = 100;

files.forEach(file => {
    if (linesRemoved >= TARGET_REDUCTIONS) return;

    const filePath = path.join(settingsDir, file);
    let originalLines = fs.readFileSync(filePath, 'utf8').split('\n');
    let newLines = [];

    for (let i = 0; i < originalLines.length; i++) {
        const line = originalLines[i];
        
        // Target any pure empty lines. Skip first line and last line to be safe.
        if (line.trim() === '' && linesRemoved < TARGET_REDUCTIONS && i > 5 && i < originalLines.length - 5) {
            linesRemoved++;
            continue; 
        }
        
        newLines.push(line);
    }
    
    // Write back to file
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
});

console.log(`Force squashed ${linesRemoved} empty lines across MDX files.`);
