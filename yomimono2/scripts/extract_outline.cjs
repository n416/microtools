const fs = require('fs');
const path = require('path');

const settingsDir = path.join(__dirname, '..', 'public', 'settings');
const outPath = path.join(__dirname, '..', 'outline_analysis.md');

// public/settings内のmdxファイルを直接取得してソート
const files = fs.readdirSync(settingsDir)
  .filter(f => f.endsWith('.mdx') && f !== 'yomikiri.mdx' && f !== 'plot.mdx' && f !== 'character.mdx' && f !== 'lifespan_economy.mdx' && !f.includes('spinoff'))
  .sort();

let output = '# Episode Outline & Action Density Analysis (Updated)\n\n';

for (const file of files) {
  const filePath = path.join(settingsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // タイトル取得
  const titleLine = lines.find(l => l.startsWith('# ')) || `# ${file}`;
  // POV行の取得
  const povLine = lines.find(l => l.includes('POV:')) || 'Unknown POV';
  
  // 行動量（会話と地の文の比率）の分析
  let dialogueLines = 0;
  let descriptionLines = 0;
  let timeSkipKeywords = [];
  
  // 時間経過を示すキーワード
  const timeKeywords = ['ヶ月', '年', '一晩', '翌日', '数日', '数週間', '時間経過', '気がつけば', 'その後', '数ヶ月'];

  let firstAction = '';
  let lastAction = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('<!--')) continue;
    
    if (trimmed.includes('「') && trimmed.includes('」')) {
      dialogueLines++;
    } else {
      descriptionLines++;
    }
    
    for (const kw of timeKeywords) {
      if (trimmed.includes(kw) && !timeSkipKeywords.includes(kw)) {
        timeSkipKeywords.push(kw);
      }
    }

    if (!firstAction && (descriptionLines + dialogueLines) > 0) {
      firstAction = trimmed.substring(0, 50) + '...';
    }
    lastAction = trimmed.substring(0, 50) + '...';
  }

  const totalRawLines = lines.length;
  const totalLines = dialogueLines + descriptionLines;
  const dialogueRatio = totalLines > 0 ? Math.round((dialogueLines / totalLines) * 100) : 0;
  
  output += `## ${titleLine.replace('# ', '')} (${file})\n`;
  output += `- POV: ${povLine.replace('<!--', '').replace('-->', '').trim()}\n`;
  output += `- 実質行数: ${totalLines}行 (物理総行数: ${totalRawLines}行) (会話: ${dialogueLines}行 / 地の文: ${descriptionLines}行 / 会話率: ${dialogueRatio}%)\n`;
  output += `- 時間経過ワード: ${timeSkipKeywords.length > 0 ? timeSkipKeywords.join(', ') : 'なし'}\n`;
  if (totalLines > 0) {
    output += `- 冒頭: ${firstAction}\n`;
    output += `- 末尾: ${lastAction}\n`;
  }
  output += `\n`;
}

fs.writeFileSync(outPath, output, 'utf-8');
console.log('Saved outline analysis to:', outPath);
