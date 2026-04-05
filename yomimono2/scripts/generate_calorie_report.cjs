const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '../public/settings/word_frequency_report.txt');
const outputFile = path.join(__dirname, '../public/settings/word_calorie_report.md');

const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');

const wordData = [];

// Parse the original report
for (const line of lines) {
  const match = line.match(/^\s*\d+位:\s*(\S+)\s*\((\d+)回\)/);
  if (match) {
    wordData.push({
      word: match[1],
      count: parseInt(match[2], 10)
    });
  }
}

// Semantic Scoring (The "AI" part encoded as heuristics)
const sClass = /死|殺|狂|絶|獄|犠|牲|呪|罰|惨|滅|裂|壊|毒|燃|爆|奪|闇|悪|葬|屍|血|痛|悲|哀|慟|哭|望|異|最|極|恐|怖|脅|威|剥/g;
const aClass = /怒|対|巨|大|莫|超|猛|烈|強|圧|倒|完|璧|究|魔|霊|神|奇|跡|魂|命|寿|搾|過|酷|冷|徹|氷|凍|炎|絶対|圧倒|限界|莫大/g;
const bClass = /剣|士|術|陣|契|約|炉|蓮|祈|願|愛|憎|孤|独|涙|泣|傷|嘘|罠|罪|絶望|狂気|悲鳴/g;
const cClass = /叩|斬|殴|撃|突|崩|砕|落|沈|叫|吠|焼|焦|煮|割/g;
const dClass = /時|間|空|界|世|計|算|効|率|値|価/g;

function calculateCalorie(word) {
  if (/^[ぁ-ん]+$/.test(word)) return 0; // Pure hiragana functional words have 0 calorie basically
  
  let score = 0;
  
  const sMatch = word.match(sClass);
  if (sMatch) score += sMatch.length * 300;
  
  const aMatch = word.match(aClass);
  if (aMatch) score += aMatch.length * 150;
  
  const bMatch = word.match(bClass);
  if (bMatch) score += bMatch.length * 80;
  
  const cMatch = word.match(cClass);
  if (cMatch) score += cMatch.length * 50;

  const dMatch = word.match(dClass);
  if (dMatch) score += dMatch.length * 20;

  // Length multiplier
  const multiplier = 1 + (word.length * 0.2);
  score = score * multiplier;

  // Character specific boosts (protagonists, etc)
  if (word === 'アルト' || word === 'ミア' || word === 'ローガン' || word === 'ニーナ') {
    score += 50; 
  }

  return score;
}

for (const item of wordData) {
  item.calorie = calculateCalorie(item.word);
  // Total Impact bounds the frequency so 399 counts of 'アルト' doesn't outweigh '絶望' just due to frequency
  item.impact = item.calorie * Math.pow(item.count, 0.6); 
}

// Sort by Total Impact descending
wordData.sort((a, b) => b.impact - a.impact);

let mdOutput = `# 頻出単語「高カロリー（読者への印象度）」ランキング\n\n`;
mdOutput += `単なる出現回数ではなく、単語自体が持つ**「意味の重さ・感情的な強さ（カロリー）」**と**「出現頻度」**を掛け合わせて、読者の脳内に強く印象に残る順に並び替えました。\n\n`;
mdOutput += `| 順位 | 単語 | 出現回数 | カロリー度(推定) | 総合インパクト |\n`;
mdOutput += `| :--- | :--- | :--- | :--- | :--- |\n`;

for (let i = 0; i < Math.min(200, wordData.length); i++) {
  const item = wordData[i];
  if (item.calorie === 0) continue; // Skip meaningless words
  
  let tier = '';
  if (item.impact > 3000) tier = '🔥激重';
  else if (item.impact > 1500) tier = '🧨重';
  else if (item.impact > 800) tier = '⚠️中';
  else tier = '🔹低';

  mdOutput += `| ${i + 1} | **${item.word}** | ${item.count}回 | ${tier} (${Math.round(item.calorie)}) | ${Math.round(item.impact)} |\n`;
}

fs.writeFileSync(outputFile, mdOutput, 'utf8');
console.log('Saved to ' + outputFile);
