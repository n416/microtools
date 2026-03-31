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

export function stripMarkdown(text, options = {}) {
  const { preserveGlossary = false } = options;
  let plain = text.replace(/\r\n/g, '\n'); // 正規表現の処理のために改行コードを統一

  // ヘッダー処理:
  // 見出しは後で確実な1行アキにするためマーカー化
  plain = plain.replace(/^\s*#\s+(.*)$/gm, '%%%HEADER%%%$1%%%HEADER%%%');
  // 副見出し (## 1. 〇〇、## 幕間など) は、## を消して前後に空行
  plain = plain.replace(/^\s*##\s+(.*)$/gm, '\n\n$1\n\n');
  // それ以下の見出し (###など) は単純に記号を消す
  plain = plain.replace(/^\s*#{3,}\s+/gm, '');
  // 太字 (**) やイタリック (*) を除去
  plain = plain.replace(/(\*\*|__)([^\n]*?)\1/g, '$2');
  plain = plain.replace(/(\*|_)([^\n]*?)\1/g, '$2');
  // 取り消し線 (~~) を除去
  plain = plain.replace(/(~~)([^\n]*?)\1/g, '$2');
  // リンク [text](url) を text に変換
  plain = plain.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  // 画像エスケープの復元
  plain = plain.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '[画像: $1]');
  // 引用符 (>) を除去
  plain = plain.replace(/^>\s+/gm, '');
  // リスト記号 (-, *, +) を除去 (ただし、見出し行で既に見出し記号が除去された後の数値などには影響させない方針)
  plain = plain.replace(/^[\-\*\+]\s+/gm, '');
  // ここで `^\d+\.\s+` を消すと、「1. 〇〇」のような副見出しの箇条書きまで消えてしまうので削除処理を無効化、ないしは限定的にする。
  // plain = plain.replace(/^\d+\.\s+/gm, '');
  // エピソード境界用の長いダッシュ(40個)は削除し、マークダウンの水平線(3個以上)は kore.txt に合わせて '＊' へ変換
  plain = plain.replace(/^-{40,}\s*$/gm, '');
  plain = plain.replace(/\n*^[-*_]{3,}\s*$\n*/gm, '\n\n＊\n\n');

  // 4つ以上連続する改行があれば3つにまとめる（見出し前後の空白行装飾を保護するため）
  plain = plain.replace(/\n{4,}/g, '\n\n\n');

  // マーカー化しておいた見出しを「確実に前後1行アキ（\\n\\n）」へ置換
  plain = plain.replace(/\n*%%%HEADER%%%(.*?)%%%HEADER%%%\n*/g, '\n\n$1\n\n');

  if (!preserveGlossary) {
    // 【用語解説】セクション全体を削除する
    // 「【用語解説】」以降、次のエピソード「第X話」「第X章」または「プロローグ」が始まるまでのテキストを消す
    // 次のエピソードがない（ファイルの末尾）場合も考慮する
    plain = plain.replace(/【用語解説】[\s\S]*?(?=(第[\d一二三四五六七八九十百千万]+[話章]|プロローグ|$))/g, '');

    // 用語解説の脚注番号 （※1） などを除去（【用語解説】ブロックが消えたことによる浮遊マークの削除）
    plain = plain.replace(/（※\d+）/g, '');
  }

  // --- 自動字下げ処理 ---
  const lines = plain.split('\n');
  const indentedLines = lines.map(line => {
    // 空行は無視
    if (!line) return line;
    
    // すでに空白、または特定の記号（会話、ダッシュなど）で始まっている場合は字下げしない
    if (/^[\s　「『（〈《【〔［“‘・※＊—…\-]/.test(line)) return line;

    // 見出し（「第X話」や「プロローグ」）は字下げしない
    if (/^(第\d+話|プロローグ)/.test(line)) return line;

    // それ以外は全角スペースを先頭に追加
    return '　' + line;
  });
  plain = indentedLines.join('\n');

  return plain.trim();
}
