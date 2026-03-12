import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dir = path.join(__dirname, '..', 'public', 'settings');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx') && /^ep\d{4}\.mdx$/.test(f));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Replace data-next="ep0100" to "ep0200" etc.. wait, old buttons still say "ep0200" pointing to Next.
  // We shifted names so ep0100 -> ep0000. So the next of ep0000 is ep0100 (which was ep0200).
  // Thus we subtract 100.
  content = content.replace(/data-next="ep(0[1-9]|10)00"/g, (match, p1) => {
    let oldNum = parseInt(p1, 10);
    let newNumStr = (oldNum - 1).toString().padStart(2, '0');
    return `data-next="ep${newNumStr}00"`;
  });

  fs.writeFileSync(filePath, content, 'utf-8');
});
console.log('MDX updated.');
