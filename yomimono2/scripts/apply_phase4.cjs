const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public', 'settings');

const phase4Replacements = [
  // 膨大
  {
    target: "ただ膨大な寿命だけを献上して",
    replace: "ただ途方もない寿命だけを献上して"
  },
  {
    target: "膨大な魔力が堰を切ったように",
    replace: "底知れぬ魔力が堰を切ったように"
  },
  {
    target: "三世紀に及ぶ膨大な寿命",
    replace: "三世紀に及ぶ底なしの寿命"
  },
  {
    target: "膨大すぎる寿命を",
    replace: "桁違いの寿命を"
  },
  {
    target: "膨大な時間と労力を注ぎ込んだ",
    replace: "気の遠くなるような時間と労力を注ぎ込んだ"
  },
  {
    target: "路地に膨大な閃光が走り",
    replace: "路地に目を焼くほどの閃光が走り"
  },
  {
    target: "膨大な演算が完了し",
    replace: "脳を焼き切るほどの演算が完了し"
  },
  {
    target: "膨大な「余剰生命力」が",
    replace: "計り知れない「余剰生命力」が"
  },
  {
    target: "膨大な生命の余波",
    replace: "途方もない生命の余波"
  },
  {
    target: "自身の膨大な寿命を一気に魔力へ",
    replace: "自身の途方もない寿命を一気に魔力へ"
  },
  {
    target: "膨大な重みを彼は誰よりも知っている",
    replace: "途方もない重みを彼は誰よりも知っている"
  },
  {
    target: "息子の膨大な命を犠牲にして",
    replace: "息子の尽きせぬ命を犠牲にして"
  },
  {
    target: "てめぇの膨大な生命力",
    replace: "てめぇの底知れぬ生命力"
  },
  {
    target: "膨大な『命の備蓄』が",
    replace: "底なしの『命の備蓄』が"
  },
  {
    target: "膨大な時間をかけて",
    replace: "気の遠くなるような時間をかけて"
  },
  {
    target: "膨大な魔女としての備蓄",
    replace: "底なしの魔女としての備蓄"
  },
  {
    target: "膨大な命の蓄え",
    replace: "底なしの命の蓄え"
  },
  {
    target: "膨大な白金の命価",
    replace: "眩いほどの白金の命価"
  },
  {
    target: "膨大な搾取分",
    replace: "途方もない搾取分"
  },
  {
    target: "膨大な代償",
    replace: "途方もない代償"
  },
  {
    target: "膨大な光が",
    replace: "目を焼くほどの光が"
  },

  // 異常
  {
    target: "異常すぎる数字に",
    replace: "正気の歯車を外れた数字に"
  },
  {
    target: "異常に強靭な魔力経路",
    replace: "理外に強靭な魔力経路"
  },
  {
    target: "異常に太い魔力パイプ",
    replace: "常軌を逸した太い魔力パイプ"
  },
  {
    target: "異常に太い",
    replace: "常軌を逸して太い" // fallback just in case
  },
  {
    target: "この、異常者め",
    replace: "この、破綻者め"
  },
  {
    target: "この異常者め",
    replace: "この破綻者め"
  },
  {
    target: "自己犠牲の異常者",
    replace: "自己犠牲の破綻者"
  },
  {
    target: "異常に空間を圧迫するような魔力経路",
    replace: "空間の理を歪めて圧迫するような魔力経路"
  },
  {
    target: "異常に【極太の緑色の奔流】が",
    replace: "理外に【極太の緑色の奔流】が"
  },

  // 最も
  {
    target: "最も残酷で静かな真実だった",
    replace: "どこまでも残酷で静かな真実だった"
  },
  {
    target: "「最も確かな重み」",
    replace: "「何より確かな重み」"
  },
  {
    target: "最も奥深くから",
    replace: "一番奥深くから"
  },
  {
    target: "最も無駄のない最適解",
    replace: "一切の無駄がない最適解"
  },
  {
    target: "最も論理的に正しい",
    replace: "純粋に論理として正しい"
  },
  {
    target: "最も合理的であり",
    replace: "ただただ合理的であり"
  },
  {
    target: "最も古く不可侵な",
    replace: "一番古く不可侵な"
  },
  {
    target: "最も静かで",
    replace: "音を失うほど静かで"
  },
  {
    target: "最も悪辣な手段",
    replace: "底抜けに悪辣な手段"
  },
  {
    target: "最も痛感ともいえる部分",
    replace: "一番の痛感ともいえる部分"
  },

  // 冷酷
  {
    target: "冷酷で、悪辣で",
    replace: "血も涙もなく、悪辣で"
  },
  {
    target: "冷酷に弾き出す",
    replace: "容赦なく機械的に弾き出す"
  },
  {
    target: "冷酷な防壁を",
    replace: "一切の熱を遮断する防壁を"
  },
  {
    target: "冷酷な命の切り捨て",
    replace: "血の気が引くほどの命の切り捨て"
  },
  {
    target: "冷酷なまでに正確な",
    replace: "一切の狂いなく正確な"
  },
  {
    target: "冷酷な狂気に",
    replace: "氷のような狂気に"
  },
  {
    target: "冷酷に他人の命を収奪する",
    replace: "機械のように他人の命を収奪する"
  },
  {
    target: "冷酷無比な",
    replace: "一切の容赦がない"
  },
  {
    target: "冷酷に呟き",
    replace: "凍るように呟き"
  },
  {
    target: "冷酷な現実の計算結果",
    replace: "無慈悲な現実の計算結果"
  },
  {
    target: "冷酷な命令語",
    replace: "凍えるような命令語"
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

      for (const rule of phase4Replacements) {
        if (content.includes(rule.target)) {
          content = content.replaceAll(rule.target, rule.replace);
        }
      }

      // Generic catch-all replaces for leftovers
      content = content.replaceAll('膨大な魔力', '底知れぬ魔力');
      content = content.replaceAll('膨大な生命力', '底知れぬ生命力');
      content = content.replaceAll('膨大な魔力', '底知れぬ魔力');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        updatedCount++;
        console.log(`Updated: ${file}`);
      }
    }
  }
  return updatedCount;
}

console.log('Applying Phase 4 Replacements...');
const total = processDirectory(targetDir);
console.log(`Phase 4 done. Modified ${total} files.`);
