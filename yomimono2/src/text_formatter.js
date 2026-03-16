export function addSpaceAfterPunctuation(text) {
  // ！や？の後に、空白や終了括弧がない場合は全角スペースを挿入する
  // 連続する！？を分割させないため、否定先読みに！？を含める
  return text.replace(/([！？]+)(?![！？\s　」』）】\]"'])/g, '$1　');
}
