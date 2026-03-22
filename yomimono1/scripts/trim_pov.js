import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const settingsDir = path.join(__dirname, '../public/settings');
const files = fs.readdirSync(settingsDir).filter(f => f.endsWith('.mdx'));

let povEmptyLinesRemoved = 0;

files.forEach(file => {
    const filePath = path.join(settingsDir, file);
    let originalLines = fs.readFileSync(filePath, 'utf8').split('\n');
    let newLines = [];

    for (let i = 0; i < originalLines.length; i++) {
        const line = originalLines[i];
        
        // Check if the previous line was a POV header
        if (line.trim() === '' && i > 0) {
            const prevLine = originalLines[i-1].trim();
            if (prevLine.startsWith('【') && prevLine.endsWith('視点】')) {
                povEmptyLinesRemoved++;
                continue; // Skip this blank line
            }
        }
        
        newLines.push(line);
    }
    
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
});

console.log(`Removed ${povEmptyLinesRemoved} empty lines after POV headers.`);
