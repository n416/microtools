const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'output_novel_noterms.txt');
const outputDir = path.join(__dirname, '..', 'split_output');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const content = fs.readFileSync(inputFile, 'utf-8');

// 「第○話」や「第○章」といった明確な切れ目が存在しない可能性があるため、
// 視点切り替えや場面転換の「　＊　＊　＊」等を基準に分割する仕組みを強化。
const chunks = content.split(/　(?:＊　＊　＊|◆　◆　◆|◇　◇　◇)\s*/);
let summary = '# Output Outline (Updated)\n\n';

chunks.forEach((chunk, index) => {
    const lines = chunk.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length === 0) return;
    
    const fileNum = String(index).padStart(3, '0');
    const outPath = path.join(outputDir, `chunk_${fileNum}.txt`);
    fs.writeFileSync(outPath, chunk.trim() + '\n', 'utf-8');
    
    const dialogueCount = lines.filter(l => l.startsWith('「') || l.includes('「')).length;
    const descCount = lines.length - dialogueCount;
    const ratio = lines.length > 0 ? Math.round((dialogueCount / lines.length) * 100) : 0;
    
    const firstLine = lines[0].substring(0, 50);
    const lastLine = lines[lines.length - 1].substring(0, 50);
    
    // チャンク内に「第○章」や「第○話」が含まれているかチェックしてタイトルにする
    const titleMatch = lines.find(l => l.includes('第') && (l.includes('章') || l.includes('話')));
    const titleDisp = titleMatch ? ` (${titleMatch})` : '';

    summary += `## Chunk ${fileNum}${titleDisp}\n`;
    summary += `- Lines: ${lines.length} (Talk: ${dialogueCount}, Desc: ${descCount}, TalkRatio: ${ratio}%)\n`;
    summary += `- Start: ${firstLine}\n`;
    summary += `- End  : ${lastLine}\n\n`;
});

fs.writeFileSync(path.join(outputDir, 'summary.md'), summary, 'utf-8');
console.log('Done splitting file into', outputDir);
