export function cleanMarkdown(content) {
  // <div class="next-action">...</div> および <button> の除去
  let cleaned = content.replace(/<div class="next-action"[\s\S]*?<\/div>/g, '');
  
  // <div class="term-footnotes">...</div> の除去
  cleaned = cleaned.replace(/<div class="term-footnotes">/g, '');
  cleaned = cleaned.replace(/<\/div>/g, '');

  // <img> タグをプレーンテキストのキャプション記法 [画像: alt] へ変換
  cleaned = cleaned.replace(/<img[^>]*alt="([^"]+)"[^>]*>/g, '[画像: $1]');
  // altが無い<img>へのフォールバック
  cleaned = cleaned.replace(/<img[^>]*>/g, '[画像]');

  // <p>等のインラインで残っているHTMLタグを除去 (主にReact用のstyle要素など)
  cleaned = cleaned.replace(/<p\s+style=[^>]+>/g, '');
  cleaned = cleaned.replace(/<\/p>/g, '\n\n');
  
  // その他の残存HTMLタグ（span等）を削除
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  return cleaned.trim();
}

export function stripMarkdown(text) {
  let plain = text.replace(/\r\n/g, '\n'); // 正規表現の処理のために改行コードを統一

  // ヘッダー (#) を除去 (行頭の#とスペースを消す)
  plain = plain.replace(/^#+\s+/gm, '');
  // 太字 (**) やイタリック (*) を除去
  plain = plain.replace(/(\*\*|__)(.*?)\1/g, '$2');
  plain = plain.replace(/(\*|_)(.*?)\1/g, '$2');
  // 取り消し線 (~~) を除去
  plain = plain.replace(/(~~)(.*?)\1/g, '$2');
  // リンク [text](url) を text に変換
  plain = plain.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  // 画像エスケープの復元
  plain = plain.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '[画像: $1]');
  // 引用符 (>) を除去
  plain = plain.replace(/^>\s+/gm, '');
  // リスト記号 (-, *, +, 1.) を除去
  plain = plain.replace(/^[\-\*\+]\s+/gm, '');
  plain = plain.replace(/^\d+\.\s+/gm, '');
  // 水平線 (---, ***) を除去
  plain = plain.replace(/^[-*_]{3,}\s*$/gm, '');

  // 3つ以上連続する改行があれば2つにまとめる
  plain = plain.replace(/\n{3,}/g, '\n\n');

  // 【用語解説】セクション全体を削除する
  // 「【用語解説】」以降、次のエピソード「第X話」または「プロローグ」が始まるまでのテキストを消す
  // 次のエピソードがない（ファイルの末尾）場合も考慮する
  plain = plain.replace(/【用語解説】[\s\S]*?(?=(第\d+話|プロローグ|$))/g, '');

  // 用語解説の脚注番号 （※1） などを除去（【用語解説】ブロックが消えたことによる浮遊マークの削除）
  plain = plain.replace(/（※\d+）/g, '');

  return plain.trim();
}
