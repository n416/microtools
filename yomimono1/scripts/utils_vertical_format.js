export function formatForVerticalText(text) {
  if (!text) return text;

  // 0. 全角数字・英字の半角化（以降のフォーマット処理を安定・統一するため）
  text = text.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
  });

  // ダッシュの統一（U+2015 などを U+2014 に統一）
  text = text.replace(/――/g, '——');
  // 行頭ダッシュの字下げ（全角スペース等）を削除して統一
  text = text.replace(/^[ 　]+——/gm, '——');

  // 1. 小数点・カンマ表記の調整
  // 小数点 (1.5 -> 1・5)
  text = text.replace(/(\d+)\.(\d+)/g, '$1・$2');
  // 桁区切りカンマ (1,000 -> 1000)
  text = text.replace(/(\d+),(\d{3})/g, '$1$2');

  // 2. 記号の全角化（小説で縦に立たせるべき感嘆符・疑問符など）
  // 縦中横の対象となる !! や !? は半角に統一して維持する
  text = text.replace(/！！/g, '!!');
  text = text.replace(/！？/g, '!?');
  text = text.replace(/？！/g, '?!');

  // 単独の!と?は全角化するが、一時的に対象外マーカーへ退避
  text = text.replace(/!!/g, '@@DOUBLE_EXCL@@');
  text = text.replace(/!\?/g, '@@EXCL_QUEST@@');
  text = text.replace(/\?!/g, '@@QUEST_EXCL@@');
  
  text = text.replace(/!/g, '！');
  text = text.replace(/\?/g, '？');

  text = text.replace(/@@DOUBLE_EXCL@@/g, '!!');
  text = text.replace(/@@EXCL_QUEST@@/g, '!?');
  text = text.replace(/@@QUEST_EXCL@@/g, '?!');

  // 3. 英語の表記揺れ対応（文字数や大文字小文字による寝かせ・立たせ判定）
  // 大文字1〜3文字（前後に英字が続かないもの）は全角化して立たせる（例: IT, BPM）
  text = text.replace(/(?<![A-Za-z])[A-Z]{1,3}(?![A-Za-z])/g, (match) => {
    return Array.from(match).map(ch => String.fromCharCode(ch.charCodeAt(0) + 0xFEE0)).join('');
  });
  // ※これに該当しない英単語（例: Apple, HTML(4文字)）は半角を維持し、横倒しで表示させる

  // 4. アラビア数字の漢数字ハイブリッド変換
  // 3桁以上の数字は単純置き換え
  text = text.replace(/\d{3,}/g, (match) => {
    return match.replace(/0/g, '〇').replace(/1/g, '一').replace(/2/g, '二').replace(/3/g, '三')
                .replace(/4/g, '四').replace(/5/g, '五').replace(/6/g, '六').replace(/7/g, '七')
                .replace(/8/g, '八').replace(/9/g, '九');
  });

  // 1〜2桁の数字の処理
  text = text.replace(/(?<!\d)\d{1,2}(?!\d)/g, (match) => {
    // 2桁の数字はDOCX側で縦中横のターゲットとなるため、漢数字にせず半角のままにする
    if (match.length === 2) {
      return match;
    }

    // 1桁の数字は漢数字にする
    const num = parseInt(match, 10);
    if (num === 0) return '〇';
    return ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'][num];
  });

  // 5. 場面転換タグ（単独の「＊」）の自動字下げ
  // 行に「＊」しか存在しない場合、自動的に全角スペース4個の字下げを行う（縦書きレイアウトの中央揃えの代替）
  text = text.replace(/^[ 　]*＊[ 　]*$/gm, '　　　　＊');

  return text;
}
