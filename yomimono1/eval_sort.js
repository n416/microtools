import fs from 'fs';
import path from 'path';
import { sortEpisodes } from './episode_sequence.js';

try {
    const targetDir = path.resolve('./public/settings');
    const files = fs.readdirSync(targetDir)
        .filter(f => (f.startsWith('ep') || f.startsWith('prologue') || f.startsWith('lore')) && f.endsWith('.mdx'))
        .map(f => f.replace('.mdx', ''));

    files.sort((a, b) => sortEpisodes(a + '.mdx', b + '.mdx'));

    fs.writeFileSync('eval_out.txt', files.join('\n'));
} catch (e) {
    fs.writeFileSync('eval_error.txt', e.stack);
}
