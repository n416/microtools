const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname);
const files = fs.readdirSync(targetDir).filter(f => f.startsWith('ep') && f.endsWith('.mdx'));

const forbiddenRegexStrict = /(私|自分|俺|僕)(が|の|に|を|は|とって|も)/;

const results = [];

files.forEach(file => {
    const filePath = path.join(targetDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let inCommentOrMeta = false;
    const fileIssues = [];

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
            .replace(/『.*?』/g, '');
        // 心の声（）は一部地の文として扱われているケースもあるが、今回は「一人称の独白はセーフ」として（）も抜く。もしメタなら手動で。
        textWithoutVoice = textWithoutVoice.replace(/（.*?）/g, '');

        if (forbiddenRegexStrict.test(textWithoutVoice)) {
            fileIssues.push({
                lineNum: index + 1,
                originalText: line
            });
        }
    });

    if (fileIssues.length > 0) {
        results.push({
            file: file,
            issues: fileIssues
        });
    }
});

fs.writeFileSync(path.join(targetDir, 'pov_issues.json'), JSON.stringify(results, null, 2), 'utf8');
