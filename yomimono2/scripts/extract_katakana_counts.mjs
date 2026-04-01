import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.resolve(__dirname, '../public/settings');
const outputFile = path.resolve(__dirname, '../katakana_counts_latest.json');

const files = fs.readdirSync(targetDir).filter(file => file.endsWith('.mdx'));
const wordCounts = {};

for (const file of files) {
    const filePath = path.join(targetDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 2文字以上の連続するカタカナ（長音符含む）を抽出
    const matches = content.match(/[ァ-ヴー]{2,}/g);
    
    if (matches) {
        matches.forEach(word => {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
        });
    }
}

// 出現頻度順にソート（同数の場合は五十音順）
const sortedCounts = Object.entries(wordCounts).sort((a, b) => {
    if (b[1] !== a[1]) {
        return b[1] - a[1];
    }
    return a[0].localeCompare(b[0], 'ja');
});

// JSONに変換して保存
const resultObj = Object.fromEntries(sortedCounts);
fs.writeFileSync(outputFile, JSON.stringify(resultObj, null, 2), 'utf8');

console.log(`抽出が完了しました。全 ${files.length} ファイルから ${Object.keys(wordCounts).length} 種類のカタカナ語をカウントしました。`);
console.log(`出力先: ${outputFile}`);
