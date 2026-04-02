import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const novelPath = path.resolve(__dirname, '../output_novel_noterms.txt');

const content = fs.readFileSync(novelPath, 'utf-8');
const lines = content.split('\n');

let currentPov = '不明';
const violations = [];

const particles = ['は', 'が', 'の', 'に', 'を', 'へ', 'と', 'も', 'で', 'って'];
// 心理描写・内面の断定ワード
const mentalVerbsMatches = ['思った', '安堵した', '焦った', '悩んだ', '決意', '悲しんだ', '喜んだ', '感じた', '気が付い', '思い知っ', '絶望し', '安心し', '胸をなでおろ', '悟った', '痛感', '内心', '心の中', '胸の内'];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line === '') continue;

  const povMatch = line.match(/^\[POV:\s*(.*?)\]/);
  if (povMatch) {
    currentPov = povMatch[1].trim();
    continue;
  }

  if (line.startsWith('「') || line.startsWith('『') || line.startsWith('//')) continue;
  
  // 地の文のみ検査（カッコ内のセリフなどを先に除去して判定のノイズを減らす）
  let narrative = line.replace(/「.*?」/g, '').replace(/『.*?』/g, '');
  if (narrative.trim() === '') continue;

  let lineViolations = [];

  // 一人称の混同チェック
  if (currentPov === 'アルト' || currentPov === 'ローガン') {
    // 視点がアルト/ローガンなのに「私」が地の文にある
    const regexPriv = new RegExp(`(^|[^a-zA-Z0-9_])(私)(${particles.join('|')})`, 'g');
    if (regexPriv.test(narrative) && !narrative.match(/アルトは.*私/)) {
      // ※「アルトは私に...」等は許容するか？いや、アルトPOVなら「ミアに」等と書くべきだから基本アウト。
      lineViolations.push(`一人称混入(私)`);
    }
  } else if (currentPov === 'ミア') {
    // 視点がミアなのに「俺」「僕」などが地の文にある
    const regexMasc = new RegExp(`(^|[^a-zA-Z0-9_])(俺|僕|オレ|ボク)(${particles.join('|')})`, 'g');
    if (regexMasc.test(narrative)) {
      lineViolations.push(`一人称混入(俺/僕)`);
    }
  }

  // 神視点のチェック
  // 「（他者）＋（助詞）＋〜＋（心理動詞）」のパターン
  let otherCharsRegex;
  if (currentPov === 'ミア') {
    otherCharsRegex = /(アルト|ローガン|彼女|彼|男|兵士|エルフ|人々|客|店主)/;
  } else if (currentPov === 'アルト') {
    otherCharsRegex = /(ミア|ローガン|彼女|彼|男|兵士|エルフ|人々|客|店主|先生)/;
  } else {
    otherCharsRegex = /(ミア|アルト|彼女|彼|男|兵士|エルフ|人々|客|店主)/;
  }

  // もしその行に他者の名前が含まれていて、かつ心理描写動詞があるなら、文脈的に他者を透視している可能性が高い
  if (otherCharsRegex.test(narrative)) {
    for (let verb of mentalVerbsMatches) {
      if (narrative.includes(verb)) {
         // 推測系の語尾がついていないか一応確認（でも厳しめに拾うため除外条件は少なくする）
         if (!narrative.includes('見え') && !narrative.includes('そうだった') && !narrative.includes('思えた')) {
            lineViolations.push(`神視点疑い（${verb}）`);
            break;
         }
      }
    }
  }

  // 更なる透視表現（「〜と知る由もなかった」「気づいていなかった」など、視点人物が知り得ない情報の断定）
  if (narrative.includes('知る由もなかった') || narrative.includes('気づいていなかった')) {
      if (!narrative.includes('私') && !narrative.includes('俺') && !narrative.includes('僕')) {
          lineViolations.push('情報透視（知る由もなかった等）');
      }
  }

  if (lineViolations.length > 0) {
    violations.push({ lineNum: i + 1, pov: currentPov, text: narrative, triggers: lineViolations.join(', ') });
  }
}

const reportPath = path.resolve(__dirname, '../pov_audit_results.md');
let reportContent = '# 三人称一元視点 監査レポート\n\n';
for (let v of violations) {
  reportContent += `- **Line ${v.lineNum}** [POV: ${v.pov}] (Trigger: ${v.triggers})\n`;
  reportContent += `  > ${v.text}\n\n`;
}

fs.writeFileSync(reportPath, reportContent, 'utf-8');
console.log(`[Success] Written ${violations.length} potential violations to pov_audit_results.md`);
