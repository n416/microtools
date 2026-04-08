const fs = require('fs');
const path = require('path');

const srcDir = 'c:\\Users\\shingo\\Desktop\\microtools\\yomimono2\\public\\settings';
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.mdx'));

let combinedText = '';
for (const file of files) {
    combinedText += fs.readFileSync(path.join(srcDir, file), 'utf-8') + '\n';
}

const regex = /[\u30A0-\u30FF]{2,}/g;
const matches = combinedText.match(regex) || [];

const counts = {};
for (const word of matches) {
    if (/^\u30FC+$/.test(word)) continue; 
    counts[word] = (counts[word] || 0) + 1;
}

const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

let mdContent = 'Word,Count\n';
const topWords = sorted.slice(0, 200);
topWords.forEach(([word, count]) => {
    mdContent += `${word},${count}\n`;
});

const outputPath = 'c:\\Users\\shingo\\Desktop\\microtools\\yomimono2\\katakana_ranking.csv';
fs.writeFileSync(outputPath, mdContent, 'utf-8');
