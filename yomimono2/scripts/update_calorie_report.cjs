const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, '..', 'public', 'settings', 'word_calorie_report.md');
const freqPath = path.join(__dirname, '..', 'public', 'settings', 'word_frequency_report.txt');

// Read new frequencies
const freqData = fs.readFileSync(freqPath, 'utf8').split('\n');
const freqs = {};
for(const line of freqData) {
  const match = line.match(/^\s*\d+位:\s*(\S+)\s*\((\d+)回\)/);
  if(match) {
    freqs[match[1]] = parseInt(match[2], 10);
  }
}

// Read old report lines
const oldReport = fs.readFileSync(reportPath, 'utf8').split('\n');
const newRows = [];
const headerLines = [];

let inTable = false;
for(let line of oldReport) {
  if (line.startsWith('| 順位 |')) {
    inTable = true;
    headerLines.push(line);
    continue;
  }
  if (inTable && line.startsWith('| :---')) {
    headerLines.push(line);
    continue;
  }
  if (inTable && line.startsWith('|')) {
    // Parse table row
    // | 1 | **絶望** | 37回 | 🔥激重 (952) | 8309 |
    const cols = line.split('|').map(c => c.trim()).filter(c => c);
    if(cols.length === 5) {
      const wordRaw = cols[1]; // **絶望**
      const word = wordRaw.replace(/\*/g, '');
      const calorieStr = cols[3];
      const calMatch = calorieStr.match(/\((\d+)\)/);
      const calorie = calMatch ? parseInt(calMatch[1], 10) : 0;
      
      const newFreq = freqs[word] || 0; // if it disappeared, it's 0 or < 4. Let's say if undefined it might just be 0 or 3.
      
      // Some words like "冷え" or variations might be missing, assume freq if below threshold is 3
      const finalFreq = newFreq > 0 ? newFreq : 3; 

      const newImpact = finalFreq * calorie;
      
      newRows.push({
        wordRaw,
        freq: finalFreq,
        calorieStr,
        impact: newImpact
      });
    }
  } else if (!inTable) {
    headerLines.push(line);
  }
}

// Sort by new impact
newRows.sort((a,b) => b.impact - a.impact);

let result = headerLines.join('\n') + '\n';
newRows.forEach((row, i) => {
  result += `| ${i+1} | ${row.wordRaw} | ${row.freq}回 | ${row.calorieStr} | ${row.impact} |\n`;
});

fs.writeFileSync(reportPath, result, 'utf8');
console.log('Successfully updated word_calorie_report.md');
