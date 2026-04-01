const fs = require('fs');
const path = require('path');

try {
    const dir = path.join(__dirname, '../public/settings');
    let files = fs.readdirSync(dir);
    
    let validFiles = [];
    for (const f of files) {
        let m = f.match(/^ep(\d+)\.mdx$/);
        if (m) {
            let n = parseInt(m[1], 10);
            if (n >= 5 && n <= 200) {
                validFiles.push(f);
            }
        }
    }
    
    validFiles.sort((a,b) => {
        return parseInt(a.replace('ep','').replace('.mdx',''), 10) - parseInt(b.replace('ep','').replace('.mdx',''), 10);
    });

    let linesOut = [];
    let totChar = 0;
    let totTxtLines = 0;
    let totEmpLines = 0;
    
    // Sort logic to make sure we don't spam too much output, or maybe we want all 195 lines so AI can review.
    for (const file of validFiles) {
        let p = path.join(dir, file);
        let content = fs.readFileSync(p, 'utf8');
        
        let cLines = content.split('\n');
        let textLineCount = 0;
        let emptyLineCount = 0;
        let charCount = 0;

        // Skip frontmatter
        let i = 0;
        if (cLines[0] && cLines[0].trim() === '---') {
            i = 1;
            while (i < cLines.length && cLines[i].trim() !== '---') {
                i++;
            }
            i++; 
        }

        for (; i < cLines.length; i++) {
            let line = cLines[i].trim();
            if (line === '') {
                emptyLineCount++;
            } else {
                textLineCount++;
                charCount += line.replace(/\s/g, '').length;
            }
        }

        totChar += charCount;
        totTxtLines += textLineCount;
        totEmpLines += emptyLineCount;

        let rt = (textLineCount + emptyLineCount) === 0 ? 0 : (emptyLineCount / (textLineCount + emptyLineCount)) * 100;
        let chL = textLineCount === 0 ? 0 : (charCount / textLineCount);

        linesOut.push(`${file} - 文字数:${charCount}, テクスト行:${textLineCount}, 空行:${emptyLineCount}, 空行率:${rt.toFixed(1)}%, 1行平均文字数:${chL.toFixed(1)}`);
    }

    let allRt = (totTxtLines + totEmpLines) === 0 ? 0 : (totEmpLines / (totTxtLines + totEmpLines)) * 100;
    let allChL = totTxtLines === 0 ? 0 : (totChar / totTxtLines);

    linesOut.push('\n--- サマリ ---');
    linesOut.push(`対象ファイル数: ${validFiles.length}`);
    linesOut.push(`平均空行率: ${allRt.toFixed(1)}%`);
    linesOut.push(`全体平均1行文字数: ${allChL.toFixed(1)}`);

    const outPath = 'c:\\Users\\shingo\\Desktop\\measure_result.log';
    fs.writeFileSync(outPath, linesOut.join('\n'), 'utf8');
} catch (e) {
    const errPath = 'c:\\Users\\shingo\\Desktop\\measure_error.log';
    fs.writeFileSync(errPath, e.toString(), 'utf8');
}
