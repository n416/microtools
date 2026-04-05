const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public', 'settings');

// Replacement configurations
const replacers = [
  { pattern: /氷のように冷徹な/g, replacement: '氷のような' },
  { pattern: /ひどく冷徹に/g, replacement: '' },
  { pattern: /ひどく冷徹な/g, replacement: '冷たい' },
  { pattern: /、ひどく冷徹な/g, replacement: '、' }, // e.g. "ひどく冷徹な声で" -> "声で" (already covered below, wait)
  
  // Custom case tuning
  { pattern: /感情の一切こもっていない、ひどく冷徹な/g, replacement: '感情の一切こもっていない' },
  { pattern: /ひどく冷徹に正していた/g, replacement: '正していた' },
  { pattern: /完全な絶望/g, replacement: '絶望' },
  { pattern: /完全な失明/g, replacement: '失明' },
  { pattern: /完全な機能不全/g, replacement: '機能不全' },

  // Base patterns
  { pattern: /完全に/g, replacement: '' },
  { pattern: /完全なる/g, replacement: '' },
  { pattern: /完全な/g, replacement: '' },
  { pattern: /冷徹なる/g, replacement: '' },
  { pattern: /冷徹な/g, replacement: '' },
  { pattern: /冷徹に/g, replacement: '' },

  // Grammar cleanup (e.g., removing double particles like 'のの', stray '、') 
  // It's mostly not needed if we just strip the adj. 
  // "冷徹な計算式" -> "計算式"
];


function processDirectory(directory) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.mdx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;

      for (const rule of replacers) {
        content = content.replace(rule.pattern, rule.replacement);
      }

      // Quick fix for potential formatting artifacts from regex
      content = content.replace(/のの/g, 'の'); // Just in case if we had something like "完全なの" -> "の" (doesn't happen here)
      // Fix instances where a comma might be left dangling without a preceding text
      content = content.replace(/。、/g, '。'); 
      content = content.replace(/、、/g, '、'); 

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${file}`);
      }
    }
  }
}

console.log('Starting modifier replacement...');
processDirectory(targetDir);
console.log('Done.');
