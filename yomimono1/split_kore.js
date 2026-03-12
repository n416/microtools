const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'public', 'settings', 'kore.txt');
const destDir = path.join(__dirname, 'public', 'settings');

console.log('Reading from:', srcPath);
const buf = fs.readFileSync(srcPath);
let content = buf.toString('utf8');

// UTF16 LE (BOM) の場合はデコード
if (buf[0] === 0xff && buf[1] === 0xfe) {
    content = buf.toString('utf16le');
}

const TAG_MAP = {
  '小林悠太': '<Char role=\"main_prog\" callrole=\"system\" var=\"full\" />',
  '小林さん': '<Char role=\"main_prog\" callrole=\"ceo\" var=\"normal_san\" />',
  '小林': '<Char role=\"main_prog\" callrole=\"ceo\" var=\"normal\" />',
  '土屋創一': '<Char role=\"ceo\" callrole=\"system\" var=\"full\" />',
  '土屋社長': '<Char role=\"ceo\" callrole=\"main_prog\" var=\"title\" />',
  '土屋さん': '<Char role=\"ceo\" callrole=\"senior_eng\" var=\"normal_san\" />',
  '社長': '<Char role=\"ceo\" callrole=\"main_prog\" var=\"title\" />',
  '俺': '<Char role=\"ceo\" callrole=\"system\" var=\"normal\" />',
  '天宮百音': '<Char role=\"senior_eng\" callrole=\"system\" var=\"full\" />',
  '天宮さん': '<Char role=\"senior_eng\" callrole=\"ceo\" var=\"normal_san\" />',
  '天宮': '<Char role=\"senior_eng\" callrole=\"system\" var=\"normal\" />',
  '伊藤結衣': '<Char role=\"cafe_clerk\" callrole=\"system\" var=\"full\" />',
  '結衣ちゃん': '<Char role=\"cafe_clerk\" callrole=\"ceo\" var=\"normal_chan\" />',
  '結衣': '<Char role=\"cafe_clerk\" callrole=\"system\" var=\"normal\" />',
  '黒須隆之': '<Char role=\"client_pmo\" callrole=\"system\" var=\"full\" />',
  '黒須': '<Char role=\"client_pmo\" callrole=\"system\" var=\"normal\" />',
  'クロスタカユキ': '<Char role=\"client_pmo\" callrole=\"system\" var=\"katakana\" />',
  'テツ': '<Char role=\"underground_fixer\" callrole=\"system\" var=\"normal\" />',
  '鈴ちゃん': '<Char role=\"truck_driver\" callrole=\"ceo\" var=\"normal_chan\" />',
  '鈴': '<Char role=\"truck_driver\" callrole=\"system\" var=\"normal\" />',
  'リン': '<Char role=\"truck_driver\" callrole=\"system\" var=\"katakana\" />',
};

const fileNames = [
  'ep0100.mdx',
  'ep0200.mdx',
  'ep0300.mdx',
  'ep0400.mdx',
  'ep0500.mdx',
  'ep0600.mdx',
  'ep0700.mdx',
  'ep0800.mdx',
  'ep0900.mdx',
  'ep1000.mdx'
];

let chapterMatches = [...content.matchAll(/【(.+?)】/g)];
console.log('見つかった章の数:', chapterMatches.length);

const chapters = [];

for (let i = 0; i < chapterMatches.length; i++) {
  const match = chapterMatches[i];
  const title = match[1];
  const startIndex = match.index + match[0].length;
  const endIndex = i + 1 < chapterMatches.length ? chapterMatches[i + 1].index : content.length;
  
  let text = content.slice(startIndex, endIndex).trim();
  
  // 置換処理
  const sortedKeys = Object.keys(TAG_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
      text = text.split(key).join(TAG_MAP[key]);
  }

  const fileName = fileNames[i] || `ep_extra_${i}.mdx`;
  chapters.push({ title, fileName, text });
}

for (let i = 0; i < chapters.length; i++) {
  const ch = chapters[i];
  const nextFileName = i + 1 < chapters.length ? chapters[i + 1].fileName.replace('.mdx', '') : '';
  const nextButtonStr = nextFileName ? `\n\n<div className=\"next-action\">\n  <button className=\"btn-normal-next\" data-next=\"${nextFileName}\">次の話へ進む</button>\n</div>\n` : '';
  
  const lines = ch.text.split('\n');
  const formattedText = lines.map(line => {
      const trimmed = line.trimRight();
      if(trimmed === '＊') return '\n---\n';
      return trimmed + '  '; // Markdownの改行(スペース2つ)
  }).join('\n');
  
  const fileContent = `# ${ch.title}\n\n${formattedText}${nextButtonStr}`;
  
  fs.writeFileSync(path.join(destDir, ch.fileName), fileContent, 'utf-8');
  console.log(`✅ 出力完了: ${ch.fileName}`);
}
