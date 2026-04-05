const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public', 'settings');

const replacers = [
  // 1. 絶対的の処理
  { pattern: /絶対的なまでに/g, replacement: '' },
  { pattern: /絶対的な/g, replacement: '' },
  { pattern: /絶対的に/g, replacement: '' },

  // 2. 最悪の処理（設定以外のテンプレ表現）
  { pattern: /最悪の結末/g, replacement: '絶望的な結末' },
  { pattern: /最悪の負債/g, replacement: '呪いのような負債' },
  { pattern: /最悪な死に顔/g, replacement: '身勝手な死に顔' },
  { pattern: /史上最悪の命価効率/g, replacement: '前代未聞の命価効率' },
  { pattern: /最悪の自爆回路/g, replacement: '悪辣な自爆回路' },
  { pattern: /最悪の『奴隷契約』/g, replacement: '非道な『奴隷契約』' },
  { pattern: /最悪の効率/g, replacement: '最低の効率' }, // For generic uses not strictly '命価効率が最悪'

  // 3. 究極の処理
  { pattern: /究極の契約魔法/g, replacement: '神髄たる契約魔法' },
  { pattern: /究極の適合パイプ/g, replacement: '無二の適合パイプ' },
  { pattern: /究極の適合器/g, replacement: '無二の適合器' },
  { pattern: /究極の因果律/g, replacement: '極致の因果律' },
  { pattern: /究極の希望/g, replacement: '唯一の希望' },
  { pattern: /究極の存在/g, replacement: '矛盾の存在' },
  { pattern: /究極の効率/g, replacement: '最高の効率' },
  { pattern: /究極の魔法構造理論/g, replacement: '魔法構造理論' },
  { pattern: /究極の爆発/g, replacement: '空前絶後の大爆発' },
  { pattern: /究極の無駄/g, replacement: '最大の無駄' },
  { pattern: /究極の/g, replacement: '' }, // Fallback

  // 4. 莫大の処理
  // 莫大 is often used but AI uses it too much for mana/lifespan. We'll downgrade most to 膨大 or simple forms.
  { pattern: /莫大な/g, replacement: '膨大な' },
  { pattern: /莫大で/g, replacement: '膨大で' },
  { pattern: /莫大に/g, replacement: '過大に' }
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

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${file}`);
      }
    }
  }
}

console.log('Starting remaining AI trope removal...');
processDirectory(targetDir);
console.log('Done.');
