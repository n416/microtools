import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const episodeSequence = [
  'prologue1', 'prologue2', 'prologue3', 'ep1', 'ep2', 'ep3', 'ep1', 'ep2', 'ep2_5', 'ep3',
  'ep4_1', 'ep4_2', 'ep4_3', 'ep2', 'ep6_0', 'ep6_1', 'ep6_2',
  'ep10_0', 'ep4.1', 'ep4.2', 'ep4.3', 'ep10_4', 'ep10_5', 'ep10_6', 'ep10_7',
  'ep5', 'ep5_1', 'ep5_2', 'ep12', 'ep12_5', 'ep10.0', 'ep10.0_5', 'ep10.0_6', 'ep10.1', 'ep11', 'ep11_5', 'ep12', 'ep13.1', 'ep16_2', 'ep16_3', 'ep16_4', 'ep14', 'ep15', 'ep19'
];
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
