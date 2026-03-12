const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'settings');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx') && /ep\d{4}\.mdx/.test(f));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  content = content.replace(/data-next="ep(0[1-9]|10)00"/g, (match, p1) => {
    let oldNum = parseInt(p1, 10);
    let newNumStr = (oldNum - 1).toString().padStart(2, '0');
    return `data-next="ep${newNumStr}00"`;
  });

  fs.writeFileSync(filePath, content, 'utf-8');
});
console.log('MDX internal links updated.');

// Update term_map.js
const termMapPath = path.join(__dirname, '..', 'src', 'term_map.js');
if (fs.existsSync(termMapPath)) {
  let termMapContent = fs.readFileSync(termMapPath, 'utf-8');
  termMapContent = termMapContent.replace(/"ep(0[1-9]|10)00"/g, (match, p1) => {
      let oldNum = parseInt(p1, 10);
      let newNumStr = (oldNum - 1).toString().padStart(2, '0');
      return `"ep${newNumStr}00"`;
  });
  fs.writeFileSync(termMapPath, termMapContent, 'utf-8');
  console.log('Term map updated.');
}
