const fs = require('fs');
const path = require('path');
const dir = './';
const files = fs.readdirSync(dir).filter(f => f.startsWith('ep') && f.endsWith('.mdx'));

const targets = [
  '楠（クスノキ）',
  '桂（カツラ）',
  '鉋屑（かんなくず）',
  '山桜（ヤマザクラ）',
  '木理（もくめ）',
  '逆目（さかめ）',
  '木口（こぐち）',
  '黒檀（コクタン）',
  '朴（ホオ）',
  '松（マツ）',
  '煤（すす）',
  '脂（やに）',
  'スギ（杉）',
  '順目（ならいめ）',
  '杉（スギ）',
  '暗部（深層記憶）',
  '詭弁（きべん）',
  '怜悧（れいり）',
  '話（裏）',
  '端（こっぱ）',
  '銀杏（イチョウ）',
  '姿（小鳥）',
  '穴（ピンホール）',
  '悪魔（ローガン）',
  '対象者（アルト）',
  '生命力（寿命）',
  '器（アルト）',
  '親株（生体コア）',
  '玉座（最強）',
  '解約（キー）',
  '沈黙（封印）',
  '機構（転換炉）',
  '実（コア）',
  '寿命（時間）',
  '話（エピローグ）',
  '華（睡蓮）',
  '代償（ロス）',
  'スタミナ（魔力経路の耐久力）'
];

let totalReplaced = 0;

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf-8');
  let newContent = content;
  let changed = false;
  
  targets.forEach(t => {
    if (newContent.includes(t)) {
      const replaced = t.replace('（', '〈').replace('）', '〉');
      newContent = newContent.split(t).join(replaced);
      changed = true;
      totalReplaced++;
    }
  });

  if (changed) {
    fs.writeFileSync(path.join(dir, f), newContent, 'utf-8');
  }
});

console.log(`Replacement complete. Found and replaced ${totalReplaced} unique patterns across files.`);
