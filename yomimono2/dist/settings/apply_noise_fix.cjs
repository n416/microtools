const fs = require('fs');
const path = require('path');

const dir = __dirname;

const replacements = [
  // --- 1. AIキャラ崩壊・過剰表現ノイズ（削除推奨） ---
  {
    file: 'ep0060.mdx',
    target: '極限の餓えと退屈で死にかけていた無敵の獣の鼻腔を、ふと掠めた極上の命が焼け焦げるような匂い。',
    replace: '極限の退屈の中で息を潜めていた彼女の鼻腔を、ふと掠めた純粋な命が焼け焦げるような匂い。'
  },
  {
    file: 'ep0130.mdx',
    target: 'この極上の矛盾の塊から。',
    replace: 'このありえない矛盾の塊から。'
  },
  {
    file: 'ep0140.mdx',
    target: '「……それほどの極上の才能を持ちながら、',
    replace: '「……それほどの才能を持ちながら、'
  },
  {
    file: 'ep0270.mdx',
    target: '極上の生命力（マナ）',
    replace: '莫大な生命力（マナ）'
  },
  {
    file: 'ep0290.mdx',
    target: '極上の家畜',
    replace: '都合のいい家畜'
  },
  {
    file: 'ep0330.mdx',
    target: '【最高峰にして極上の観測対象】',
    replace: '【私の貴重な観測対象】'
  },
  {
    file: 'ep0350.mdx',
    target: '極上の熱を帯びて',
    replace: '微かな熱を帯びて'
  },
  {
    file: 'ep0410.mdx',
    target: '極上のハンバーグ',
    replace: '特大のハンバーグ'
  },
  {
    file: 'plot.mdx',
    target: '極上の矛盾',
    replace: '矛盾'
  },

  // --- 2. 三人称一元視点として「元の表現（自分など）」の方が美しかったかもしれない箇所の差し戻し ---
  { file: 'ep0050.mdx', target: '彼自身が魔法に向いていない幸運をただありがたく噛み締めていた。', replace: '自分が魔法に向いていない幸運をただありがたく噛み締めていた。' },
  { file: 'ep0060.mdx', target: '彼女自身が百年かけて構築した精緻で美しい計算式など、あの熱波で一瞬にしてドロドロに溶かされてしまう。', replace: '自分が百年かけて構築した精緻で美しい計算式など、あの熱波で一瞬にしてドロドロに溶かされてしまう。' },
  { file: 'ep0060.mdx', target: '彼女自身が百日の寿命を取り戻すために', replace: '自分が百日の寿命を取り戻すために' },
  { file: 'ep0100.mdx', target: '彼自身が少し早く灰になる程度で', replace: '自分が少し早く灰になる程度で' },
  { file: 'ep0140.mdx', target: '結局彼自身が放った『自爆の対価』によって砕け散ってしまったのだと', replace: '結局自分が放った『自爆の対価』によって砕け散ってしまったのだと' },
  { file: 'ep0160.mdx', target: '彼女自身が数百年ぶりに「飢え」を感じた', replace: '自分自身が数百年ぶりに「飢え」を感じた' },
  { file: 'ep0160.mdx', target: 'これ以上誰のためにも彼自身の命を削らず', replace: 'これ以上誰のためにも自分の命を削らず' }, // アルト行動
  { file: 'ep0160.mdx', target: 'ミア自身が何百年も実践してきたただ一つの正理だ。', replace: '自分が何百年も実践してきたただ一つの正理だ。' },
  { file: 'ep0180.mdx', target: '彼自身がどれほど老い先短い身であるかを完全に忘れ去ったかのような輝く目で', replace: '自分がどれほど老い先短い身であるかを完全に忘れ去ったかのような輝く目で' },
  { file: 'ep0190.mdx', target: '彼自身が特進生であった頃の未来を全て売り払い', replace: '自分が特進生であった頃の未来を全て売り払い' },
  { file: 'ep0200.mdx', target: '彼自身が一生搾取される奴隷になろうが大勢が助かるならお得だと', replace: '自分が一生搾取される奴隷になろうが大勢が助かるならお得だと' },
  { file: 'ep0210.mdx', target: '彼自身が搾取され命を削られていると分かっていて、一切の怒りも持たずに他者のためにすり減っていく。', replace: '自分が搾取され命を削られていると分かっていて、一切の怒りも持たずに他者のためにすり減っていく。' },
  { file: 'ep0210.mdx', target: 'だがこの男は、彼自身が理不尽に搾取されている事実よりも', replace: 'だがこの男は、自分が理不尽に搾取されている事実よりも' },
  { file: 'ep0220.mdx', target: 'もしここで彼自身が「アルトだ」と名乗ったら何が起こるか。', replace: 'もしここで自分が「アルトだ」と名乗ったら何が起こるか。' },
  { file: 'ep0220.mdx', target: 'それは誰より彼自身が一番よくわかっていた。', replace: 'それは誰より自分自身が一番よくわかっていた。' },
  { file: 'ep0240.mdx', target: '彼女自身が長きにわたり保ち続けてきた『完全な孤立と効率主義』', replace: '自分が長きにわたり保ち続けてきた『完全な孤立と効率主義』' },
  { file: 'ep0240.mdx', target: 'あるいは彼女自身がそれに染まってしまった恐怖に震えるように', replace: 'あるいは自分がそれに染まってしまった恐怖に震えるように' },
  { file: 'ep0250.mdx', target: 'かつて「自身の命を使わずに生きる」という絶対ルールを掲げていたはずの彼女自身が', replace: 'かつて「自分の命を使わずに生きる」という絶対ルールを掲げていたはずの自分が' },
  { file: 'ep0290.mdx', target: '彼女自身が永きにわたり保ち続けてきた『完全な孤立と絶対性』', replace: '自分が永きにわたり保ち続けてきた『完全な孤立と絶対性』' },
  { file: 'ep0350.mdx', target: 'ただの傍観者として冷え切った時間を生きてきた、彼女自身が。', replace: 'ただの傍観者として冷え切った時間を生きてきた、自分自身が。' },
  { file: 'ep0370.mdx', target: 'すっかり角の取れた三十年前の優しく穏やかな彼自身が', replace: 'すっかり角の取れた三十年前の優しく穏やかなアルト自身が' }, // これは「彼自身」より「アルト自身」が良い
  { file: 'ep0390.mdx', target: '彼女自身がこれまでの命価を全額支払って因果ごと再設定しようとしていることを', replace: '自分がこれまでの命価を全額支払って因果ごと再設定しようとしていることを' },
  { file: 'ep0400.mdx', target: '過去に向かって生き汚く計算を稼働し続けていた彼女自身が', replace: '過去に向かって生き汚く計算を稼働し続けていた自分が' }
];

let changedCount = 0;

for (const req of replacements) {
  const filePath = path.join(dir, req.file);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(req.target)) {
    content = content.replace(req.target, req.replace);
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${req.file}: replaced target.`);
    changedCount++;
  } else {
    // ターゲットが見つからなかった場合、おそらく前後の文字等でブレがある
    console.error(`Target not found in ${req.file}: ${req.target}`);
  }
}

console.log(`\nCompleted. Updated ${changedCount} items.`);
