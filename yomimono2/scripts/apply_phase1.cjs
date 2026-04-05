const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public', 'settings');

const phase1Replacements = [
  // 奇跡
  {
    target: "それは痛々しいほどに美しい奇跡だった。",
    replace: "それは常識の理を鮮やかに捻じ曲げ、燃え盛る命の代償を見せつけるかのように痛々しく輝いていた。"
  },
  {
    target: "それは数百年越しの奇跡の発見であると同時に、これ以上の寿命搾取を防げるという唯一の希望でもあった。",
    replace: "それは数百年もの間、何者も届かなかった理（ことわり）の裏側を暴いた瞬間であると同時に、これ以上の寿命搾取を防げるという唯一の希望でもあった。"
  },
  {
    target: "あとに残されたのは奇跡の代償によって生じた二つの『ただの人間』の姿だけだった。",
    replace: "あとに残されたのは、強引に理を書き換えた莫大な熱を吸い込み、二つの『ただの人間』へと還った姿だけだった。"
  },
  {
    target: "床の石畳にへたり込んでいたのは、三世紀分の備蓄と魔女としての全能を燃やし尽くし、奇跡的に『本来の十六歳の人間としての寿命』だけが手付かずで残された、ひとりの無力な銀髪の少女（ミア）だった。",
    replace: "床の石畳にへたり込んでいたのは、三世紀分の備蓄と魔女としての全能を燃やし尽くし、燃え尽きる寸前ですり抜けるように『本来の十六歳の人間としての寿命』だけが手付かずで残された、ひとりの無力な銀髪の少女（ミア）だった。"
  },
  {
    target: "六年前からの過払いが全て還元された瑞々しい肉体を取り戻した青年が、奇跡の代償を全て噛みしめるように彼自身の両手を見つめて座り込んでいた。",
    replace: "六年前からの過払いが全て還元された瑞々しい肉体を取り戻した青年が、世界を書き換えた重みを全て噛みしめるように彼自身の両手を見つめて座り込んでいた。"
  },
  {
    target: "ミアは口元に微かな笑みを浮かべ、その極めて等身大な奇跡の結末を見守っていた。",
    replace: "ミアは口元に微かな笑みを浮かべ、その等身大で理不尽な結末を見守っていた。"
  },
  {
    target: "十八歳の逞しい青年へと育ったアルトが、奇跡を確かめるように胸に手を当てミアへ微笑んだ。",
    replace: "十八歳の逞しい青年へと育ったアルトが、失われなかった命の鼓動を確かめるように胸に手を当てミアへ微笑んだ。"
  },
  {
    target: "悠久の時を孤独な防壁に包まれてきた。だからだろうか。その『愛おしい喧騒』は、きっとどんな強固な魔法陣よりも遥かに計算不可能な奇跡のように見えた。",
    replace: "悠久の時を孤独な防壁に包まれてきた。だからだろうか。その『愛おしい喧騒』は、きっとどんな強固な魔法陣よりも遥かに美しく、計算で測りきれない尊いものに見えた。"
  },
  // 恐ろしい
  {
    target: "さらに恐ろしいのは、その『最低の効率』をもたらしている魔力経路そのもの異常性。",
    replace: "さらにミアの背筋を凍らせたのは、その『最低の効率』をもたらしている魔力経路そのものの異常性だ。"
  },
  {
    target: "それこそが命価消費の最も恐ろしい点だった。熱も苦痛もなく、ただ内側の「最も確かな重み」だけが、音もなくゴッソリと抉り取られていく取り返しのつかない喪失感。",
    replace: "それこそが命価消費の最も残酷で静かな真実だった。熱も苦痛もなく、ただ内側の「最も確かな重み」だけが、音もなくゴッソリと抉り取られていく取り返しのつかない喪失感。"
  },
  {
    target: "その光の波長が示した代償の『寿命消費量』。それが導き出した異常すぎる数字に、ミアの背筋が冷たく凍る。恐ろしいほどの戦慄と身の毛がよだつような激しい歓喜が同時に突き抜けた。",
    replace: "その光の波長が示した代償の『寿命消費量』。それが導き出した異常すぎる数字に、ミアの背筋が冷たく凍る。頭痛がするほどの戦慄と、身の毛がよだつような激しい歓喜が同時に突き抜けた。"
  },
  {
    target: "それは魔力よりも遥かに原初的で恐ろしい、物理的に調合された強酸性の『猛毒』。",
    replace: "それは魔力よりも遥かに原初的で質が悪い、物理的に調合された強酸性の『猛毒』。"
  },
  {
    target: "自身の命を一秒たりとも使わなかったこれまでの生き方が、たかだかこの男の寿命の摩耗を防ぐためだけに汚されてしまった恐ろしい事実。",
    replace: "自身の命を一秒たりとも使わなかったこれまでの生き方が、たかだかこの男の寿命の摩耗を防ぐためだけに汚されてしまったという、目眩（めまい）すら覚える事実。"
  },
  {
    target: "誰もいなくなった市場の片隅で、ミアはアルトの胸ぐらを両手で乱暴に掴み上げた。声は冷たいままだったが、その目には恐ろしい殺気が宿っている。",
    replace: "誰もいなくなった市場の片隅で、ミアはアルトの胸ぐらを両手で乱暴に掴み上げた。声のトーンこそ変えなかったが、その細められた瞳の奥には相手の首を一瞬で刎ね落とすほどの濃密な殺気が宿っている。"
  },
  {
    target: "極めて理不尽で強固な独占の誓いが、凍てつく魔女の胸の奥で恐ろしいほどの静けさと共に固まっていた。",
    replace: "極めて理不尽で強固な独占の誓いが、凍てつく魔女の胸の奥で、異様なほどの静けさと共に固まっていた。"
  },
  {
    target: "その恐ろしいまでの純度が、論理と効率だけで自身を無菌室に隔離してきた氷の魔女の網膜に取り返しのつかない『異物（ピント）』として刻み込まれてしまった。",
    replace: "その狂気じみたまでの純度が、論理と効率だけで自身を無菌室に隔離してきた氷の魔女の網膜に取り返しのつかない『異物（ピント）』として刻み込まれてしまった。"
  },
  {
    target: "三十年間かけて構築した強固な悪徳の鎧と、彼自身を縛っていた恐ろしい強迫観念が、一言の弁明の余地もなく――ただ温かくほどけて、砕け散った。",
    replace: "三十年間かけて構築した強固な悪徳の鎧と、彼自身を縛っていた逃げ場のない強迫観念が、一言の弁明の余地もなく――ただ温かくほどけて、砕け散った。"
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

      for (const rule of phase1Replacements) {
        if (content.includes(rule.target)) {
          content = content.replace(rule.target, rule.replace);
        } else {
          // If the exact phrase isn't found, try splitting target by lines if it spans multiple
          // In this specific task, all targets are single markdown lines without inner newlines
          // so standard includes/replace should work.
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

console.log('Applying Phase 1 Replacements...');
const total = processDirectory(targetDir);
console.log(`Phase 1 done. Modified ${total} files.`);
