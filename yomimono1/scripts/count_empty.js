import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsDir = path.join(__dirname, '../public/settings');

let emptyCount = 0;
let fileEmptyCounts = {};

fs.readdirSync(settingsDir).filter(f => f.endsWith('.mdx')).forEach(file => {
    let lines = fs.readFileSync(path.join(settingsDir, file), 'utf8').split(/\r?\n/);
    let count = lines.filter(l => l.trim() === '').length;
    emptyCount += count;
    fileEmptyCounts[file] = count;
});
let out = `Total empty lines: ${emptyCount}\n` + JSON.stringify(fileEmptyCounts, null, 2);
fs.writeFileSync('empty_counts.txt', out);
