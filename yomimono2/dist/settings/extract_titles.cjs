const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\nakam\\Desktop\\n416\\microtools-1\\yomimono2\\public\\settings';
const files = fs.readdirSync(dir).filter(f => f.startsWith('ep') && f.endsWith('.mdx'));
files.sort();

let output = [];
for (const file of files) {
    const lines = fs.readFileSync(path.join(dir, file), 'utf-8').split('\n');
    let chapter = '';
    let episode = '';
    for (let i = 0; i < 5; i++) {
        if (!lines[i]) continue;
        const chapMatch = lines[i].match(/<!-- Chapter: (.*) -->/);
        if (chapMatch) chapter = chapMatch[1];
        const epiMatch = lines[i].match(/^# (第\d+話：.*)/);
        if (epiMatch) episode = epiMatch[1];
    }
    if (chapter) output.push(`[${file}] CHAPTER: ${chapter}`);
    if (episode) output.push(`[${file}] EPISODE: ${episode}`);
}
console.log(output.join('\n'));
