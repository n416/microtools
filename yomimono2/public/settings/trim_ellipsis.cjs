const fs = require('fs');
const path = require('path');
const dir = './';

const data = JSON.parse(fs.readFileSync('ellipsis_analysis.json', 'utf-8'));

// Keywords that indicate hesitation, pain, slow realization, or deep emotional weight
const keepKeywords = [
  '水が', '痛みが', '寒い', 'だめだ', 'ごめん', '僕が死んで', 'なんだか、変', 
  '炭になる', 'あぁ、', '明日で、', 'やはり一人で'
];

let filesToUpdate = new Set();
let replacements = {};

data.forEach(item => {
  let text = item.text.trim();
  // Check if it should be kept
  let shouldKeep = false;
  for (let kw of keepKeywords) {
    if (text.includes(kw)) {
      shouldKeep = true;
      break;
    }
  }

  if (!shouldKeep) {
    // We should trim it!
    if (!replacements[item.file]) replacements[item.file] = [];
    
    // We need to replace exactly the specific `（……` pattern for this text in the file.
    replacements[item.file].push(text);
  }
});

for (const [file, texts] of Object.entries(replacements)) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  texts.forEach(t => {
    // Locate the line exactly in the file text
    const idx = content.indexOf(t);
    if (idx !== -1) {
      // Find where "（……" happens inside the string t.
      // Usually it's at the very beginning of t.
      const modifiedT = t.replace('（……', '（');
      content = content.replace(t, modifiedT);
      changed = true;
      console.log(`[TRIMMED] ${file}: ${modifiedT}`);
    } else {
      // It might have HTML tags inside it. We fallback to replacing directly using regex for that line constraint
      // It's safer to read line by line and replace if line.replace(/<[^>]+>/g, '') includes t
      const eol = content.includes('\r\n') ? '\r\n' : '\n';
      let lines = content.split(eol);
      for (let i = 0; i < lines.length; i++) {
        let cleanLine = lines[i].replace(/<[^>]+>/g, '');
        if (cleanLine === t) {
          lines[i] = lines[i].replace('（……', '（');
          content = lines.join(eol);
          changed = true;
          console.log(`[TRIMMED] ${file}: ${lines[i].trim()}`);
          break;
        }
      }
    }
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}
