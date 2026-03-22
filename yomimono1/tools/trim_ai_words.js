import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directoryPath = path.join(__dirname, 'public', 'settings');
const mdxFiles = fs.readdirSync(directoryPath).filter(file => file.endsWith('.mdx') && file.startsWith('ep'));

let log = `Files found: ${mdxFiles.length}\n`;
if (mdxFiles.length > 0) {
    const content = fs.readFileSync(path.join(directoryPath, mdxFiles[0]), 'utf8');
    log += `File 0 length: ${content.length}\n`;
    log += `Match test: ${/静かに/g.test(content)}\n`;
}

fs.writeFileSync(path.join(__dirname, 'trim_results.txt'), log, 'utf8');
