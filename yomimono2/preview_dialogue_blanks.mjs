import fs from 'fs';
import path from 'path';

const dir = './public/settings';
const files = fs.readdirSync(dir).filter(f => /^ep\d+(?:_\d+)?\.mdx$/.test(f)).sort();

let countBefore = 0;
let countAfter = 0;

for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf-8');
    const lines = text.split(/\r?\n/);
    
    for (let i = 1; i < lines.length - 1; i++) {
        // [地の文] -> [空行] -> [セリフ]
        if (lines[i] === '' && lines[i+1].startsWith('「') && lines[i-1].startsWith('　')) {
            countBefore++;
        }
        // [セリフ] -> [空行] -> [地の文]
        if (lines[i] === '' && (lines[i-1].endsWith('」') || lines[i-1].endsWith('』')) && lines[i+1].startsWith('　')) {
            countAfter++;
        }
    }
}

console.log(`[地の文] -> [空行] -> [セリフ] の箇所: ${countBefore} 個`);
console.log(`[セリフ] -> [空行] -> [地の文] の箇所: ${countAfter} 個`);
