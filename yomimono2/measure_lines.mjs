import fs from 'fs';
import path from 'path';

const dir = './public/settings';
const files = fs.readdirSync(dir).filter(f => /^ep\d+(?:_\d+)?\.mdx$/.test(f)).sort();

let totalLines = 0;
let opportunities = [];

for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf-8');
    const lines = text.split(/\r?\n/);
    let lineNum = 1;
    
    for (const l of lines) {
        if (l.trim() === '') {
            totalLines += 1;
        } else {
            const len = l.length;
            const foldedCount = Math.ceil(len / 42) || 1;
            totalLines += foldedCount;

            const remainder = len % 42;
            if (len > 42 && remainder > 0 && remainder <= 15) {
                opportunities.push({
                    file: f,
                    lineNum,
                    text: l.substring(0, 30) + (len > 30 ? '...' : ''),
                    length: len,
                    excess: remainder
                });
            }
        }
        lineNum++;
    }
}

opportunities.sort((a, b) => a.excess - b.excess);
const totalPages = (totalLines / 34).toFixed(1);

let out = [];
out.push(`合計行数: ${totalLines}行 (約${totalPages}ページ)`);
out.push(`削減目標: 3ページ = 102行\n`);
out.push(`■ コスパの良い修正箇所（あと数文字削れば1行減る段落）リスト:`);

let count = 0;
for (const op of opportunities) {
    out.push(`[${op.file} : L${op.lineNum}] ${op.excess}文字削れば1行減 (全体${op.length}字)`);
    count++;
    if (count >= 50) break;
}
out.push(`\n合計 ${opportunities.length} 件の削減チャンスが見つかりました。`);

fs.writeFileSync('./result_lines.txt', out.join('\n'), 'utf8');
