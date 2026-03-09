import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const episodeSequence = [
  'ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep6', 'ep7', 'ep8', 'ep8_5', 'ep9',
  'ep10_1', 'ep10_2', 'ep10_3', 'ep11', 'ep12_0', 'ep12_1', 'ep12_2',
  'ep13_0', 'ep13_1', 'ep13_2', 'ep13_3', 'ep13_4', 'ep13_5', 'ep13_6', 'ep13_7',
  'ep14', 'ep14_1', 'ep14_2', 'ep15', 'ep15_5', 'ep16_0', 'ep16_0_5', 'ep16_0_6', 'ep16_1', 'ep17', 'ep17_5', 'ep18', 'ep19_1', 'ep19_2', 'ep19_3', 'ep19_4', 'ep20', 'ep21', 'ep22'
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
