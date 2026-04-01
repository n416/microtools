import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { cleanMarkdown, stripMarkdown } from './utils_novel.js';
import { sortEpisodes } from '../episode_sequence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DOM環境のモック（DOMPurify用）
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// コマンドライン引数からフラグを取得
const isNoTerms = process.argv.includes('--no-terms');

// ディレクトリ設定
let distSettingsDir = path.resolve(__dirname, '../dist/export_resolved');
let outputTxtPath = path.resolve(__dirname, '../output_novel.txt');
let outputHtmlPath = path.resolve(__dirname, '../output_novel.html');

if (isNoTerms) {
  distSettingsDir = path.resolve(__dirname, '../dist/export_resolved_noterms');
  outputTxtPath = path.resolve(__dirname, '../output_novel_noterms.txt');
  outputHtmlPath = path.resolve(__dirname, '../output_novel_noterms.html');
}

function buildExports() {
  if (!fs.existsSync(distSettingsDir)) {
    console.error(`[Error] Directory not found: ${distSettingsDir}`);
    console.error('※ 先に npm run build を実行し、postbuild_mdx.js によるタグ置換を終わらせてください。');
    process.exit(1);
  }

  // distSettingsDir にある全てのmdxから、"ep"から始まる本編小説のみを抽出しソート
  // (yomikiri.mdx や plot.mdx などは出力に含めない)
  const files = fs.readdirSync(distSettingsDir)
    .filter(file => file.endsWith('.mdx'))
    .filter(file => /^ep\d+/.test(file))
    .sort(sortEpisodes);

  let fullMarkdown = '';
  let chapterCounter = 1;

  files.forEach(file => {
    const filePath = path.join(distSettingsDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // エピソードタイトルの話数を連番に変換（"第X話"が含まれる見出しのみ対象）
    if (/#\s*第[\d\.]+話/.test(content)) {
      content = content.replace(/#\s*第[\d\.]+話/g, `# 第${chapterCounter}話`);
      chapterCounter++;
    }

    // UIコンポーネント用HTMLタグなどを抽出除去
    const cleanedContent = cleanMarkdown(content);
    
    fullMarkdown += cleanedContent + '\n\n----------------------------------------\n\n';
  });

  // ========== txt出力 (Markdownテキスト → プレーンテキスト) ==========
  const preserveGlossary = !isNoTerms;
  let plainTextNovel = stripMarkdown(fullMarkdown, { preserveGlossary });
  
  // 余分な空白行の整理（常に実行される）
  // 全角スペースのみの行を完全な空行に変換
  plainTextNovel = plainTextNovel.replace(/^[ \t　]+$/gm, '');
  
  const lines = plainTextNovel.split(/\r?\n/);
  const newLines = [];
  
  const isSpecial = (str) => {
      if (!str) return false;
      const t = str.trim();
      if (/^(第\d+話|プロローグ|エピローグ|幕間)/.test(t)) return true;
      if (/^([＊◆◇【■▼]|POV|\[POV\])/i.test(t)) return true;
      if (/(視点|POV)/i.test(t)) return true;
      return false;
  };

  let emptyCount = 0;
  for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === '') {
          emptyCount++;
          
          // 保護対象のチェック: 前後のどちらかの行が「章見出し」や「＊」などの特殊行であれば、
          // 1行の空行でも優先的に保護する（そのまま残す）
          const prevStr = i > 0 ? lines[i-1] : '';
          const nextStr = i < lines.length - 1 ? lines[i+1] : '';
          
          if (isSpecial(prevStr) || isSpecial(nextStr)) {
              // 特殊行の前後なら、空行カウントを無視して1行アキを確保する
              // ただし、既に2つ以上出力されないようにする
              if (emptyCount <= 1) {
                  newLines.push('');
              }
          }
      } else {
          // テキスト行が来た場合、ここまでに溜まっていた空行を精算する
          // ルール: 1つの空行 -> 削除 (0), 2つ以上の空行 -> 1つにする
          // ※ ただし特殊行による保護で既に newLines の末尾が空行の場合は重複させない
          if (emptyCount >= 2) {
              if (newLines.length > 0 && newLines[newLines.length - 1] !== '') {
                  newLines.push('');
              }
          }
          
          newLines.push(line);
          emptyCount = 0;
      }
  }
  fs.writeFileSync(outputTxtPath, plainTextNovel, 'utf-8');
  console.log(`[Success] Created Text Novel: ${outputTxtPath} (Empty lines optimized manually)`);

  // ========== HTML出力 ==========
  const rawHtml = marked.parse(fullMarkdown);
  let cleanHtml = purify.sanitize(rawHtml);
  

  
  const htmlTemplate = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>投稿用データ</title>
  <style>
    body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    hr { margin: 40px 0; border: none; border-top: 2px dashed #ccc; }
    h1 { margin-top: 2em; }
  </style>
</head>
<body>
${cleanHtml.replace(/----------------------------------------/g, '<hr>')}
</body>
</html>`;

  fs.writeFileSync(outputHtmlPath, htmlTemplate, 'utf-8');
  console.log(`[Success] Created HTML Novel: ${outputHtmlPath}`);
}

console.log('[Export Novel] Starting compilation of resolved episodes...');
buildExports();
