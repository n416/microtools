const fs = require('fs');
const path = require('path');

/**
 * mdxファイル群から頻出単語の重なり（リフレイン）を検出するユーティリティツール。
 * ターミナルから `node public/settings/analyze_word_freq.cjs` で実行します。
 * 結果は同じディレクトリに `word_frequency_report.txt` として出力されます。
 */

// 設定項目
const TARGET_DIR = __dirname;
const OUTPUT_FILE = path.join(__dirname, 'word_frequency_report.txt');
const MIN_LENGTH = 2; // 抽出する単語の最小文字数（1文字の助詞/記号を弾くため）
const OUTPUT_TOP_N = 1000; // 上位何件までレポートに出力するか

// 不要な一般的な機能語（助詞、助動詞、代名詞、記号など）のブラックリスト
const NOISE_WORDS = new Set([
  'する', 'こと', 'もの', 'いる', 'ある', 'その', 'この', 'あの', 'という', 'よう', 'そう',
  'しかし', 'そして', 'だが', 'それ', 'これ', 'あれ', 'から', 'まで', 'など', 'ない', 'ため',
  'しまう', 'てる', 'れる', 'られる', 'せる', 'させる', 'です', 'ます', 'なら', 'なり',
  'なく', 'だっ', 'って', 'たら', 'どう', 'どこ', 'なん', 'だけ', 'くらい', 'ばかり',
  'ながら', 'ため', 'ので', 'のに', 'かも', 'あるいは', 'および', 'かつ', 'つまり',
  'あるいは', 'そもそも', 'なぜ', 'いま', 'こそ', 'すぐ', 'よく', 'もう', 'まだ',
  'こんな', 'そんな', 'あんな', 'どんな', 'ここ', 'そこ', 'あそこ', 'どこ',
  '私', '俺', '僕', '彼', '彼女', '君', 'あなた', 'たち', 'お前', '貴様',
  '一つ', '二つ', '三つ', 'について', 'として', 'に対して', 'によって', 'にかけて',
  'ともに', 'とともに', 'ところ', 'はず', 'わけ', 'まま', 'かも', 'くらい'
]);

function isNoise(word) {
  if (word.length < MIN_LENGTH) return true; // 1文字を除外
  if (/^[0-9０-９]+$/.test(word)) return true; // 数字のみを除外
  if (/^[a-zA-Zａ-ｚＡ-Ｚ]+$/.test(word)) return true; // アルファベットのみ（HTMLタグ由来など）を除外
  if (/^[\p{Punctuation}\s]+$/u.test(word)) return true; // 記号のみを除外
  if (NOISE_WORDS.has(word)) return true;
  return false;
}

function runAnalysis() {
  const files = fs.readdirSync(TARGET_DIR).filter(f => f.match(/^ep\d{4}\.mdx$/)).sort();
  console.log(`Analyzing ${files.length} files...`);

  let totalText = '';
  for (const file of files) {
    totalText += fs.readFileSync(path.join(TARGET_DIR, file), 'utf8') + '\n';
  }

  // HTMLコメント、スクリプトタグなどを簡易的に除去
  totalText = totalText.replace(/<!--[\s\S]*?-->/g, ''); 
  totalText = totalText.replace(/<[^>]*>?/gm, '');

  console.log('Segmenting text...');
  const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
  const segments = segmenter.segment(totalText);

  const counts = {};

  for (const { segment, isWordLike } of segments) {
    if (!isWordLike) continue;
    const word = segment.trim();
    if (isNoise(word)) continue;

    counts[word] = (counts[word] || 0) + 1;
  }

  // 頻度順にソート
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  let outputContent = '=======================================\n';
  outputContent += '  頻出単語（リフレイン）分析レポート\n';
  outputContent += '=======================================\n\n';
  outputContent += `分析対象: ${files.length}ファイル\n`;
  outputContent += `（助詞・代名詞・${MIN_LENGTH}文字未満の単語は除外済み）\n\n`;

  let rank = 1;
  sorted.slice(0, OUTPUT_TOP_N).forEach(([word, count]) => {
    outputContent += `${String(rank).padStart(4, ' ')}位: ${word.padEnd(10, ' ')} (${count}回)\n`;
    rank++;
  });

  fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf8');
  console.log(`\nAnalysis complete! Report saved to:\n${OUTPUT_FILE}`);
}

try {
  runAnalysis();
} catch (err) {
  console.error('Error during analysis:', err);
}
