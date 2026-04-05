const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public', 'settings');

// Replacement configurations
// 1. Temporary protection maps
const protectMaps = [
  { pattern: /絶対防壁/g, replacement: '__PROTECTED_ZETTAIBOUHEKI__' },
  { pattern: /絶対性/g, replacement: '__PROTECTED_ZETTAISEI__' },
  { pattern: /絶対的/g, replacement: '__PROTECTED_ZETTAITEKI__' },
  { pattern: /静かな/g, replacement: '__PROTECTED_SHIZUKANA__' }, // Adjective might be needed for scenes
  { pattern: /微かな/g, replacement: '__PROTECTED_KASUKANA__' }
];

const restoreMaps = [
  { pattern: /__PROTECTED_ZETTAIBOUHEKI__/g, replacement: '絶対防壁' },
  { pattern: /__PROTECTED_ZETTAISEI__/g, replacement: '絶対性' },
  { pattern: /__PROTECTED_ZETTAITEKI__/g, replacement: '絶対的' }, // actually, modifying '絶対的' might be good, but we plan to keep or manually adjust.
  { pattern: /__PROTECTED_SHIZUKANA__/g, replacement: '静かな' },
  { pattern: /__PROTECTED_KASUKANA__/g, replacement: '微かな' }
];

const replacers = [
  // 圧倒的
  { pattern: /圧倒的なまでに/g, replacement: '' },
  { pattern: /圧倒的に/g, replacement: '' },
  { pattern: /圧倒的な/g, replacement: '' },
  { pattern: /圧倒的/g, replacement: '' },

  // 完璧
  { pattern: /完璧に/g, replacement: '' },
  { pattern: /完璧な/g, replacement: '' },

  // 絶対
  { pattern: /絶対に/g, replacement: '' },
  { pattern: /絶対なる/g, replacement: '' },
  { pattern: /絶対の/g, replacement: '' },
  { pattern: /絶対、/g, replacement: '' },

  // 異常
  { pattern: /異常なまでに/g, replacement: '' },
  { pattern: /異常な/g, replacement: '' },

  // 仕草・トリートメント
  { pattern: /静かに/g, replacement: '' },
  { pattern: /微かに/g, replacement: '' },
  { pattern: /かすかに/g, replacement: '' },
  
  // Custom specific
  { pattern: /残酷なまでに/g, replacement: '' },
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

      // 1. Protect
      for (const rule of protectMaps) {
        content = content.replace(rule.pattern, rule.replacement);
      }

      // 2. Eradicate Tropes
      for (const rule of replacers) {
        content = content.replace(rule.pattern, rule.replacement);
      }

      // 3. Restore Protections
      for (const rule of restoreMaps) {
        content = content.replace(rule.pattern, rule.replacement);
      }

      // 4. Grammar fixes for double particles created by deletion
      content = content.replace(/のの/g, 'の');
      content = content.replace(/、、/g, '、');
      content = content.replace(/。、/g, '。');
      content = content.replace(/、。/g, '。');

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${file}`);
      }
    }
  }
}

console.log('Starting AI trope removal...');
processDirectory(targetDir);
console.log('Done.');
