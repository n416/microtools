const fs = require('fs');
const path = require('path');

const targetDir = 'c:\\Users\\shingo\\Desktop\\microtools\\yomimono1\\public\\settings';
const files = fs.readdirSync(targetDir).filter(f => f.startsWith('ep') && f.endsWith('.mdx'));

// number_sort => ep1, ep2, ... ep10_1 ...
files.sort((a, b) => {
    const numA = parseFloat(a.replace('ep', '').replace('_', '.').replace('.mdx', ''));
    const numB = parseFloat(b.replace('ep', '').replace('_', '.').replace('.mdx', ''));
    return numA - numB;
});

files.forEach(file => {
    const content = fs.readFileSync(path.join(targetDir, file), 'utf8');
    const lines = content.split('\n');
    let title = '(no title)';
    for (const line of lines) {
        if (line.startsWith('# ')) {
            title = line;
            break;
        }
    }
    console.log(`${file}: ${title}`);
});
