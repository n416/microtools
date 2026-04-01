const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\shingo\\Desktop\\microtools\\yomimono2\\public\\settings';
const files = fs.readdirSync(dir).filter(f => /^ep\d+(_5)?\.mdx$/.test(f));
let count = 0;
let results = [];

for (const file of files) {
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
    let inFrontmatter = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/\r$/, '');
        if (i === 0 && line === '---') { inFrontmatter = true; continue; }
        if (inFrontmatter && line === '---') { inFrontmatter = false; continue; }
        if (inFrontmatter) continue;

        if (line.trim().length === 0) continue;
        if (line.startsWith('#')) continue;

        const len = line.length;
        // 43文字から56文字程度の行（2行目に数文字だけこぼれる「ぶら下がり行」）を抽出
        if (len > 42 && len <= 56) {
            results.push(`${file} (Line ${i+1}) [${len}文字]: ${line}`);
            count++;
        }
    }
}

fs.writeFileSync('c:\\Users\\shingo\\Desktop\\hanging_lines_candidate.log', results.join('\n'));
console.log(`Found ${count} candidate lines.`);
