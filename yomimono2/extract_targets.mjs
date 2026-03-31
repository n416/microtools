import fs from 'fs';
import path from 'path';

const dir = './public/settings';
const files = fs.readdirSync(dir).filter(f => /^ep\d+(?:_\d+)?\.mdx$/.test(f)).sort();

let opportunities = [];

for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf-8');
    const lines = text.split(/\r?\n/);
    let lineNum = 1;
    
    for (const l of lines) {
        if (l.trim() !== '') {
            const len = l.length;
            const remainder = len % 42;
            
            // 1文字〜2文字オーバーしている箇所だけを対象（最もコスパが良い）
            if (len > 42 && remainder > 0 && remainder <= 2) {
                opportunities.push({
                    file: f,
                    lineNum,
                    original: l,
                    length: len,
                    excess: remainder
                });
            }
        }
        lineNum++;
    }
}

opportunities.sort((a, b) => {
    // まず超過文字数で昇順（1のほうが2よりコスパが良い）
    if (a.excess !== b.excess) return a.excess - b.excess;
    // ファイル名順
    return a.file.localeCompare(b.file);
});

// ファイルにJSONとして出力
fs.writeFileSync('C:/Users/shingo/AppData/Local/Temp/targets.json', JSON.stringify(opportunities.slice(0, 150), null, 2), 'utf8');
