import fs from 'fs';
import path from 'path';

const dir = './public/settings';
const files = fs.readdirSync(dir).filter(f => /^ep\d+(?:_\d+)?\.mdx$/.test(f) && f !== 'ep0000.mdx').sort();

let totalLines = 0;

for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf-8');
    const lines = text.split(/\r?\n/);
    
    for (const l of lines) {
        if (l.trim() === '') {
            totalLines += 1;
        } else {
            const len = l.length;
            const foldedCount = Math.ceil(len / 42) || 1;
            totalLines += foldedCount;
        }
    }
}

const totalPages = (totalLines / 34).toFixed(1);
const output = `【最終結果】\n合計行数: ${totalLines}行 (約${totalPages}ページ)`;
fs.writeFileSync('C:/Users/shingo/AppData/Local/Temp/final_count.txt', output, 'utf8');
console.log("Verified. Results written.");
