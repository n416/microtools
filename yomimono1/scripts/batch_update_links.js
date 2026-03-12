const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'settings');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx') && f.startsWith('ep'));

// We subtracted 100 from every epXXXX.
// The next buttons have things like `data-next="ep0200"`.
// Wait, ep1000 was moved to ep0900. Its target was none or something.
// But ep0100 was moved to ep0000, and its NEXT target WAS `ep0200`, which SHOULD now be `ep0100`.
// So we just replace all `ep0(\d)00` with `ep0($1-1)00` and `ep1000` with `ep0900`

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Regex to match data-next="epXXXX"
  content = content.replace(/data-next="ep(0[1-9]|10)00"/g, (match, p1) => {
    let oldNum = parseInt(p1, 10);
    let newNumStr = (oldNum - 1).toString().padStart(2, '0');
    return `data-next="ep${newNumStr}00"`;
  });

  fs.writeFileSync(filePath, content, 'utf-8');
});
console.log('MDX internal links updated.');
