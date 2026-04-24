const fs = require('fs');

function fixCorruptedTypeScript(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. 文字化けしたコメントの後ろにくっついたコードを改行で分離
  // パターン: "// (文字化け) (スペース) (キーワード)"
  // ※ 'E' や '' などが含まれる行
  content = content.replace(/(\/\/[^\n]*?(?:[E])[^\n]*?)([ \t]{2,})(const |let |var |return |if |await |try |} else |[a-zA-Z]+\()/g, '$1\n$2$3');

  // 2. 文字化けによって壊れた文字列リテラルを置換
  // パターン: "{ error: ' (文字化け) ' }" のようなもの。閉じクォートが消えている場合もある。
  // TypeScriptのコンパイルエラー "Unterminated string literal" は改行を跨ぐ文字列が原因
  // なので、行の中に単独の "'" がある場合、行末に "'" を補うか、
  // 全角文字化けを含む行のシングルクォーテーションの中身を安全な英語に置換する。

  // 簡単のため、'' などの制御不能な文字を含む行は、強制的に無難なコードに置き換えるアプローチを取る。
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Unterminated string literal 対策:
    // 行内に ' が奇数個あり、かつ末尾が ' ではない場合
    const quoteCount = (line.match(/'/g) || []).length;
    if (quoteCount % 2 !== 0) {
      // 壊れた文字列を一旦英語に置き換えるか、クォートを閉じる
      line = line + "'; // FIXED_UNTERMINATED";
    }

    //  を含む文字列リテラルの修復:
    line = line.replace(/'[^']*?[^']*?'/g, "'Data error'");
    line = line.replace(/"[^"]*?[^"]*?"/g, '"Data error"');

    // コメント内の  は残っていても問題ないが、行末のEによる改行消失は上で対処済み
    
    // コンマやコロンの消失対策（オブジェクト内での文字化け等）
    // もし { error: 'E } などのようになっているなら:
    line = line.replace(/'[^']*?[^']*?$/g, "'Error';");

    lines[i] = line;
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

fixCorruptedTypeScript('src/routes/groups.ts');
fixCorruptedTypeScript('src/routes/members.ts');
