import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetDir = path.resolve(__dirname, '../public/settings');
const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.mdx'));

let totalFiles = 0;

for (const file of files) {
    const filePath = path.join(targetDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    // 置換対象: `◆　◆　◆`、`◇　◇　◇`、`▼　▼　▼` などの文字種が同じ全角スペース区切りの記号（3連続）
    // （過去に書かれていた可能性があるものを可能な限り拾う）
    const regex = /^[ 　]*(◆　◆　◆|◇　◇　◇)[ 　]*$/gm;

    const originalContent = content;
    content = content.replace(regex, '　＊　＊　＊');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Unified symbols to AST: ${file}`);
        totalFiles++;
    }
}

console.log(`\nSymbol Unification Complete. Modified files: ${totalFiles}`);
