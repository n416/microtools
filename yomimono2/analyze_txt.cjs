const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'settings');
if (!fs.existsSync(dir)) {
    console.error("Directory not found:", dir);
    process.exit(1);
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx') && f.startsWith('ep'));

let totalMonologue = 0;
let totalDialogue = 0;
let totalNarration = 0;

console.log("=== エピソードごとのモノローグ率 ===");

files.forEach(file => {
    const text = fs.readFileSync(path.join(dir, file), 'utf-8');
    const lines = text.split('\n').filter(l => 
        l.trim() !== '' && 
        !l.startsWith('#') && 
        !l.startsWith('<!--') && 
        !l.startsWith('<div') && 
        !l.startsWith('</div>') && 
        !l.startsWith('**【') && 
        !l.startsWith('※')
    );
    
    let fm = 0;
    let fd = 0;
    let fn = 0;
    
    lines.forEach(line => {
        let l = line.trim();
        
        // （）または () のモノローグを抽出
        const monoMatches = l.match(/（[^）]+）|\([^)]+\)/g);
        if (monoMatches) {
            monoMatches.forEach(m => fm += m.length);
            l = l.replace(/（[^）]+）|\([^)]+\)/g, '');
        }
        
        // 「」または 『』 のセリフを抽出
        const dialMatches = l.match(/「[^」]+」|『[^』]+』/g);
        if (dialMatches) {
            dialMatches.forEach(m => fd += m.length);
            l = l.replace(/「[^」]+」|『[^』]+』/g, '');
        }
        
        // 残りの文字数を地の文（スペース等を除く）としてカウント
        l = l.replace(/\s+/g, '');
        fn += l.length;
    });
    
    const fileTotal = fm + fd + fn;
    if (fileTotal > 0) {
        const monoPercent = ((fm / fileTotal) * 100).toFixed(1);
        console.log(`${file}: モノローグ ${monoPercent}% (${fm}/${fileTotal}文字) | セリフ ${((fd / fileTotal) * 100).toFixed(1)}% | 地の文 ${((fn / fileTotal) * 100).toFixed(1)}%`);
    }
    
    totalMonologue += fm;
    totalDialogue += fd;
    totalNarration += fn;
});

const total = totalMonologue + totalDialogue + totalNarration;
console.log("\n=== 全体集計 ===");
console.log(`総文字数: ${total}文字`);
console.log(`モノローグ: ${totalMonologue}文字 (${((totalMonologue/total)*100).toFixed(1)}%)`);
console.log(`セリフ: ${totalDialogue}文字 (${((totalDialogue/total)*100).toFixed(1)}%)`);
console.log(`地の文(描写・説明含む): ${totalNarration}文字 (${((totalNarration/total)*100).toFixed(1)}%)`);
