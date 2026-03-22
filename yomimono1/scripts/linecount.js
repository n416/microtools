import fs from 'fs';
const before = fs.readFileSync('output_before.txt', 'utf8').split('\n').length;
const after = fs.readFileSync('output_novel_ruby_p2.txt', 'utf8').split('\n').length;
console.log(`Before: ${before} lines`);
console.log(`After: ${after} lines`);
console.log(`Difference: ${before - after} lines`);
