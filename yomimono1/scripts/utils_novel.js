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

  // 【用語解説】前後の不要な空行を完全に削除（上に1つ、下に1つの改行のみにする）
  plain = plain.replace(/\s+【用語解説】\s+/g, '\n【用語解説】\n');
  
  // 用語解説の最後の要素（※〜）と次の章（第X話）との間の空行を完全に削除する
  plain = plain.replace(/(※[^\n]*?)\s+(?=第\d+話)/g, '$1\n');

  return plain.trim();
}
