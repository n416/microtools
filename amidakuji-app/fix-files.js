const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 'E'という文字化けの後にスペースが4つほど空いて変数宣言などが続くパターンを修正
  // 例: `// commentE    const` -> `// comment\n    const`
  content = content.replace(/(\/\/[^\n]*?[Ea-zA-Z0-9])([ \t]{2,})(const |let |return |if |await |try |} else |[a-zA-Z]+\()/g, '$1\n$2$3');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed:', filePath);
}

fixFile(path.join(__dirname, 'src/routes/groups.ts'));
fixFile(path.join(__dirname, 'src/routes/members.ts'));
