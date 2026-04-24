const ts = require('typescript');
const fs = require('fs');

function transformStrings(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  
  // 文字化けを含み得るすべての文字列リテラルを置換する
  function visit(node) {
    if (ts.isStringLiteral(node)) {
      const text = node.text;
      // 文字化け特有の文字（縺, 縲, 繝, Eなど）や、マルチバイト文字が含まれている場合
      if (/[^\x00-\x7F]/.test(text)) {
         return ts.factory.createStringLiteral('Replaced String');
      }
    }
    else if (ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text;
      if (/[^\x00-\x7F]/.test(text)) {
         return ts.factory.createNoSubstitutionTemplateLiteral('Replaced String');
      }
    }
    return ts.visitEachChild(node, visit, undefined);
  }

  // ソースファイルをパース
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true
  );

  // ASTを変換
  const transformed = ts.visitNode(sourceFile, visit);
  
  // コードを再生成
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const newCode = printer.printNode(ts.EmitHint.Unspecified, transformed, sourceFile);

  fs.writeFileSync(filePath + '.fixed.ts', newCode, 'utf8');
  console.log('Fixed:', filePath);
}

transformStrings('src/routes/events.ts');
