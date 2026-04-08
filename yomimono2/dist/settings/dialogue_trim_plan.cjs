const fs = require('fs');
const data = JSON.parse(fs.readFileSync('dialogue_ellipsis_analysis.json', 'utf-8'));

let trimList = [];
let keepList = [];

const keepKeywords = ['ごめん', '痛', '水', 'そっか', '正気か', '待って', 'ありがとう', '殺して', 'だめ'];
const sharpShorts = ['いや', 'わかった', 'うるさい', 'は？', 'おい', 'ふん', 'なに', 'あぁ', 'いい', 'ちっ'];

data.forEach(item => {
  let text = item.text.trim();
  
  if (text === '「……」' || text === '「…………」' || text === '「………………」') {
    keepList.push({ ...item, reason: 'Silence' });
    return;
  }

  let shouldKeep = false;
  
  if (text === '「……あ」' || text === '「……え」' || text === '「……っ」') {
    shouldKeep = true;
  }

  for (let kw of keepKeywords) {
    if (text.includes(kw)) {
      shouldKeep = true;
      break;
    }
  }

  if ((text.match(/……/g) || []).length > 1 && text.length < 25) {
    shouldKeep = true;
  }

  if (!shouldKeep && text.length <= 10 && !text.includes('！') && !text.includes('？')) {
    let isSharpShort = false;
    for (let w of sharpShorts) {
      if(text.includes(w)) { isSharpShort = true; break; }
    }
    if (!isSharpShort) shouldKeep = true;
  }

  if (shouldKeep) {
    keepList.push(item);
  } else {
    trimList.push(item);
  }
});

console.log('Trim candidates:', trimList.length);
console.log('Keep candidates:', keepList.length);

console.log('--- Sample Trim ---');
trimList.slice(0, 10).forEach(d => console.log(d.text));

fs.writeFileSync('dialogue_ellipsis_trim.json', JSON.stringify(trimList, null, 2));
