const fs = require('fs');
function nukeNonAscii(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 文字列内の非ASCII文字を置換する
  content = content.replace(/'([^'\n]*?[^\x00-\x7F]+[^'\n]*?)'/g, "'A system error occurred'");
  content = content.replace(/"([^"\n]*?[^\x00-\x7F]+[^"\n]*?)"/g, '"A system error occurred"');
  content = content.replace(/`([^`]*?[^\x00-\x7F]+[^`]*?)`/g, '`A system error occurred`');
  
  // コメントの非ASCIIを置換する
  content = content.replace(/\/\/([^\n]*?[^\x00-\x7F]+[^\n]*?)/g, '// Removed comment');
  
  // /* */ コメントの非ASCIIを置換する
  content = content.replace(/\/\*([\s\S]*?[^\x00-\x7F]+[\s\S]*?)\*\//g, '/* Removed comment */');
  
  // まだ残っている非ASCII（変数名や予期せぬ場所）を消す
  content = content.replace(/[^\x00-\x7F]+/g, '');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Nuked ' + filePath);
}
nukeNonAscii('src/routes/groups.ts');
nukeNonAscii('src/routes/members.ts');
