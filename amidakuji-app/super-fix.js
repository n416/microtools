const fs = require('fs');

function superFix(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = '';
  
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // 文字化けを含みそうな不要なconsole.errorやreturn c.json({error: ...}) を強制的に安全な形にする
    if (line.includes('return c.json({ error:')) {
      line = line.replace(/return c\.json\(\{ error:.*$/, "return c.json({ error: 'Error' }, 500);");
    } else if (line.includes('console.error(')) {
      line = line.replace(/console\.error\(.*$/, "console.error('Error');");
    } else {
      // 奇数クォート問題の解決
      let inSingle = false;
      let inDouble = false;
      let inBacktick = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const prev = j > 0 ? line[j-1] : '';
        
        if (char === "'" && prev !== '\\' && !inDouble && !inBacktick) inSingle = !inSingle;
        if (char === '"' && prev !== '\\' && !inSingle && !inBacktick) inDouble = !inDouble;
        if (char === '`' && prev !== '\\' && !inSingle && !inDouble) inBacktick = !inBacktick;
      }
      
      if (inSingle) line += "'; // FIXED";
      if (inDouble) line += '"; // FIXED';
      // バッククォートは複数行またげるので閉じない
    }
    
    // any 型のエラー修正
    line = line.replace(/\(a, b\) => new Date/g, '(a: any, b: any) => new Date');
    line = line.replace(/\(a, b\) => \{/g, '(a: any, b: any) => {');
    
    newContent += line + '\n';
  }
  
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Super fixed', filePath);
}

superFix('src/routes/events.ts');
superFix('src/routes/groups.ts');
superFix('src/routes/members.ts');
