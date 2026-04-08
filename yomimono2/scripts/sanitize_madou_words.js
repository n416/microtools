import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトの public/settings ディレクトリを指定
const targetDir = path.resolve(__dirname, '../public/settings');

// ターミナル用カラーコード
const ANSI_YELLOW = '\x1b[33m';
const ANSI_RED = '\x1b[31m';
const ANSI_RESET = '\x1b[0m';

// 「魔導」を「魔法」に変換するルールリスト
const replaceRules = [
  { match: /魔導書/g, replace: '魔法書' },
  { match: /魔導士/g, replace: '魔法士' },
  { match: /魔導院/g, replace: '魔法院' },
  { match: /生体魔導具/g, replace: '生体魔法具' },
  { match: /魔導具/g, replace: '魔法具' },
  { match: /魔導炉/g, replace: '魔法炉' },
  { match: /魔導理論/g, replace: '魔法理論' },
  { match: /魔導基盤/g, replace: '魔法基盤' },
  { match: /魔導体/g, replace: '魔法体' },
  { match: /魔導/g, replace: '魔法' }
];

function sanitizeDirectory() {
  if (!fs.existsSync(targetDir)) {
    console.warn(`[Sanitize Warning] Directory not found: ${targetDir}`);
    return;
  }

  const files = fs.readdirSync(targetDir).filter(file => file.endsWith('.mdx'));
  let modifiedFiles = 0;
  let totalViolations = 0;

  for (const file of files) {
    const filePath = path.join(targetDir, file);
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    let newContent = originalContent;
    let foundTerms = new Set();

    for (const rule of replaceRules) {
      const matches = newContent.match(rule.match);
      if (matches) {
        matches.forEach(m => {
          foundTerms.add(`"${m}" -> "${rule.replace}"`);
          totalViolations++;
        });
        newContent = newContent.replace(rule.match, rule.replace);
      }
    }

    if (originalContent !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf-8');
      modifiedFiles++;
      console.warn(`${ANSI_YELLOW}⚠️ [Sanitize WARNING] 「魔導」という世界観NGワードが検出され、自動浄化されました！${ANSI_RESET}`);
      console.warn(`    ${ANSI_RED}対象ファイル: ${file}${ANSI_RESET}`);
      console.warn(`    置換内容: ${Array.from(foundTerms).join(', ')}\n`);
    }
  }

  if (modifiedFiles > 0) {
    console.log(`✅ [Sanitize Complete] 計 ${modifiedFiles} 個のソースファイルから ${totalViolations} 箇所の「魔導」を「魔法」に自動浄化し、上書き保存しました。\n`);
  } else {
    console.log(`✅ [Sanitize OK] 「魔導」というNG単語によるソースファイルの汚染はありません。\n`);
  }
}

console.log('[Sanitize Madou Words] 全ファイルの自動浄化(魔導撲滅)チェックを開始します...');
sanitizeDirectory();
