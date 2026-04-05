const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public', 'settings');
const extractOutput = path.join(__dirname, 'extract_results_phase4.json');

const targets = ['膨大', '異常', '必死', '最も', '冷酷'];

function processDirectory(directory, results) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath, results);
    } else if (fullPath.endsWith('.mdx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (line.trim().length === 0) return;
        
        for (const target of targets) {
          if (line.includes(target)) {
            if (!results[target]) results[target] = [];
            
            const prevLine = index > 0 ? lines[index - 1].trim() : '';
            const contextText = prevLine ? `${prevLine} ${line.trim()}` : line.trim();
            results[target].push({
              file: file,
              lineNum: index + 1,
              text: contextText,
              originalLine: line.trim()
            });
          }
        }
      });
    }
  }
}

const finalResults = {};
processDirectory(targetDir, finalResults);

fs.writeFileSync(extractOutput, JSON.stringify(finalResults, null, 2), 'utf8');
console.log('Extraction complete! Found targets:');
for(const [t, arr] of Object.entries(finalResults)) {
  console.log(`- ${t}: ${arr.length} instances`);
}
