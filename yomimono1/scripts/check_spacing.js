import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsDir = path.join(__dirname, '../public/settings');

let tripleCount = 0;
let doubleCount = 0;

fs.readdirSync(settingsDir).filter(f => f.endsWith('.mdx')).forEach(file => {
    let content = fs.readFileSync(path.join(settingsDir, file), 'utf8');
    // Normalize newlines
    content = content.replace(/\r\n/g, '\n');
    let triples = (content.match(/\n\n\n/g) || []).length;
    let doubles = (content.match(/\n\n/g) || []).length;
    tripleCount += triples;
    doubleCount += doubles;
});
fs.writeFileSync('spacing_counts.txt', `Triples (\\n\\n\\n): ${tripleCount}\nDoubles (\\n\\n): ${doubleCount}\n`);
