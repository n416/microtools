import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { episodeSequence } from '../episode_sequence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distSettingsDir = path.resolve(__dirname, '../dist/export_resolved_ruby_p2');

const files = episodeSequence
.map(basename => `${basename}.mdx`)
.filter(f => fs.existsSync(path.join(distSettingsDir, f)));

console.log('Final resolved files:');
console.log(files);
