const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\shingo\\Desktop\\microtools\\yomimono2\\public\\settings';
const logPath = path.join(dir, 'prep_micro_blocks.log');

try {
    const files = fs.readdirSync(dir).filter(f => f.match(/^ep\d{4}\.mdx$/)).sort();
    const allBlocks = [];
    let blockId = 0;

    for (const file of files) {
        const rawText = fs.readFileSync(path.join(dir, file), 'utf-8');
        const lines = rawText.split('\n');
        let currentPov = 'Unknown';
        let currentBlockStr = '';
        let startLineNum = 1;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            const povMatch = line.match(/<!--\s*POV:\s*(.*?)\s*-->/);
            if (povMatch) {
                currentPov = povMatch[1];
                continue; 
            }

            if (line === '' || line.startsWith('#') || line.startsWith('//') || line.startsWith('<!--')) {
                if (currentBlockStr.trim() !== '') {
                    allBlocks.push({
                        id: blockId++,
                        file: file,
                        pov: currentPov,
                        startLine: startLineNum,
                        endLine: i,
                        text: currentBlockStr.trim()
                    });
                    currentBlockStr = '';
                }
                startLineNum = i + 2; 
                continue;
            }

            currentBlockStr += (currentBlockStr ? '\n' : '') + line;
        }

        if (currentBlockStr.trim() !== '') {
            allBlocks.push({
                id: blockId++,
                file: file,
                pov: currentPov,
                startLine: startLineNum,
                endLine: lines.length,
                text: currentBlockStr.trim()
            });
        }
    }

    const outputPath = path.join(dir, 'micro_blocks.json');
    fs.writeFileSync(outputPath, JSON.stringify(allBlocks, null, 2), 'utf-8');
    fs.writeFileSync(logPath, 'SUCCESS. Total blocks: ' + allBlocks.length, 'utf-8');
} catch(e) {
    fs.writeFileSync(logPath, 'ERROR: ' + e.message + '\n' + e.stack, 'utf-8');
}
