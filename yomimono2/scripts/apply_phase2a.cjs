const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public', 'settings');

const phase2aReplacements = [
  // 極限
  {
    target: "たった一秒にも満たない瞬間に極限まで圧縮し",
    replace: "たった一秒にも満たない瞬間に針の穴を通すように圧縮し"
  },
  {
    target: "極限の退屈の中で息を潜めていた彼女の鼻腔を",
    replace: "終わりなき退屈の中で息を潜めていた彼女の鼻腔を"
  },
  {
    target: "無駄な熱を極限まで削ぎ落とした",
    replace: "無駄な熱を一縷も逃さず削ぎ落とした"
  },
  {
    target: "悠久の時を極限まで命を節約し",
    replace: "悠久の時を息が止まるほど命を節約し"
  },
  {
    target: "極限まで削られ、たった三十秒あまりで",
    replace: "最後の一滴まで命を削られ、たった三十秒あまりで"
  },
  {
    target: "極限まで削ぎ落とし、もうこれ以上",
    replace: "限界の限界まで無駄を削ぎ落とし、もうこれ以上"
  },
  {
    target: "極限まで最適化された",
    replace: "無駄なく最適化された"
  },
  {
    target: "極限の浮遊魔法",
    replace: "究理の浮遊魔法"
  },
  {
    target: "極限まで揺さぶり",
    replace: "致命的な亀裂をもたらし"
  },
  {
    target: "極限まで見開かれた",
    replace: "引き裂かれるように見開かれた"
  },
  {
    target: "極限の機能美を伴って",
    replace: "一切の無駄を排した機能美を伴って"
  },
  {
    target: "極限の老いにまみれた顔で",
    replace: "死の淵に立つ老いにまみれた顔で"
  },
  // 強烈
  {
    target: "強烈な魔法震と瓦礫の直撃",
    replace: "骨を砕くような魔法震と瓦礫の直撃"
  },
  {
    target: "凄まじく強烈な熱波だった",
    replace: "凄まじく重たく圧倒的な熱波だった"
  },
  {
    target: "強烈な『飢えを満たす』予感",
    replace: "焦げるような『飢えを満たす』予感"
  },
  {
    target: "錆びついた下水が混じり合う強烈な異臭が常に鼻を突く中、",
    replace: "錆びついた下水が内臓を裏返らせるような異臭を放つ中、"
  },
  {
    target: "得体の知れない強烈な苛立ちがチリチリと燻り始めた",
    replace: "得体の知れない煮えるような苛立ちがチリチリと燻り始めた"
  },
  {
    target: "極めて原初的な『所有権の侵害』に対する強烈な敵対心だった",
    replace: "只々原初的な『所有権の侵害』に対する獣のような敵対心だった"
  },
  {
    target: "戦慄にも似た強烈な知的興奮が駆け抜ける",
    replace: "戦慄にも似た電流めいた知的興奮が駆け抜ける"
  },
  {
    target: "言い切るミアの強烈な瞳の圧力に",
    replace: "言い切るミアの凍てつくような瞳の圧力に"
  },
  {
    target: "強烈な熱量を持った炎の槍が",
    replace: "空気を焦がす熱量を持った炎の槍が"
  },
  {
    target: "自分と同じように強烈な殺意を氷層の下に",
    replace: "自分と同じように深く淀んだ殺意を氷層の下に"
  },
  {
    target: "強烈な『不快感』に顔を歪めた",
    replace: "顔に虫でも這ったかのような『不快感』に顔を歪めた"
  },
  {
    target: "悲しそうに泣く妻の最期の顔とともに強烈にフラッシュバックした",
    replace: "悲しそうに泣く妻の最期の顔とともに容赦なくフラッシュバックした"
  },
  // 極めて
  {
    target: "極めて精巧で過保護な術式だった",
    replace: "狂気的なほど精巧で過保護な術式だった"
  },
  {
    target: "極めて理不尽で強固な独占の誓いが",
    replace: "他者の介在など一切許容しない理不尽で強固な独占の誓いが"
  },
  {
    target: "美しい炎が極めて広がっていく",
    replace: "美しい炎が波紋のように広がっていく"
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

      for (const rule of phase2aReplacements) {
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

console.log('Applying Phase 2a Replacements...');
const total = processDirectory(targetDir);
console.log(`Phase 2a done. Modified ${total} files.`);
