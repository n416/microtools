const fs = require('fs');

function emergencyFix(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 文字化け特有の「、E」や「」が含まれる行を検知
    if (line.includes('E ') || line.includes('E') || line.includes('')) {
      // return c.json(...) のパターンを安全な英語に強制置換
      if (line.includes('return c.json({ error:')) {
        const match = line.match(/^(\s*return c\.json\(\{ error:).*$/);
        if (match) {
          line = match[1] + " 'An error occurred' }, 500);";
        } else {
            line = line.replace(/error:\s*'.*$/, "error: 'An error occurred' }, 500);");
        }
      } 
      else if (line.includes('console.error(')) {
        line = line.replace(/console\.error\(.*$/, "console.error('An error occurred');");
      }
      // その他の変数代入 (const safeEventName = ... '無題EイベンチE;)
      else if (line.includes('const safeEventName')) {
        line = "    const safeEventName = eventData.eventName || 'Untitled Event';";
      }
      else if (line.includes('name: ')) {
        line = line.replace(/name:\s*'.*$/, "name: 'Unknown', imageUrl: null }));");
      }
      else {
        // それ以外の奇数クォート行
        const singleQuotes = (line.match(/'/g) || []).length;
        if (singleQuotes % 2 !== 0) {
            line = line.replace(/'.*$/, "'Error';");
        }
      }
    }
    
    // パラメータの any 型エラー
    if (line.includes('(a, b) => {') || line.includes('(a, b) => new Date')) {
      line = line.replace(/\(a, b\)/g, '(a: any, b: any)');
    }

    lines[i] = line;
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log('Fixed', filePath);
}

emergencyFix('src/routes/events.ts');
