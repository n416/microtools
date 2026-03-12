import fs from 'fs';
import path from 'path';

const korePath = 'public/settings/kore.txt';
const mdxDir = 'public/settings';
const mdxFiles = fs.readdirSync(mdxDir).filter(f => f.startsWith('ep') && f.endsWith('.mdx'));

const koreText = fs.readFileSync(korePath, 'utf-8');
const koreLines = koreText.split('\n');

// 1. kore.txt から各チャプターの純粋なテキストブロックを抽出する
let koreChapters = [];
let currentChapter = [];
let inTerms = false;

for (let i = 0; i < koreLines.length; i++) {
    let line = koreLines[i].replace(/\r$/, '');
    
    if (line.includes('【用語解説】')) {
        inTerms = true;
        continue;
    }
    
    // 章の区切りで分割
    if (line.startsWith('【プロローグ】') || /^【第\d+章.*?】/.test(line) || line.startsWith('【終章：')) {
        inTerms = false;
        if (currentChapter.length > 0) {
            koreChapters.push([...currentChapter]);
        }
        currentChapter = []; // 章見出し自体はMDX管理のh1なので含めない
        continue;
    }
    
    if (inTerms) {
        if (line.startsWith('＊')) {
            inTerms = false; // 用語解説明けのセパレータとみなす
        }
        continue; // 用語解説中はスキップ
    }
    
    // セパレータと空白行はある程度保持するが、連続する空白は後で調整
    currentChapter.push(line);
}
if (currentChapter.length > 0) {
    koreChapters.push(currentChapter);
}

// 2. MDXに上書きしていく（※タグは考慮する必要があるが、現状は純粋なテキストのハルシネーションが酷いため、kore.txtベースにタグを簡易復元して丸ごと置換するアプローチをとる、あるいは差分適用する）

// --- 今回は、人間が手動で書いたタグ入りのkore.txtが存在するわけではない（kore.txtもプレーンテキスト）。
// --- 前回のAIタスクでMDXに「<Char role="client_pm"...>」等のタグを頑張って埋め込んだが、その際に文章自体を捏造してしまっている。
// --- なので、「MDXのタグ構造を維持しつつ、テキストだけをkore.txtに寄せる」のは非常に高度なマージ処理になってしまう。

// 修正アプローチ: 
// MDXファイルを読み込み、「<Char...>」などのコンポーネントタグをプレーンテキストの名前（天宮、黒須など）に一時的にもどした状態で kore.txt の該当箇所と diff をとり、ハルシネーションが起きていれば kore.txt 側のテキストで上書きする。
// その後、また正規表現で「天宮」→ 「<Char role="client_pm"...>」 のようにタグ化して戻す。

// キャラクター辞書 (前回作成した情報をベースに)
const charMap = {
    '天宮': '<Char role="client_pm" callrole="ceo" var="normal" />',
    '黒須さん': '<Char role="client_pmo" callrole="ceo" var="normal_san" />',
    '黒須': '<Char role="client_pmo" callrole="ceo" var="normal" />',
    '土屋': '<Char role="ceo" callrole="system" var="normal" />',
    '土屋さん': '<Char role="ceo" callrole="system" var="normal_san" />',
    '小林さん': '<Char role="main_prog" callrole="ceo" var="normal_san" />',
    '小林': '<Char role="main_prog" callrole="ceo" var="normal" />',
    'テツ': '<Char role="vendor_se" callrole="ceo" var="normal" />'
};

const termMap = {
    'プロトコル': '<Term id="packet">プロトコル</Term>',
    'ガジェット': '<Term id="device_gadget">ガジェット</Term>',
    'レイテンシ': '<Term id="latency">レイテンシ</Term>',
    'アルゴリズム': '<Term id="algorithm">アルゴリズム</Term>',
    '物理削除': '<Term id="logical_delete">物理削除</Term>',
    'リソース': '<Term id="resource">リソース</Term>',
    'キャッシュ': '<Term id="cache_clear">キャッシュ</Term>',
    'PMO': '<Term id="pmo">PMO</Term>',
    'UI': '<Term id="ui">UI</Term>',
    'アラート': '<Term id="alert">アラート</Term>'
};

// 危険な改変箇所をピンポイントで検索して置換するだけの簡易版にする（全上書きはタグ消失リスクが高すぎるため）
const fixList = [
    { target: '「……土屋さん」\n\n天宮は、呆れたような', replace: '「……土屋さん」\n\n天宮は、呆れたような'}, // TODO: さっきのログの修正点
    { target: '最後の納品物の検収印を黒須から受け取った天宮は', replace: '最後の納品物の検収印を黒須さんから受け取った天宮は' },
    { target: '俺の叫びに、黒須は邪悪に嗤う……ことはなかった。', replace: '俺の叫びに、黒須さんは邪悪に嗤う……ことはなかった。' },
    { target: '黒須は旧式の端末を片手に抱え直し、冷たく言い放った。', replace: '黒須さんは旧式の端末を片手に抱え直し、冷たく言い放った。' },
    { target: '黒須は懐から異様な形状のデバイスを引き抜き', replace: '黒須さんは懐から異様な形状のデバイスを引き抜き' },
    { target: '黒須が小さく舌打ちをし', replace: '黒須さんが小さく舌打ちをし' },
    { target: '黒須は、沈黙したまま俺たちを', replace: '黒須さんは、沈黙したまま俺たちを' },
    { target: '黒須の絶対零度の視線', replace: '黒須さんの絶対零度の視線' }
];

mdxFiles.forEach(file => {
    const filePath = path.join(mdxDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    // missing blocks fix for ep0400 around L177
    if (file === 'ep0400.mdx' && content.includes('一人残された夜道。\n俺は自分の手首にはめられたスマートウォッチを静かに見つめた。\n『自分がノイズとして消えれば、大切な人間は正常に生きていける』')) {
        content = content.replace(
            '一人残された夜道。\n俺は自分の手首にはめられたスマートウォッチを静かに見つめた。\n『自分がノイズとして消えれば、大切な人間は正常に生きていける』\nテツが残したその言葉が、冷たい夜風とともに耳の奥で反響していた。\n休日の間は、これを切っても安全。',
            '一人残された夜道。\n俺は自分の手首にはめられたスマートウォッチを静かに見つめた。\n『自分がノイズとして消えれば、大切な人間は正常に生きていける』\nテツが残したその言葉が、冷たい夜風とともに耳の奥で反響していた。\n\n一人残された夜道。\n俺は自分の手首にはめられたスマートウォッチを静かに見つめた。\n休日の間は、これを切っても安全。'
        );
        changed = true;
    }

    // 欠落した美術館の会話ブロック (ep0400.mdx 末尾〜ep0500.mdx冒頭のつなぎの可能性。kore.txt L800付近)
    // 実際にどこにあるかファイル構成に依存するため、文字列全検索で置換する。

});

// ... 大量にあるため、やはり kore.txt をベースに自動再生成するのが一番クリーン。
// だが、タグの復元処理を完璧に書く必要がある。

