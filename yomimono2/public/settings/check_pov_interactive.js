const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname);
const files = fs.readdirSync(targetDir).filter(f => f.startsWith('ep') && f.endsWith('.mdx'));

const forbiddenRegex = /(私|自分|俺|僕)が|の|に|を|は/; // 助詞をつけて少し誤爆を防ぎつつ検索
// さらに「私」「自分」単体でも使われるので、/(私|自分|俺|僕)/で十分か。
const forbiddenRegexStrict = /(私|自分|俺|僕)(が|の|に|を|は|とって|も)/;

let totalFound = 0;

files.forEach(file => {
    const lines = fs.readFileSync(path.join(targetDir, file), 'utf8').split('\n');
    let inCommentOrMeta = false;
    let foundInFile = false;

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('<!--') && !trimmed.includes('-->')) {
            inCommentOrMeta = true;
        }
        if (inCommentOrMeta && trimmed.includes('-->')) {
            inCommentOrMeta = false;
            return;
        }
        if (inCommentOrMeta || trimmed.startsWith('<!--') || trimmed.startsWith('#')) return;

        // セリフや心の声を削除して判定
        let textWithoutVoice = line
            .replace(/「.*?」/g, '')
            .replace(/（.*?）/g, '')
            .replace(/『.*?』/g, '');

        if (forbiddenRegexStrict.test(textWithoutVoice)) {
            if (!foundInFile) {
                console.log(`\n--- ${file} ---`);
                foundInFile = true;
            }
            console.log(`L${index + 1}: ${line}`);
            totalFound++;
        }
    });
});

console.log(`\nTotal lines with issues found: ${totalFound}`);
