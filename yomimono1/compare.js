import fs from 'fs';
const koreContent = fs.readFileSync('public/settings/kore.txt', 'utf-8');
const outputContent = fs.readFileSync('output_novel.txt', 'utf-8');

const kore = koreContent.replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd());
const output = outputContent.replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd());

let diffCount = 0;
let outBody = [];
for (let i = 0; i < Math.max(kore.length, output.length); i++) {
  if (kore[i] !== output[i]) {
    outBody.push(`Line ${i + 1}`);
    outBody.push(`kore  : ${kore[i] === undefined ? 'EOF' : kore[i]}`);
    outBody.push(`output: ${output[i] === undefined ? 'EOF' : output[i]}`);
    outBody.push('---');
    diffCount++;
    if (diffCount >= 10) break;
  }
}

if (diffCount === 0) {
  outBody.push('完全一致しています。');
} else {
  outBody.push(`${diffCount}件以上の違いがありました。`);
}

fs.writeFileSync('compare_out2.txt', outBody.join('\n'), 'utf-8');
console.log('Done');
