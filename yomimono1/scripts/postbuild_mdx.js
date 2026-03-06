import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CharacterNames } from '../src/character_dictionary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトのルートディレクトリ
const projectRoot = path.join(__dirname, '..');
// ビルド後のファイル出力先 (Viteのデフォルトのdistフォルダ)
const distSettingsDir = path.join(projectRoot, 'dist', 'settings');

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

function processMdxFilesInDist() {
  if (!fs.existsSync(distSettingsDir)) {
    console.error(`Error: Directory not found: ${distSettingsDir}`);
    console.error('このスクリプトは "vite build" の直後にのみ実行してください。');
    process.exit(1);
  }

  const files = fs.readdirSync(distSettingsDir);
  let processedCount = 0;

  files.forEach(file => {
    if (file.endsWith('.mdx')) {
      const filePath = path.join(distSettingsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      const resolvedContent = resolveCharacters(content);

      if (content !== resolvedContent) {
        fs.writeFileSync(filePath, resolvedContent, 'utf-8');
        console.log(`[postbuild] Tags resolved in: ${file}`);
        processedCount++;
      }
    }
  });

  console.log(`[postbuild] Finished processing ${files.length} files. Modified ${processedCount} files.`);
}

console.log('[postbuild] Start resolving <Char> tags in dist/settings/*.mdx...');
processMdxFilesInDist();
