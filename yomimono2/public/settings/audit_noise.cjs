const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx'));

const noiseRegex = /終わらせてやりたい|殺してやりたい|顔を赤|頬を染め|ツンデレ|極上の|至高の|狂気的なまでに/g;
const povClunkyRegex = /彼女自身|彼自身|ミア自身|アルト自身/g;

let reportMarkdown = '# AIキャラ崩壊ノイズ＆POV再評価レポート\n\nご負担をおかけして申し訳ありません。全41話から以下の2点を機械抽出しました。\n\n## 1. AIキャラ崩壊・過剰表現ノイズ（削除推奨）\n\n';

let noiseItems = [];
let clunkyItems = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // 独白とセリフを除外した地の文を中心に見るため、簡単なフィルタ
    // しかしノイズは独白にも混ざるためここでは全行対象
    if (noiseRegex.test(line)) {
      noiseItems.push(`- **${file}** (L${index + 1}): \`${line.trim()}\``);
    }
    
    // POVの冗長性チェック：同じ行に「自身」や「彼/彼女」が複数入ってくどい場合
    const matches = line.match(povClunkyRegex);
    if (matches && matches.length >= 1) {
      // 少し厳し目に、文が長いか、2回以上出ているものをピックアップ
      if (matches.length > 1 || line.includes('彼自身が') || line.includes('彼女自身が')) {
         clunkyItems.push(`- **${file}** (L${index + 1}): \`${line.trim()}\``);
      }
    }
  });
}

if (noiseItems.length === 0) {
  reportMarkdown += '疑わしいノイズは見つかりませんでした。\n\n';
} else {
  reportMarkdown += noiseItems.join('\n') + '\n\n';
}

reportMarkdown += '## 2. 三人称一元視点として「元の表現（自分など）」の方が美しかったかもしれない箇所\n\n今回の修正で「彼自身」「彼女自身」などに置換しましたが、くどくなってしまい「三人称一元視点であっても、心理描写に限り『自分』と表現する方が自然で美しかった」と思われる箇所です。（元に戻すことを推奨します）\n\n';

if (clunkyItems.length === 0) {
  reportMarkdown += '該当箇所は見つかりませんでした。\n';
} else {
  reportMarkdown += clunkyItems.join('\n') + '\n';
}

fs.writeFileSync(path.join(dir, 'noise_report.md'), reportMarkdown);
console.log('Report generated.');
