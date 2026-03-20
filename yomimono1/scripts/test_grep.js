import fs from 'fs';

const text = fs.readFileSync('output_novel_ruby.txt', 'utf8');
const lines = text.split('\n');

let out = '=== ―― (ダッシュ) ===\n';
lines.forEach((line, i) => {
  if (line.match(/^[ 　]*――/)) {
    out += `[${i+1}] ${line}\n`;
  }
});

out += '\n=== 『 (二重鍵括弧) ===\n';
lines.forEach((line, i) => {
  if (line.match(/^[ 　]*『/)) {
    out += `[${i+1}] ${line}\n`;
  }
});

fs.writeFileSync('temp_analysis.txt', out, 'utf-8');
