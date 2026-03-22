import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const settingsDir = path.join(__dirname, '../public/settings');
const files = fs.readdirSync(settingsDir).filter(f => f.endsWith('.mdx'));

let linesRemoved = 0;
const TARGET_REDUCTIONS = 300; // slightly more than the 162 gap

files.forEach(file => {
    if (linesRemoved >= TARGET_REDUCTIONS) return;

    const filePath = path.join(settingsDir, file);
    let originalLines = fs.readFileSync(filePath, 'utf8').split('\n');
    let newLines = [];

    for (let i = 0; i < originalLines.length; i++) {
        const line = originalLines[i];
        
        // Remove empty lines if we haven't hit our target yet
        if (line.trim() === '' && linesRemoved < TARGET_REDUCTIONS) {
            // Only remove empty line if the PREVIOUS line was dialogue ('」') 
            // OR if the NEXT line is dialogue ('「')
            // This safely condenses pacing gaps without breaking sections
            const prevLine = i > 0 ? originalLines[i-1].trim() : '';
            const nextLine = i < originalLines.length - 1 ? originalLines[i+1].trim() : '';
            
            if (prevLine.endsWith('」') || nextLine.startsWith('「')) {
                // Remove it by simply NOT pushing it to newLines
                linesRemoved++;
                continue; 
            }
        }
        
        newLines.push(line);
    }
    
    // Write back to file
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
});

console.log(`Squashed ${linesRemoved} empty lines across MDX files.`);
