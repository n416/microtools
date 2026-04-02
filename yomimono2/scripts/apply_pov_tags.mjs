import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsDir = path.resolve(__dirname, '../public/settings');

const files = fs.readdirSync(settingsDir).filter(f => /^ep\d{4}\.mdx$/.test(f));

for (let file of files) {
  const filePath = path.join(settingsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  if (content.includes('<!-- POV:')) {
    // 既にPOVタグがあればスキップ
    continue;
  }

  const lines = content.split('\n');
  let miaScore = 0;
  let altoScore = 0;
  let loganScore = 0;

  for (let line of lines) {
    // セリフを削除して地の文だけにする
    let narrative = line.replace(/「.*?」/g, '').replace(/『.*?』/g, '');
    
    // 単語カウント
    const count = (str, word) => (str.match(new RegExp(word, 'g')) || []).length;
    
    miaScore += count(narrative, '私') * 2; // "私" は一人称として強め
    miaScore += count(narrative, 'ミア');
    
    altoScore += count(narrative, '僕') * 2;
    altoScore += count(narrative, '俺') * 2;
    altoScore += count(narrative, 'アルト');
    
    // ローガンの主観代名詞が不明なためローガン自身への言及と一人称で推定
    loganScore += count(narrative, 'ローガン') * 1.5;
  }

  let determinedPov = 'ミア'; // デフォルト
  let maxScore = miaScore;

  if (altoScore > maxScore && altoScore > loganScore) {
    determinedPov = 'アルト';
  } else if (loganScore > maxScore) {
    determinedPov = 'ローガン';
  }

  // ファイルの先頭（Chapterコメントがあったらその次あたり、もしくは# タイトルの前か後）に挿入する
  // # タイトル の次の行に入れるのが一番自然
  let newContent = [];
  let inserted = false;
  
  for (let line of lines) {
    newContent.push(line);
    if (!inserted && line.startsWith('# ')) {
      newContent.push(`\n<!-- POV: ${determinedPov} -->`);
      inserted = true;
    }
  }
  
  // もし # がなかったら先頭に入れる
  if (!inserted) {
    newContent.unshift(`<!-- POV: ${determinedPov} -->\n`);
  }

  fs.writeFileSync(filePath, newContent.join('\n'), 'utf-8');
  console.log(`[POV Auto-Tag] ${file} => ${determinedPov} (Scores - Mia:${miaScore}, Alto:${altoScore}, Logan:${loganScore})`);
}

console.log('Finished POV Tagging.');
