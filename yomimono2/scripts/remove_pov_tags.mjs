import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsDir = path.resolve(__dirname, '../public/settings');

const files = fs.readdirSync(settingsDir).filter(f => /^ep\d{4}\.mdx$/.test(f));

for (let file of files) {
  const filePath = path.join(settingsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // <!-- POV: 〇〇 --> とその後ろの改行を削除する
  if (content.match(/<!--\s*POV:.*?-->\n?/g)) {
    content = content.replace(/<!--\s*POV:.*?-->\n?/g, '');
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[Reverted] Removed POV tags from ${file}`);
  }
}

console.log('Finished reverting POV tags.');
