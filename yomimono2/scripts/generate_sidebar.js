import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { episodeSequence } from '../episode_sequence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const settingsPath = path.join(__dirname, '..', 'public', 'settings');
const outputPath = path.join(__dirname, '..', 'src', 'sidebar_nav.js');


const navItems = [];

for (const ep of episodeSequence) {
  const filePath = path.join(settingsPath, `${ep}.mdx`);
  if (!fs.existsSync(filePath)) continue;

  const content = fs.readFileSync(filePath, 'utf8');
  // First H1 (# Title)
  const regex = /^#\s+(.*)$/m;
  const match = regex.exec(content);
  
  let title = ep; // fallback
  if (match) {
    title = match[1].trim();
  }

  navItems.push({ target: ep, title: title });
}

const outputContent = `// 自動生成ファイル: npm run dev または npm run build 時に自動で更新されます
// ここを手動で編集しても上書きされるため注意してください
export const SidebarNavItems = ${JSON.stringify(navItems, null, 2)};
`;

fs.writeFileSync(outputPath, outputContent, 'utf8');
console.log('[generate_sidebar] Sidebar navigation mapping generated at src/sidebar_nav.js');
