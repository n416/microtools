import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directoryPath = path.join(__dirname, 'public', 'settings');
const outputPath = path.join(__dirname, 'output.txt');

const regexKatakana = /[\u30A1-\u30FA\u30FC]{2,}/g;
const regexKanji = /[\u4E00-\u9FFF]{2,}/g;
const regexMixed1 = /[\u4E00-\u9FFF]+[\u30A1-\u30FA\u30FC]+/g; 
const regexMixed2 = /[\u30A1-\u30FA\u30FC]+[\u4E00-\u9FFF]+/g;

const terms = {};

function addTerm(term) {
  const ignores = ['イン', 'アウト', 'テキスト', 'ファイル', 'ボタン', 'クラス', 'ページ', 'コメント', 'ログ', 'デザイン', 'データ', 'コード', 'エラー', 'システム', 'ユーザー', 'メニュー', 'リスト', 'プログラミング', 'について', 'あります', 'します', 'から', 'です'];
  if (ignores.includes(term)) return;
  if (!terms[term]) terms[term] = 0;
  terms[term]++;
}

let resultString = '';

try {
  const files = fs.readdirSync(directoryPath);
  resultString += `Files found: ${files.length}\n\n`;

  files.filter(f => f.endsWith('.mdx')).forEach(file => {
    const fileContent = fs.readFileSync(path.join(directoryPath, file), 'utf8');
    
    let match;
    while ((match = regexKatakana.exec(fileContent)) !== null) addTerm(match[0]);
    while ((match = regexKanji.exec(fileContent)) !== null) addTerm(match[0]);
    while ((match = regexMixed1.exec(fileContent)) !== null) addTerm(match[0]);
    while ((match = regexMixed2.exec(fileContent)) !== null) addTerm(match[0]);
  });

  const sortedTerms = Object.entries(terms)
    .sort((a, b) => b[1] - a[1])
    .filter(([term, count]) => count >= 2 && term.length > 2); 

  resultString += "=== 抽出結果トップ 150件 ===\n";
  sortedTerms.slice(0, 150).forEach(([term, count]) => {
    resultString += `${term} (${count})\n`;
  });

  resultString += "\n=== カタカナのみの上位 50件 ===\n";
  const katakanaOnly = sortedTerms.filter(([term]) => /^[\u30A1-\u30FA\u30FC]+$/.test(term));
  katakanaOnly.slice(0, 50).forEach(([term, count]) => {
    resultString += `${term} (${count})\n`;
  });

  resultString += "\n=== 漢字＋カタカナ複合の上位 50件 ===\n";
  const mixedOnly = sortedTerms.filter(([term]) => /[\u4E00-\u9FFF]/.test(term) && /[\u30A1-\u30FA\u30FC]/.test(term));
  mixedOnly.slice(0, 50).forEach(([term, count]) => {
    resultString += `${term} (${count})\n`;
  });
  
  fs.writeFileSync(outputPath, resultString, 'utf8');
  console.log("Success: Written to output.txt");
} catch (err) {
  fs.writeFileSync(outputPath, "ERROR: " + err.toString(), 'utf8');
  console.log("Error: " + err);
}
