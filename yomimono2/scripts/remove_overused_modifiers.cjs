const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public', 'settings');

// Replacement configurations
const replacers = [
  { pattern: /氷のように冷徹な/g, replacement: '氷のような' },
  { pattern: /ひどく冷徹に/g, replacement: '' },
  { pattern: /ひどく冷徹な/g, replacement: '冷たい' },
  { pattern: /、ひどく冷徹な/g, replacement: '、' }, 
  
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

      content = content.replace(/のの/g, 'の'); 
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
