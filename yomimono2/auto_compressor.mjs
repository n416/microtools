import fs from 'fs';
import path from 'path';

const dir = './public/settings';
const targetsPath = 'C:/Users/shingo/AppData/Local/Temp/targets_part2.json';
if (!fs.existsSync(targetsPath)) process.exit(1);

const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));

const safeRules = [
    { match: /それこそが命価消費というシステムの/g, replace: 'それこそが命価消費の' },
    { match: /見えていた/g, replace: '見えた' },
    { match: /空間と時間の/g, replace: '時空の' },
    { match: /老衰して死ぬ/g, replace: '老衰する' },
    { match: /引き起こしたつまり/g, replace: '起こした' },
    { match: /致命的事実/g, replace: '事実' },
    { match: /やり方くらい分かるだろ/g, replace: 'やり方くらい分かる' },
    { match: /真っ向から同じ圧の風で/g, replace: '真っ向から同じ風圧で' },
    { match: /少しだけ/g, replace: '少し' },
    { match: /ことができる/g, replace: 'できる' },
    { match: /ことができ/g, replace: 'でき' },
    { match: /ことなど/g, replace: 'など' },
    { match: /のものだった/g, replace: 'だった' },
    { match: /のだろうか/g, replace: 'なのか' },
    { match: /だったのだ/g, replace: 'だった' },
    { match: /ていたのだ/g, replace: 'ていた' },
    { match: /だからこそ、/g, replace: 'だから、' },
    { match: /、そして/g, replace: '、' },
    { match: /だが、/g, replace: 'だが' },
    { match: /しかし、/g, replace: 'しかし' },
    { match: /つまり、/g, replace: 'つまり' },
    { match: /……ッ！/g, replace: '……！' },
    { match: /！！」/g, replace: '！」' },
    { match: /！！/g, replace: '！' },
    { match: /……、/g, replace: '……' }
];

let totalApplied = 0;
let fileEdits = {}; 

for (const t of targets) {
    if (totalApplied >= 82) break; // 82行削減でストップ
    
    let currentText = t.original;
    let saved = 0;
    
    for (const rule of safeRules) {
        if (rule.match.test(currentText)) {
            let nextText = currentText.replace(rule.match, rule.replace);
            let diff = currentText.length - nextText.length;
            if (diff > 0) {
                currentText = nextText;
                saved += diff;
                if (saved >= t.excess) break;
            }
        }
    }
    
    // 読点（、）の安全な削除による調整（て、 で、 し、 等を中心に）
    const commaRules = [ /て、/g, /で、/g, /し、/g, /り、/g, /から、/g, /が、/g, /と、/g, /は、/g, /、/g ];
    if (saved < t.excess) {
        for(const crule of commaRules) {
            let match;
            while ((match = crule.exec(currentText)) !== null) {
                let tempText = currentText.substring(0, match.index) + currentText.substring(match.index).replace('、', '');
                let diff = currentText.length - tempText.length;
                if (diff > 0) {
                    currentText = tempText;
                    saved += diff;
                    // regex index needs resetting since string length changed, but we break if achieved
                    if (saved >= t.excess) break;
                }
            }
            if (saved >= t.excess) break;
        }
    }

    if (saved >= t.excess) {
        if (!fileEdits[t.file]) fileEdits[t.file] = [];
        fileEdits[t.file].push({ old: t.original, new: currentText });
        totalApplied++;
    }
}

let actualReplaced = 0;
for (const f in fileEdits) {
    let fPath = path.join(dir, f);
    if (!fs.existsSync(fPath)) continue;
    let content = fs.readFileSync(fPath, 'utf8');
    let replacedCount = 0;
    for (const edit of fileEdits[f]) {
        if (content.includes(edit.old)) {
            content = content.replace(edit.old, edit.new);
            replacedCount++;
            actualReplaced++;
        }
    }
    fs.writeFileSync(fPath, content, 'utf8');
    console.log(`[${f}] ${replacedCount} lines reduced.`);
}

console.log(`\nPhase 2 Complete: Total ${actualReplaced} lines successfully reduced! (Target was 82)`);
