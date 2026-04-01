const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\shingo\\Desktop\\microtools\\yomimono2\\public\\settings';
const files = fs.readdirSync(dir).filter(f => f.match(/^ep\d{4}\.mdx$/)).sort();

let totalViolations = 0;
let fileViolations = {};

// We look for pronouns followed by common particles to reduce false positives
// like 私立 (private), 俺様, etc., though they might be fine, we want to catch "俺は", "私が", etc.
const pronouns = ['俺', '僕', '私', 'オレ', 'ボク'];
const particles = ['は', 'が', 'の', 'に', 'を', 'へ', 'と', 'も', 'で', 'って'];

const regexes = pronouns.map(p => new RegExp(`(^|[^a-zA-Z0-9_])(${p})(${particles.join('|')})`, 'g'));

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8');
  const lines = content.split('\n');
  
  let violations = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    // Skip empty lines, headings, comments
    if (line === '' || line.startsWith('#') || line.startsWith('<!--') || line.startsWith('//')) continue;
    
    // Remove text inside quotes to only check narrative lines
    let noQuotes = line.replace(/「.*?」/g, '').replace(/『.*?』/g, '').replace(/（.*?）/g, ''); // Also remove parens for thoughts
    
    let matched = false;
    for (const regex of regexes) {
      if (regex.test(noQuotes)) {
        matched = true;
        break;
      }
    }
    
    // As another check: detect mind-reading or perspective drift (3rd person omniscient vs limited).
    // e.g., if Alto is the POV, we shouldn't have "ミアは〜と思った" in the narrative unless it's an assumption.
    // However, validating limited 3rd person programmatically is hard; checking for 1st person pronouns is a good start.
    
    if (matched) {
      violations.push({ lineNum: i + 1, original: line });
    }
  }
  
  if (violations.length > 0) {
    fileViolations[file] = violations;
    totalViolations += violations.length;
  }
}

fs.writeFileSync(path.join(dir, 'pov_report.json'), JSON.stringify(fileViolations, null, 2), 'utf-8');
console.log('Saved to pov_report.json. Total violations: ' + totalViolations);
