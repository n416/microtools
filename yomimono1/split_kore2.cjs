const fs = require('fs');
const content = fs.readFileSync('c:/Users/shingo/Desktop/microtools/yomimono1/public/settings/kore.txt', 'utf8');

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

const chapters = [];
const parts = content.split('【');

for (let i = 1; i < parts.length; i++) {
   const section = parts[i];
   const titleEnd = section.indexOf('】');
   if(titleEnd === -1) continue;
   
   const title = section.substring(0, titleEnd).trim();
   let text = section.substring(titleEnd + 1).trim();
   
   const sortedKeys = Object.keys(TAG_MAP).sort((a, b) => b.length - a.length);
   for (const key of sortedKeys) {
       text = text.split(key).join(TAG_MAP[key]);
   }
   chapters.push({ title, text });
}

console.log('Chapters found:', chapters.length);

const fileNames = ['ep0100.mdx','ep0200.mdx','ep0300.mdx','ep0400.mdx','ep0500.mdx','ep0600.mdx','ep0700.mdx','ep0800.mdx','ep0900.mdx','ep1000.mdx'];

const destDir = 'c:/Users/shingo/Desktop/microtools/yomimono1/public/settings';

for (let i = 0; i < chapters.length; i++) {
  const ch = chapters[i];
  const fileName = fileNames[i] || `ep_extra_${i}.mdx`;
  const nextFileName = i + 1 < fileNames.length ? fileNames[i + 1].replace('.mdx', '') : '';
  const nextButtonStr = nextFileName ? `\n\n<div class=\"next-action\">\n  <button class=\"btn-normal-next\" data-next=\"${nextFileName}\">次の話へ進む</button>\n</div>\n` : '';
  
  const lines = ch.text.split('\n');
  const formattedText = lines.map(line => {
      let trimmed = line.replace(/\r$/, '');
      if(trimmed.startsWith('＊')) return '\n---\n';
      return trimmed + '  ';
  }).join('\n');
  
  const fileContent = `# ${ch.title}\n\n${formattedText}${nextButtonStr}`;
  
  try {
      fs.writeFileSync(`${destDir}/${fileName}`, fileContent, 'utf-8');
      console.log('Created:', fileName);
  } catch(e) {
      console.error('Error writing', fileName, e);
  }
}
process.exit(0);
