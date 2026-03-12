import fs from 'fs';

const koreRaw = fs.readFileSync('public/settings/kore.txt', 'utf-8');
const outRaw = fs.readFileSync('output_novel.txt', 'utf-8');

function getCleaningLines(raw, isKore) {
    let lines = raw.split(/\r?\n/);
    let cleanedLines = [];
    let inTerms = false;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        
        if (isKore) {
            if (line.includes('【用語解説】')) {
                inTerms = true;
                continue;
            }
            if (line.includes('【プロローグ】') || /【第\d+章.*?】/.test(line)) {
                inTerms = false;
                continue;
            }
            if (inTerms) continue;
            if (line.startsWith('＊')) continue;
        } else {
            if (line.startsWith('---')) continue;
            if (line === 'プロローグ' || line === 'プロローグ：世界の果てでバグが笑う' || /第\d+話/.test(line) || /終章/.test(line)) continue;
        }
        
        // Remove footnotes like （※1）
        line = line.replace(/（※\d+）/g, '');
        
        // 記号や空白を除去して純粋な文字だけの比較にする
        const normalized = line.replace(/[\s、。！？「」『』（）\-─…・]/g, '');
        if (normalized.length > 0) {
            cleanedLines.push({ original: lines[i], normalized: normalized, lineNum: i + 1 });
        }
    }
    return cleanedLines;
}

const koreLines = getCleaningLines(koreRaw, true);
const outLines = getCleaningLines(outRaw, false);

let kIdx = 0;
let oIdx = 0;

let diffs = [];

while (kIdx < koreLines.length && oIdx < outLines.length) {
    const kData = koreLines[kIdx];
    const oData = outLines[oIdx];
    
    if (kData.normalized === oData.normalized) {
        kIdx++;
        oIdx++;
    } else {
        // Look ahead to resynchronize
        let resynced = false;
        for(let w = 1; w <= 5; w++) {
            if (kIdx + w < koreLines.length && koreLines[kIdx + w].normalized === oData.normalized) {
                diffs.push(`\n[欠落] kore.txt (Line ${kData.lineNum}) にあり、outputに無い:\n${kData.original}`);
                kIdx++; // skip one and check again
                resynced = true;
                break;
            }
            if (oIdx + w < outLines.length && kData.normalized === outLines[oIdx + w].normalized) {
                diffs.push(`\n[追加・改変] output に余分にあるか改変された:\n${oData.original}`);
                oIdx++; // skip one and check again
                resynced = true;
                break;
            }
        }
        
        if (!resynced) {
            diffs.push(`\n[相違] \n  kore.txt (L${kData.lineNum}): ${kData.original}\n  output   : ${oData.original}`);
            kIdx++;
            oIdx++;
        }
    }
}

// 最後に余った行の処理
while (kIdx < koreLines.length) {
    diffs.push(`\n[欠落] 末尾 kore.txt (L${koreLines[kIdx].lineNum}): ${koreLines[kIdx].original}`);
    kIdx++;
}
while (oIdx < outLines.length) {
    diffs.push(`\n[追加] 末尾 output: ${outLines[oIdx].original}`);
    oIdx++;
}

fs.writeFileSync('hallucination_diff.txt', diffs.join('\n'), 'utf-8');
console.log(`Diff found: ${diffs.length} differences.`);
