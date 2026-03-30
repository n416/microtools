import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { cleanMarkdown, stripMarkdown } from './utils_novel.js';
import { sortEpisodes, episodeSequence } from '../episode_sequence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DOM環境のモック（DOMPurify用）
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// コマンドライン引数からフラグを取得
const isNoTerms = process.argv.includes('--no-terms');
const isSimpleTerms = process.argv.includes('--simple-terms');
const isRubyTerms = process.argv.includes('--ruby-terms');

// ディレクトリ設定
let distSettingsDir = path.resolve(__dirname, '../dist/export_resolved');
let outputTxtPath = path.resolve(__dirname, '../output_novel.txt');
let outputHtmlPath = path.resolve(__dirname, '../output_novel.html');

if (isNoTerms) {
  distSettingsDir = path.resolve(__dirname, '../dist/export_resolved_noterms');
  outputTxtPath = path.resolve(__dirname, '../output_novel_noterms.txt');
  outputHtmlPath = path.resolve(__dirname, '../output_novel_noterms.html');
} else if (isSimpleTerms) {
  distSettingsDir = path.resolve(__dirname, '../dist/export_resolved_simple');
  outputTxtPath = path.resolve(__dirname, '../output_novel_simple.txt');
  outputHtmlPath = path.resolve(__dirname, '../output_novel_simple.html');
} else if (isRubyTerms) {
  distSettingsDir = path.resolve(__dirname, '../dist/export_resolved_ruby');
  outputTxtPath = path.resolve(__dirname, '../output_novel_ruby.txt');
  outputHtmlPath = path.resolve(__dirname, '../output_novel_ruby.html');
}


function buildExports() {
  if (!fs.existsSync(distSettingsDir)) {
    console.error(`[Error] Directory not found: ${distSettingsDir}`);
    console.error('※ 先に npm run build を実行し、postbuild_mdx.js によるタグ置換を終わらせてください。');
    process.exit(1);
  }

  // 指定された順番に沿って存在するファイルのみを抽出（短編のep0000.mdxは出力から除外）
  const files = episodeSequence
    .map(basename => `${basename}.mdx`)
    .filter(f => f !== 'ep0000.mdx' && fs.existsSync(path.join(distSettingsDir, f)));

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
  const preserveGlossary = !isNoTerms && !isSimpleTerms && !isRubyTerms;
  const plainTextNovel = stripMarkdown(fullMarkdown, { preserveGlossary });
  fs.writeFileSync(outputTxtPath, plainTextNovel, 'utf-8');
  console.log(`[Success] Crated Text Novel: ${outputTxtPath}`);

  // ========== HTML出力 ==========
  const rawHtml = marked.parse(fullMarkdown);
  let cleanHtml = purify.sanitize(rawHtml);
  
  // --ruby-terms フラグがある場合はルビ記法をHTMLルビタグに変換する
  if (isRubyTerms) {
    cleanHtml = cleanHtml.replace(/｜(.+?)《(.+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
  }
  
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
