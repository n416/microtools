const fs = require('fs');
const path = require('path');

const dirsToClean = [
  './public/settings',
  './dist/export_resolved_ruby',
  './dist/export_resolved_simple'
];

let filesCleaned = 0;

for (const dir of dirsToClean) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (!file.endsWith('.mdx')) continue;
    const filePath = path.join(dir, file);
    let original = fs.readFileSync(filePath, 'utf8');
    
    // Replace trailing spaces/tabs before a newline
    let changed = original.replace(/[ \t]+(\r?\n)/g, '$1');
    // Replace trailing spaces/tabs at the very end of the file
    changed = changed.replace(/[ \t]+$/, '');
    
    if (original !== changed) {
      fs.writeFileSync(filePath, changed, 'utf8');
      filesCleaned++;
      console.log(`Trimmed trailing spaces in: ${filePath}`);
    }
  }
}

console.log(`Done. Cleaned ${filesCleaned} files.`);
try {
  fs.unlinkSync(__filename);
} catch(e) {}
