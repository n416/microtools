const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'settings');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx'));

let count = 0;
files.forEach(file => {
  const p = path.join(dir, file);
  try {
    let content = fs.readFileSync(p, 'utf8');
    if (content.includes('ローガン')) {
      content = content.replace(/ローガン/g, 'ヴィラン');
      fs.writeFileSync(p, content, 'utf8');
      console.log('Updated: ' + file);
      count++;
    }
  } catch (e) {
    console.error('Error in ' + file + ':', e);
  }
});
console.log('Total files updated: ' + count);
