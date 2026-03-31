import fs from 'fs';
import path from 'path';

const dir = './public/settings';
const files = fs.readdirSync(dir).filter(f => /^ep\d+(?:_\d+)?\.mdx$/.test(f)).sort();

let opportunities = [];

// 除外するファイル：
// ・ep0000.mdx（短編なので対象外）
// ・既に修正済みの行（1〜2文字超過の ep0010〜ep0070）は自然と excess <= 2 以外になっているか、対象ファイル自体で処理。
// 今回は単純に全ファイル（ep0000以外）を通期でスキャンし、直近のアプデでスルーされた excess=1~5 を拾う
for (const f of files) {
    if (f === 'ep0000.mdx') continue;
    
    const text = fs.readFileSync(path.join(dir, f), 'utf-8');
    const lines = text.split(/\r?\n/);
    let lineNum = 1;
    
    for (const l of lines) {
        if (l.trim() !== '') {
            const len = l.length;
            const remainder = len % 42;
            
            // 既に修正済みの「1〜2文字超過だった10〜70話」は、文字数が減っているため余り0や41などになっており引っかかりません。
            // なので単純に 1<=remainder<=5 の最もコスパが良い行を再度抽出します。
            if (len > 42 && remainder > 0 && remainder <= 3) {
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
    if (a.excess !== b.excess) return a.excess - b.excess; // 余りが少ない順
    return a.file.localeCompare(b.file);
});

// JSON出力（上位90件）
fs.writeFileSync('C:/Users/shingo/AppData/Local/Temp/targets_part2.json', JSON.stringify(opportunities.slice(0, 90), null, 2), 'utf8');
