const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'public', 'settings');

// カタカナ単語の抽出 (2文字以上)
const regexKatakana = /[\u30A1-\u30FA\u30FC]{2,}/g;
// 漢字2文字以上
const regexKanji = /[\u4E00-\u9FFF]{2,}/g;
// カタカナと漢字の複合語 ("超チューナー", "ノイズチューナー" などを想定)
// 今回は単純化してカタカナだけ、漢字だけを抽出し、後で手動フィルタリングの足しにする
const regexMixed1 = /[\u4E00-\u9FFF]+[\u30A1-\u30FA\u30FC]+/g; 
const regexMixed2 = /[\u30A1-\u30FA\u30FC]+[\u4E00-\u9FFF]+/g;

const terms = {};

function addTerm(term) {
  // 特定のよくある語や、意味をなさないカタカナは除外
  const ignores = ['イン', 'アウト', 'テキスト', 'ファイル', 'ボタン', 'クラス'];
  if (ignores.includes(term)) return;
  if (!terms[term]) terms[term] = 0;
  terms[term]++;
}

try {
  const files = fs.readdirSync(directoryPath);

  files.filter(f => f.endsWith('.mdx')).forEach(file => {
    const fileContent = fs.readFileSync(path.join(directoryPath, file), 'utf8');
    
    // HTMLタグやMarkdownの一部を少し取り除くともっと精度が上がるかもしれないが、まずはシンプルに
    let match;
    while ((match = regexKatakana.exec(fileContent)) !== null) addTerm(match[0]);
    while ((match = regexKanji.exec(fileContent)) !== null) addTerm(match[0]);
    while ((match = regexMixed1.exec(fileContent)) !== null) addTerm(match[0]);
    while ((match = regexMixed2.exec(fileContent)) !== null) addTerm(match[0]);
  });

  const sortedTerms = Object.entries(terms)
    .sort((a, b) => b[1] - a[1]) // frequency desc
    .filter(([term, count]) => count >= 2 && term.length > 2); // 3文字以上、2回以上出現

  console.log("=== 抽出結果トップ 150件 ===");
  sortedTerms.slice(0, 150).forEach(([term, count]) => {
    console.log(`${term} (${count})`);
  });

  // カタカナ限定のも出しておく
  console.log("\n=== カタカナのみの上位 50件 ===");
  const katakanaOnly = sortedTerms.filter(([term]) => /^[\u30A1-\u30FA\u30FC]+$/.test(term));
  katakanaOnly.slice(0, 50).forEach(([term, count]) => {
    console.log(`${term} (${count})`);
  });

  // 漢字＋カタカナ複合の上位 50件
  console.log("\n=== 漢字＋カタカナ複合の上位 50件 ===");
  const mixedOnly = sortedTerms.filter(([term]) => /[\u4E00-\u9FFF]/.test(term) && /[\u30A1-\u30FA\u30FC]/.test(term));
  mixedOnly.slice(0, 50).forEach(([term, count]) => {
    console.log(`${term} (${count})`);
  });
  
} catch (err) {
  console.error('Unable to scan directory: ' + err);
}
