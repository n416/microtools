import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ItTermDictionary } from '../src/it_term_dictionary.js';
import { TermDictionary } from '../src/term_dictionary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const episodeSequence = [
  'ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep6', 'ep7', 'ep8', 'ep8_5', 'ep9',
  'ep10_1', 'ep10_2', 'ep10_3', 'ep11', 'ep12_0', 'ep12_1', 'ep12_2',
  'ep13_0', 'ep13_1', 'ep13_2', 'ep13_3', 'ep13_4', 'ep13_5', 'ep13_6', 'ep13_7',
  'ep14', 'ep14_1', 'ep14_2', 'ep15', 'ep15_5', 'ep16_0', 'ep16_0_5', 'ep16_0_6', 'ep16_1', 'ep17', 'ep17_5', 'ep18', 'ep19_1', 'ep19_2', 'ep19_3', 'ep19_4', 'ep20', 'ep21', 'ep22'
];

const combinedDictionary = { ...ItTermDictionary, ...TermDictionary };
const settingsPath = path.join(__dirname, '..', 'public', 'settings');

// 検索ターゲットのリストを作成
const allSearchWords = [];
function addWords(dictionary, type) {
  for (const [id, item] of Object.entries(dictionary)) {
    const words = item.term
      .split(/[\/／（(]/)
      .map(w => w.replace(/[）)]/g, '').trim())
      .filter(w => w.length > 0);

    for (const word of words) {
      allSearchWords.push({
        id,
        word,
        term: item.term,
        description: item.description,
        type
      });
    }
  }
}
addWords(ItTermDictionary, 'IT');
addWords(TermDictionary, 'NOVEL');

// 誤爆を防ぐため、長い単語から優先的にマッチさせるように降順ソート
allSearchWords.sort((a, b) => b.word.length - a.word.length);

// 英数字のみかどうか判定
function isAlphaNumeric(char) {
  if (!char) return false;
  return /^[a-zA-Z0-9]$/.test(char);
}

// テキスト内の指定されたオフセット位置が、HTMLタグの中（既にタグ化されている場所等）にあるかを判定する
function isInsideTag(text, offset) {
  const lastOpen = text.lastIndexOf('<', offset);
  const lastClose = text.lastIndexOf('>', offset);
  return lastOpen > lastClose;
}

// 見出し（# または <h1〜6>）の中にいるかを判定する
function isInsideHeading(text, offset) {
  const lastNewline = text.lastIndexOf('\n', offset);
  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
  const lineToOffset = text.substring(lineStart, offset);
  
  if (/^\s*#+/.test(lineToOffset)) return true;
  
  const lastOpenHeader = text.lastIndexOf('<h', offset);
  if (lastOpenHeader !== -1) {
    const isHeadingTag = /<h[1-6][\s>]/.test(text.substring(lastOpenHeader, Math.min(text.length, lastOpenHeader + 4)));
    if (isHeadingTag) {
      const lastCloseHeader = text.lastIndexOf('</h', offset);
      if (lastCloseHeader < lastOpenHeader) {
        return true;
      }
    }
  }
  return false;
}

const seenTermIds = new Set();
let modifiedFilesCount = 0;

console.log('--- <Term>タグ自動付与スクリプト ---');

for (const ep of episodeSequence) {
  const filePath = path.join(settingsPath, `${ep}.mdx`);
  if (!fs.existsSync(filePath)) continue;

  const originalContent = fs.readFileSync(filePath, 'utf8');
  
  // 1. クリーンアップ処理
  // 過去にこのスクリプトで付与された <Term id="...">〜</Term> または <Term id="..." /> を一旦プレーンテキストに戻す
  // <Term>自体を取り除くことで、無限にネストされるのを防ぎます
  let cleanedContent = originalContent.replace(/<Term\s+id="[^"]*"\s*>(.*?)<\/Term>/g, '$1');
  cleanedContent = cleanedContent.replace(/<Term\s+id="[^"]*"\s*\/>/g, ''); // 万一閉じタグ無しのパターンがあれば消す
  
  let isModified = (cleanedContent !== originalContent);

  // 2. 初出用語の検索とタグ付与
  const activeTargets = allSearchWords.filter(t => !seenTermIds.has(t.id));

  if (activeTargets.length > 0) {
    const regexPattern = '(' + activeTargets.map(t => t.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')';
    const regex = new RegExp(regexPattern, 'g');

    cleanedContent = cleanedContent.replace(regex, (match, word, offset) => {
      // HTMLタグの中身であれば置換しない（<Char role="..." /> の中など）
      if (isInsideTag(cleanedContent, offset)) {
        return match;
      }

      // 見出しであれば置換しない
      if (isInsideHeading(cleanedContent, offset)) {
        return match;
      }

      const target = activeTargets.find(t => t.word === word);
      if (!target) return match;

      // 1〜10話では世界観（NOVEL）の辞書は展開しない（ネタバレ防止）
      const epIndex = episodeSequence.indexOf(ep);
      const ep11Index = episodeSequence.indexOf('ep11');
      if (target.type === 'NOVEL' && epIndex < ep11Index) {
        return match;
      }

      // すでに他の場所で処理されたかチェック
      if (seenTermIds.has(target.id)) {
        return match;
      }

      // 「PM」などのアルファベットの場合、単語の一部でないことを確認（前後の文字で判定）
      if (/^[a-zA-Z0-9]+$/.test(word)) {
        const prevChar = offset > 0 ? cleanedContent[offset - 1] : null;
        const nextChar = offset + word.length < cleanedContent.length ? cleanedContent[offset + word.length] : null;
        if (isAlphaNumeric(prevChar) || isAlphaNumeric(nextChar)) {
          return match;
        }
      }

      // 初出として記録し、<Term>タグでラップする
      seenTermIds.add(target.id);
      console.log(`[自動付与] ${ep}.mdx: 「${word}」を <Term id="${target.id}"> に置換`);
      isModified = true;
      return `<Term id="${target.id}">${word}</Term>`;
    });
  }

  // 3. 変更があればファイルを保存
  if (isModified) {
    fs.writeFileSync(filePath, cleanedContent, 'utf8');
    modifiedFilesCount++;
  }
}

console.log(`\n完了: ${modifiedFilesCount} 個のファイルで <Term> タグの自動付与を更新しました。`);
