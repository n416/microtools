const fs = require('fs');
const path = require('path');

try {
    const srcDir = 'c:\\Users\\shingo\\Desktop\\microtools\\yomimono2\\public\\settings';
    const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.mdx'));

    let combinedText = '';
    for (const file of files) {
        const text = fs.readFileSync(path.join(srcDir, file), 'utf-8');
        combinedText += text + '\n';
    }

    const regex = /[ァ-ヶー]{2,}/g;
    const matches = combinedText.match(regex) || [];

    const counts = {};
    for (const word of matches) {
        if (/^[ー]+$/.test(word)) continue; // 伸ばし棒だけの単語を除外
        counts[word] = (counts[word] || 0) + 1;
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    let mdContent = '# カタカナ用語 出現数ランキング\n\n対象: `public/settings/*.mdx` 全体\n\n| 単語 | 出現回数 |\n| :--- | :--- |\n';
    
    // 多すぎるため上位200件まで出力
    const topWords = sorted.slice(0, 200);
    topWords.forEach(([word, count]) => {
        mdContent += `| ${word} | ${count} |\n`;
    });

    const outputPath = 'c:\\Users\\shingo\\Desktop\\microtools\\yomimono2\\katakana_ranking.md';
    fs.writeFileSync(outputPath, mdContent, 'utf-8');

    console.log(`Success: Extracted ${sorted.length} unique words.`);
} catch (e) {
    console.error("Error:", e.message);
}
