import fs from 'fs';
import path from 'path';

const targetDir = 'C:\\Users\\shingo\\Desktop\\microtools\\yomimono2\\public\\settings';
const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.mdx'));

function getVisibleLength(str) {
    const cleanStr = str.replace(/<[^>]+>/g, '');
    let length = 0;
    for (let i = 0; i < cleanStr.length; i++) {
        const charCode = cleanStr.charCodeAt(i);
        if (charCode >= 0x00 && charCode <= 0x7F) {
            length += 0.5;
        } else {
            length += 1;
        }
    }
    return Math.ceil(length);
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    const formattedLines = [];
    let currentParagraphLines = 0;
    let inParagraph = false;
    
    for (let i = 0; i < lines.length; i++) {
        // `\r` がある環境も考慮
        let line = lines[i].replace(/\r$/, '');
        // 末尾の余分なスペースは除去
        line = line.replace(/\s+$/, '');

        if (line === '') continue;

        if (line.startsWith('# ')) {
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                formattedLines.push('');
            }
            formattedLines.push(line);
            formattedLines.push('');
            currentParagraphLines = 0;
            continue;
        }

        if (line.startsWith('「') || line.startsWith('『')) {
            // 直前の行が空行でなく、かつ地の文だった場合は空行をいれる
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                const prev = formattedLines[formattedLines.length - 1];
                if (!prev.startsWith('「') && !prev.startsWith('『') && !prev.startsWith('# ')) {
                    formattedLines.push('');
                }
            }
            formattedLines.push(line);
            currentParagraphLines = 0;
            inParagraph = false;
            // 会話文の直後には一旦空行を入れる方針（もし次も会話なら上記でくっつくが、ここでは一旦保留）
            // 次のループで、次が会話でなければ空行が入るようにする
            continue;
        }

        // 地の文
        if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
            const prev = formattedLines[formattedLines.length - 1];
            if (prev.startsWith('「') || prev.startsWith('『') || prev.startsWith('# ')) {
                formattedLines.push('');
                currentParagraphLines = 0;
            }
        }

        const visibleLen = getVisibleLength(line);
        const calcLines = Math.ceil(visibleLen / 42) || 1; 

        formattedLines.push(line);
        currentParagraphLines += calcLines;

        const isEndWithSpecial = line.endsWith('——') || line.endsWith('……') || line.endsWith('――') || line.endsWith('…');
        if (currentParagraphLines >= 3 || isEndWithSpecial) {
            formattedLines.push('');
            currentParagraphLines = 0;
        }
    }

    const finalLines = [];
    let isPrevEmpty = true; 
    for (const line of formattedLines) {
        if (line === '') {
            if (!isPrevEmpty) {
                finalLines.push(line);
                isPrevEmpty = true;
            }
        } else {
            finalLines.push(line);
            isPrevEmpty = false;
        }
    }
    while (finalLines.length > 0 && finalLines[finalLines.length - 1] === '') {
        finalLines.pop();
    }

    fs.writeFileSync(filePath, finalLines.join('\n') + '\n', 'utf8');
}

const targetFile = process.argv[2] ? path.join(targetDir, process.argv[2]) : null;

if (targetFile) {
    console.log(`Processing single file: ${targetFile}`);
    processFile(targetFile);
} else {
    for (const f of files) {
        processFile(path.join(targetDir, f));
    }
    console.log(`Processed all mdx files.`);
}
