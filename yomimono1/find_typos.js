import fs from 'fs';

let kore = fs.readFileSync('public/settings/kore.txt', 'utf-8');
let output = fs.readFileSync('output_novel.txt', 'utf-8');

function getLines(raw) {
    return raw.split('\n')
      .map(l => l.trim())
      .filter(l => 
        l.length > 0 && 
        !l.startsWith('---') && 
        !/^第\d+話/.test(l) && 
        !/^終章/.test(l) && 
        !/^【第\d+章/.test(l) &&
        !/^【プロローグ】/.test(l) &&
        l !== 'プロローグ'
      );
}

let kLines = getLines(kore);
let oLines = getLines(output);

function clean(s) {
    return s.replace(/[\s、。！？「」『』（）\-\─\—…・※]/g, '');
}

let typos = [];
let kIdx = 0;
let ignoreTerms = false;

for (let i = 0; i < oLines.length; i++) {
    let oOrig = oLines[i];
    let oClean = clean(oOrig);
    if (oClean.length === 0) continue;

    let bestDiff = 999;
    let matchIdx = -1;

    for (let j = kIdx; j < Math.min(kIdx + 30, kLines.length); j++) {
        let kOrig = kLines[j];
        if (kOrig.includes('【用語解説】')) {
            ignoreTerms = true;
        }
        if (ignoreTerms) {
            if (/^【第\d+章/.test(kOrig) || kOrig.includes('【プロローグ】') || kOrig.includes('＊')) {
                ignoreTerms = false;
            } else {
                continue;
            }
        }

        let kClean = clean(kOrig);
        
        if (oClean === kClean) {
            matchIdx = j;
            bestDiff = 0;
            break;
        }

        // Calculate simple diff
        if (Math.abs(oClean.length - kClean.length) <= 5) {
            let diffCount = Math.abs(oClean.length - kClean.length);
            for (let c = 0; c < Math.min(oClean.length, kClean.length); c++) {
                if (oClean[c] !== kClean[c]) diffCount++;
            }
            if (diffCount < bestDiff && diffCount <= Math.max(2, oClean.length * 0.3)) {
                bestDiff = diffCount;
                matchIdx = j;
            }
        }
    }

    if (matchIdx !== -1) {
        if (bestDiff > 0) {
            typos.push(`\n[差異箇所]`);
            typos.push(`【生成結果】 : ${oOrig}`);
            typos.push(`【kore.txt】 : ${kLines[matchIdx]}`);
        }
        kIdx = matchIdx + 1;
    }
}

fs.writeFileSync('typos2.txt', typos.join('\n'), 'utf-8');
console.log('Found ' + (typos.length / 3) + ' subtle differences.');
