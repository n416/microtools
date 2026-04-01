import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sortEpisodes } from '../episode_sequence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsDir = path.resolve(__dirname, '../public/settings');

const files = fs.readdirSync(settingsDir)
  .filter(file => file.endsWith('.mdx'))
  .filter(file => /^ep\d+/.test(file))
  .sort(sortEpisodes);

console.log(`Found ${files.length} episode files.`);

// 情報を配列にストック
const tasks = files.map((file, index) => {
  const chapterNumber = index + 1;
  const newNumberStr = String(chapterNumber * 10).padStart(4, '0');
  const newFileName = `ep${newNumberStr}.mdx`;
  const tempFileName = `temp_${newFileName}`;
  
  return {
    oldFile: file,
    tempFile: tempFileName,
    newFile: newFileName,
    chapterNumber
  };
});

// ステップ1: 一時ファイルへ出力（同時にタイトル書き換え）
tasks.forEach(task => {
  const oldPath = path.join(settingsDir, task.oldFile);
  const tempPath = path.join(settingsDir, task.tempFile);
  
  let content = fs.readFileSync(oldPath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  if(lines.length > 0 && lines[0].startsWith('#')) {
    const chapterStr = String(task.chapterNumber).padStart(2, '0'); // 01, 02...
    lines[0] = lines[0].replace(/第[\d\.]+話/, `第${chapterStr}話`);
    content = lines.join('\n');
  }
  
  fs.writeFileSync(tempPath, content, 'utf-8');
  console.log(`[Step1] Processed & Wrote ${task.oldFile} -> ${task.tempFile}`);
});

// ステップ2: 古いファイルを削除（ただし tempFile と newFile に重なるものは削除しないが、
// tempFile は必ず "temp_" 開始なので競合しない。元のファイルだけを消す）
tasks.forEach(task => {
  const oldPath = path.join(settingsDir, task.oldFile);
  if (fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
  }
});

// ステップ3: 一時ファイルを最終名にリネーム
tasks.forEach(task => {
  const tempPath = path.join(settingsDir, task.tempFile);
  const finalPath = path.join(settingsDir, task.newFile);
  fs.renameSync(tempPath, finalPath);
  console.log(`[Step3] Renamed to final: ${task.newFile}`);
});

console.log('Successfully completed renaming and title updates.');
