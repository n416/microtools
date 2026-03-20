import fs from 'fs';
import path from 'path';

const targetDir = path.join(import.meta.dirname, '../public/settings');
// 絶対に使ってはいけない「AIの幻覚・先祖返り」NGワードリスト
const ngPatterns = [
  { regex: /偽装/, reason: 'マニュアルチューンは偽装（ステルス）ではなく物理アンカー（同期）です。「偽装」という単語自体がAIの幻覚を誘発するため全面禁止です' },
  { regex: /(マニュアルチューン.*切[っり]|マニュアルチューンなしで)/, reason: 'マニュアルチューンは絶対に切れません。出力を「絞る」などと表現してください' },
  { regex: /メモリ解放領域/, reason: 'システム側にパージエリアのような親切な設計はありません。自然現象です' }
];

let hasError = false;

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDirectory(fullPath);
    } else if (fullPath.endsWith('.mdx') || fullPath.endsWith('.txt')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        ngPatterns.forEach(ng => {
          if (ng.regex.test(line)) {
            console.error(`\x1b[31m[NGワード検知]\x1b[0m ${file} (Line ${index + 1})`);
            console.error(`  理由: ${ng.reason}`);
            console.error(`  該当: ${line.trim()}`);
            hasError = true;
          }
        });
      });
    }
  }
}

console.log('--- 🔍 世界観（Lore）の整合性チェックを開始 ---');
try {
  scanDirectory(targetDir);

  if (hasError) {
    console.error('\n❌ バグ（設定矛盾）が検知されました。AIの幻覚の可能性があります。');
    process.exit(1);
  } else {
    console.log('\n✅ 世界観の整合性は完全に保たれています（オールグリーン）。');
    process.exit(0);
  }
} catch (e) {
  console.error('\n❌ スクリプトの実行中にエラーが発生しました:', e.message);
  process.exit(1);
}
