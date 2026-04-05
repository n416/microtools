const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public', 'settings');

const phase2bcReplacements = [
  // 巨大
  {
    "target": "巨大な命力が『たった一瞬に凝縮された重低音』のような破裂として",
    "replace": "規格外の命力が『たった一瞬に凝縮された重低音』のような破裂として"
  },
  {
    "target": "巨大な空間と重力を歪ませて爆発的に空へと放たれた",
    "replace": "空間と重力を激しくひしゃげさせて爆発的に空へと放たれた"
  },
  {
    "target": "巨大な光の直撃をその身にまともに浴びながら",
    "replace": "山の如き閃光の直撃をその身にまともに浴びながら"
  },
  {
    "target": "そんな果てしなく巨大な未知の回路全体を",
    "replace": "そんな果てしなく底知れぬ未知の回路全体を"
  },
  {
    "target": "規格外に巨大な魔力経路を持つ人間",
    "replace": "規格外に広大な魔力経路を持つ人間"
  },
  {
    "target": "重力の巨大な指向を『空間による刹那の処理』として逃し",
    "replace": "重力の圧倒的な指向を『空間による刹那の処理』として逃し"
  },
  {
    "target": "彼自身の異常に巨大な魔力経路が何者かに",
    "replace": "彼自身の異常に空間を圧迫するような魔力経路が何者かに"
  },
  {
    "target": "馬鹿正直に巨大な防壁を張ろうとしたなら",
    "replace": "馬鹿正直に空を覆い尽くすほどの防壁を張ろうとしたなら"
  },
  {
    "target": "巨大な構造の理不尽』に加担してしまっていた",
    "replace": "分厚い構造の理不尽』に加担してしまっていた"
  },
  {
    "target": "巨大な数式を睨みつけて",
    "replace": "狂気を孕んだ数式を睨みつけて"
  },
  {
    "target": "巨大な数式を一気呵成に書き殴っていく",
    "replace": "隙間を埋め尽くすほどの数式を一気呵成に書き殴っていく"
  },
  {
    "target": "巨大な距離をへし折る漆黒の陣",
    "replace": "途方もない距離をへし折る漆黒の陣"
  },
  {
    "target": "漆黒の巨大な空間転移陣を展開",
    "replace": "漆黒の路地を丸ごと飲み込むほどの空間転移陣を展開"
  },
  {
    "target": "巨大な善意の裏側に",
    "replace": "底知れない善意の裏側に"
  },
  // 冷たい
  {
    "target": "冷たい恐怖を植え付け始めていた",
    "replace": "這い寄るような恐怖を植え付け始めていた"
  },
  {
    "target": "計算通り』の冷たい時間が永遠に続く",
    "replace": "計算通り』の感情の抜け落ちた時間が永遠に続く"
  },
  {
    "target": "生存を最適化する冷たい計算だけだ",
    "replace": "生存を最適化する氷のような計算だけだ"
  },
  {
    "target": "幾星霜の冷たい生活の中で",
    "replace": "幾星霜の感情を殺した生活の中で"
  },
  {
    "target": "一切の同情を持たない冷たい声で",
    "replace": "一切の同情を持たない氷を這うような声で"
  },
  {
    "target": "氷のように冷たい灰色の瞳でアルトを見下ろした",
    "replace": "絶対零度の灰色の瞳でアルトを見下ろした"
  },
  {
    "target": "ひどく冷たい声で言い捨てた",
    "replace": "ひどく感情の一切こもっていない声で言い捨てた"
  },
  {
    "target": "感情の一切こもっていない、冷たい声で吐き捨てた",
    "replace": "感情の一切こもっていない声で吐き捨てた"
  },
  {
    "target": "冷たい目で目の前の数式",
    "replace": "生気を失った瞳で目の前の数式"
  },
  {
    "target": "冷たい瞳のミアが",
    "replace": "熱を微塵も宿さない瞳のミアが"
  },
  {
    "target": "冷たい拒絶に対するアルトの反応",
    "replace": "氷点下の拒絶に対するアルトの反応"
  },
  {
    "target": "冷たい炎を奥底に隠し持っていたなんて",
    "replace": "一切の熱を持たない炎を奥底に隠し持っていたなんて"
  },
  {
    "target": "冷たい宣告が降ってきたかと思うと",
    "replace": "無慈悲な宣告が降ってきたかと思うと"
  },
  {
    "target": "冷たい声だった。冗談の響きは一切ない。",
    "replace": "氷を削るような声だった。冗談の響きは一切ない。"
  }
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  let updatedCount = 0;

  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      updatedCount += processDirectory(fullPath);
    } else if (fullPath.endsWith('.mdx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;

      for (const rule of phase2bcReplacements) {
        if (content.includes(rule.target)) {
          content = content.replace(rule.target, rule.replace);
        }
      }

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        updatedCount++;
        console.log(`Updated: ${file}`);
      }
    }
  }
  return updatedCount;
}

console.log('Applying Phase 2b/3 Replacements...');
const total = processDirectory(targetDir);
console.log(`Phase 2b/3 done. Modified ${total} files.`);
