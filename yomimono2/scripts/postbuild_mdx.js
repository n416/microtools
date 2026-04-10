import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CharacterNames } from '../src/character_dictionary.js';
import { ItTermDictionary } from '../src/it_term_dictionary.js';
import { TermDictionary } from '../src/term_dictionary.js';
import { TermFirstAppearanceMap } from '../src/term_map.js';
import { addSpaceAfterPunctuation } from '../src/text_formatter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトのルートディレクトリ
const projectRoot = path.join(__dirname, '..');
// 入力元 (Viteのデフォルトのdistフォルダの下のsettings)
const distSettingsDir = path.join(projectRoot, 'dist', 'settings');
// 出力先 (エクスポート用：用語解説あり)
const exportSettingsDir = path.join(projectRoot, 'dist', 'export_resolved');
// 出力先 (エクスポート用：用語解説なし)
const exportSettingsNoTermsDir = path.join(projectRoot, 'dist', 'export_resolved_noterms');
// 出力先 (Webプラットフォーム送信用：ルビ変換)
const exportSettingsRubyDir = path.join(projectRoot, 'dist', 'export_resolved_ruby');

function resolveCharacters(text) {
  return text.replace(/<Char\s+role="([^"]+)"(?:\s+callrole="([^"]+)")?\s+var="([^"]+)"\s*\/>/g, (match, role, callrole, variant) => {
    const charData = CharacterNames[role];
    if (!charData) return `[Unknown Char: ${role}]`;

    if (variant === 'furigana' || variant === 'age') {
      return charData[variant] || `[Unknown Prop: ${variant}]`;
    }

    if (callrole) {
      if (charData.callers?.[callrole]?.[variant]) {
        return charData.callers[callrole][variant];
      }
      // フォールバック: 指定されたcallroleが無い場合、'system'の該当バリエーションを探す
      if (charData.callers?.system?.[variant]) {
        return charData.callers.system[variant];
      }
      return `[Unknown Var: ${role}/${callrole} or system/${variant}]`;
    }

    return `[Missing CallRole: ${role}]`;
  });
}

function resolveTerms(text, currentEpisode, mode = 'expert') {
  const combinedDictionary = { ...ItTermDictionary, ...TermDictionary };
  const localSeen = new Set(); // ページ内で同一用語が複数回出た場合の重複防止
  const footnotes = [];
  let footnoteCounter = 1;

  let newText = text.replace(/<Term\s+id="([^"]+)"(?:\s*>([\s\S]*?)<\/Term>|\s*\/>)/g, (match, id, innerText) => {
    const termData = combinedDictionary[id];
    if (!termData) return `[Unknown Term: ${id}]`;

    if (mode === 'simple' && termData.simple_term) {
      return termData.simple_term;
    }

    const displayStr = (innerText && innerText.trim().length > 0) ? innerText : termData.term;

    if (mode === 'ruby') {
      if (termData.simple_term && TermFirstAppearanceMap[id] === currentEpisode && !localSeen.has(id)) {
        localSeen.add(id);
        return `｜${displayStr}《${termData.simple_term}》`;
      }
      localSeen.add(id);
      return displayStr;
    }

    if (mode !== 'expert') {
      return displayStr;
    }

    if (TermFirstAppearanceMap[id] === currentEpisode && !localSeen.has(id)) {
      localSeen.add(id);
      const mark = `※${footnoteCounter}`;
      footnotes.push(`${mark} ${termData.term}： ${termData.description}`);
      footnoteCounter++;
      return `${displayStr}（${mark}）`;
    } else {
      return displayStr;
    }
  });

  if (mode === 'expert' && footnotes.length > 0) {
    let footnoteMarkdown = '\n\n<div class="term-footnotes">\n\n**【用語解説】**\n\n';
    footnotes.forEach(note => {
      footnoteMarkdown += `${note}  \n`;
    });
    footnoteMarkdown += '</div>\n\n';
    
    const nextActionIndex = newText.indexOf('<div class="next-action">');
    if (nextActionIndex !== -1) {
      newText = newText.slice(0, nextActionIndex) + footnoteMarkdown + newText.slice(nextActionIndex);
    } else {
      newText += footnoteMarkdown;
    }
  }

  return newText;
}

function processMdxFilesInDist() {
  if (!fs.existsSync(distSettingsDir)) {
    console.error(`Error: Directory not found: ${distSettingsDir}`);
    console.error('このスクリプトは "vite build" の直後にのみ実行してください。');
    process.exit(1);
  }

  if (!fs.existsSync(exportSettingsDir)) {
    fs.mkdirSync(exportSettingsDir, { recursive: true });
  }
  if (!fs.existsSync(exportSettingsNoTermsDir)) {
    fs.mkdirSync(exportSettingsNoTermsDir, { recursive: true });
  }
  if (!fs.existsSync(exportSettingsRubyDir)) {
    fs.mkdirSync(exportSettingsRubyDir, { recursive: true });
  }

  const files = fs.readdirSync(distSettingsDir);
  let processedCount = 0;

  files.forEach(file => {
      if (file.endsWith('.mdx')) {
        const filePath = path.join(distSettingsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // ファイル名からエピソードIDを取得（連番付きなどもそのまま扱う）
        const currentEpisode = file.replace('.mdx', '');
  
        const charResolved = resolveCharacters(content);
        const fullyResolved = resolveTerms(charResolved, currentEpisode, 'expert');
        const noTermsResolved = resolveTerms(charResolved, currentEpisode, 'ignore');
        const rubyResolved = resolveTerms(charResolved, currentEpisode, 'ruby');

        const formattedFullyResolved = addSpaceAfterPunctuation(fullyResolved);
        const formattedNoTermsResolved = addSpaceAfterPunctuation(noTermsResolved);
        const formattedRubyResolved = addSpaceAfterPunctuation(rubyResolved);
  
        // エクスポート用ディレクトリに書き出す（dist/settingsの元ファイルは維持する）
        const outPath = path.join(exportSettingsDir, file);
        fs.writeFileSync(outPath, formattedFullyResolved, 'utf-8');
        
        // 用語解説なしのプレーンテキスト用ディレクトリにも書き出す
        const outPathNoTerms = path.join(exportSettingsNoTermsDir, file);
        fs.writeFileSync(outPathNoTerms, formattedNoTermsResolved, 'utf-8');

        // 同期用・ルビ変換済ディレクトリに書き出す
        const outPathRuby = path.join(exportSettingsRubyDir, file);
        fs.writeFileSync(outPathRuby, formattedRubyResolved, 'utf-8');

        console.log(`[postbuild] Tags resolved in: ${file} (expert/ignore/ruby)`);
        processedCount++;
      }
  });

  console.log(`[postbuild] Finished processing ${files.length} files. Modified ${processedCount} files.`);
}

console.log('[postbuild] Start resolving <Char> and <Term> tags in dist/settings/*.mdx...');
processMdxFilesInDist();
