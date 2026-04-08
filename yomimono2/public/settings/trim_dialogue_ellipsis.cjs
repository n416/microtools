const fs = require('fs');
const path = require('path');
const dir = './';

// The pre-separated list of 120 scenes that need trimming
const trimData = JSON.parse(fs.readFileSync('dialogue_ellipsis_trim.json', 'utf-8'));

let replacementsByFile = {};
trimData.forEach(item => {
  if (!replacementsByFile[item.file]) {
    replacementsByFile[item.file] = [];
  }
  replacementsByFile[item.file].push(item.text);
});

let totalTrimmed = 0;

for (const [file, texts] of Object.entries(replacementsByFile)) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  texts.forEach(t => {
    // Exact string match replacement
    const idx = content.indexOf(t);
    if (idx !== -1) {
      const modifiedT = t.replace('「……', '「');
      content = content.replace(t, modifiedT);
      changed = true;
      totalTrimmed++;
    } else {
      // Fallback for lines containing HTML tags
      const eol = content.includes('\r\n') ? '\r\n' : '\n';
      let lines = content.split(eol);
      for (let i = 0; i < lines.length; i++) {
        let cleanLine = lines[i].replace(/<[^>]+>/g, '');
        if (cleanLine === t) {
          lines[i] = lines[i].replace('「……', '「');
          content = lines.join(eol);
          changed = true;
          totalTrimmed++;
          break;
        }
      }
    }
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

console.log(`Successfully trimmed '「……' from ${totalTrimmed} dialogue lines.`);
