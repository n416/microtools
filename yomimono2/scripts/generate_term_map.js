import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { episodeSequence } from '../episode_sequence.js';
const settingsPath = path.join(__dirname, '..', 'public', 'settings');

const firstAppearanceMap = {};

for (const ep of episodeSequence) {
  const filePath = path.join(settingsPath, `${ep}.mdx`);
  if (!fs.existsSync(filePath)) continue;

  const content = fs.readFileSync(filePath, 'utf8');
  // <Term ...> タグを探す正規表現
  const regex = /<Term\s+id="([^"]+)"/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const termId = match[1];
    if (!firstAppearanceMap[termId]) {
      // この用語IDが最初に登場したエピソードを記録
      firstAppearanceMap[termId] = ep;
    }
  }
}

const outputPath = path.join(__dirname, '..', 'src', 'term_map.js');
const outputContent = `// 自動生成ファイル: npm run dev または npm run build 時に自動で更新されます
// ここを手動で編集しても上書きされるため注意してください
export const TermFirstAppearanceMap = ${JSON.stringify(firstAppearanceMap, null, 2)};
`;

fs.writeFileSync(outputPath, outputContent, 'utf8');
console.log('[generate_term_map] First appearance map generated at src/term_map.js');
