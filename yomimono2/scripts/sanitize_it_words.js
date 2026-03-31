import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトの public/settings ディレクトリを指定
const targetDir = path.resolve(__dirname, '../public/settings');

// ターミナル用カラーコード
const ANSI_YELLOW = '\\x1b[33m';
const ANSI_RED = '\\x1b[31m';
const ANSI_RESET = '\\x1b[0m';

// ユーザーが拡張可能なNGワードとその置換先のリスト
const replaceRules = [
  // --- 完全なIT・機械用語 ---
  { match: /オートマティック/g, replace: '無意識的' },
  { match: /ワイヤーフレーム/g, replace: '骨組み' },
  { match: /オーバーヒート(?:する|した)?/g, replace: '限界を超えて焼き切れる' },
  { match: /オーバーヒート/g, replace: '限界突破' },
  { match: /エラーコード/g, replace: '異常な警告' },
  { match: /ハイジャック(?:する|された)?/g, replace: '強引に乗っ取られる' },
  { match: /ハイジャック/g, replace: '乗っ取り' },
  { match: /ネットワーク/g, replace: '魔力網' },
  { match: /キャンセル(?:する|した)?/g, replace: '白紙に戻す' },
  { match: /キャンセル/g, replace: '破棄' },
  { match: /プログラム/g, replace: '術式' },
  { match: /プロセス/g, replace: '構築の過程' },
  { match: /アクセス(?:する|した)?/g, replace: '術式へ干渉' },
  { match: /アクセス/g, replace: '干渉' },
  { match: /ウイルス/g, replace: '呪詛' },
  { match: /ディレイ/g, replace: '隙' },
  { match: /エラー/g, replace: '異常' },
  { match: /バグ/g, replace: '欠陥' },

  // --- 安易な泥・水っぽさの比喩表現（AIの手癖） ---
  { match: /泥水をすす(?:る|った|って)/g, replace: '地を這うように生き' },
  { match: /泥水のような/g, replace: '惨めな' },
  { match: /泥の中で死に場所を/g, replace: 'この掃き溜めで死に場所を' },
  { match: /泥の中のぬるま湯/g, replace: '掃き溜めのぬるま湯' },
  { match: /泥の中を生き抜いてきた/g, replace: 'どん底を生き抜いてきた' },
  { match: /泥のように/g, replace: '深く' },
  { match: /泥の底/g, replace: '底辺' },
  { match: /泥にまみれて/g, replace: '薄汚れて' },
  { match: /泥まみれ/g, replace: '薄汚れ' },
  { match: /泥臭い/g, replace: '無骨な' },
  { match: /泥臭く/g, replace: '無骨に' },
  { match: /泥濘（ぬかるみ）/g, replace: '石畳' },
  { match: /ドロドロの泥水の中/g, replace: '冷たい水溜まりの中' },
  { match: /顔面から泥に突っ込んだ/g, replace: '盛大に転倒した' },
  { match: /顔の泥を/g, replace: '顔の汚れを' },
  { match: /泥だらけの小さな頭を/g, replace: '水びたしの小さな頭を' },
  { match: /泥水の中に両膝を/g, replace: '汚れた石畳に両膝を' },
  { match: /泥水の中に/g, replace: '暗がりの中に' },
  { match: /泥水の中/g, replace: '暗がりの中' },
  { match: /泥水の上に/g, replace: '足元に' },
  { match: /泥水を/g, replace: '淀んだ空気を' },
  { match: /泥だらけの/g, replace: '煤けた' },
  { match: /泥土/g, replace: '掃き溜め' },
  { match: /泥道/g, replace: '路地裏' },
  { match: /泥の地面/g, replace: '冷たい石畳' },
  { match: /泥の床/g, replace: '冷たい石畳' },
  { match: /泥水/g, replace: '薄暗い路地' },
  { match: /泥沼/g, replace: '底なしの沼' },
  { match: /泥の中/g, replace: 'どん底' },
  { match: /その泥/g, replace: 'その汚れ' },
  { match: /服の泥/g, replace: '服の汚れ' },
  { match: /泥/g, replace: '汚れ' }
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
    let foundTerms = new Set(); // ファイル内のNGワード重複をまとめる

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
      // 置換が発生した場合、視覚的に目立つ警告として詳細を出力
      console.warn(`${ANSI_YELLOW}⚠️ [Sanitize WARNING] AIのNGワードが検出され、自動浄化されました！${ANSI_RESET}`);
      console.warn(`    ${ANSI_RED}対象ファイル: ${file}${ANSI_RESET}`);
      console.warn(`    置換内容: ${Array.from(foundTerms).join(', ')}\n`);
    }
  }

  if (modifiedFiles > 0) {
    console.log(`✅ [Sanitize Complete] 計 ${modifiedFiles} 個のソースファイルから ${totalViolations} 箇所のNG用語を自動浄化し、上書き保存しました。\\n`);
  } else {
    // 正常・クリーンな場合は目立たないように1行だけ出力
    console.log(`✅ [Sanitize OK] AIの悪癖(バグ・泥等)に関わるソースファイルの汚染はありません。\\n`);
  }
}

console.log('[Sanitize IT-Words & Mud] 全ファイルの自動浄化チェックを開始します...');
sanitizeDirectory();
