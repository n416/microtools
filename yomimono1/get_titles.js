import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sortEpisodes } from './episode_sequence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.join(__dirname, 'public', 'settings');
const files = fs.readdirSync(targetDir).filter(f => (f.startsWith('ep') || f.startsWith('prologue') || f.startsWith('lore')) && f.endsWith('.mdx'));

files.sort(sortEpisodes);

files.forEach(file => {
    const content = fs.readFileSync(path.join(targetDir, file), 'utf8');
    const lines = content.split('\n');
    let title = '(no title)';
    for (const line of lines) {
        if (line.startsWith('# ')) {
            title = line;
            break;
        }
    }
    console.log(`${file}: ${title}`);
});
