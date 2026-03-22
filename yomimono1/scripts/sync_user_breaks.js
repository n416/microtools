import fs from 'fs';
import path from 'path';

function getCleanText(text) {
    return text.replace(/<[^>]+>/g, '').replace(/｜(.+?)《.+?》/g, '$1');
}

function syncFile(publicPath, distPath) {
    const publicText = fs.readFileSync(publicPath, 'utf8');
    const distText = fs.readFileSync(distPath, 'utf8');

    const distLines = distText.split(/\r?\n/);
    let publicLines = publicText.split(/\r?\n/);

    const insertions = [];
    for (let i = 0; i < distLines.length; i++) {
        if (distLines[i].trim() === '') {
            let prevNonBlank = null;
            let nextNonBlank = null;
            // find prev
            for (let j = i - 1; j >= 0; j--) {
                if (distLines[j].replace(/\s/g, '') !== '') { 
                    prevNonBlank = getCleanText(distLines[j]).replace(/\s/g, ''); 
                    break; 
                }
            }
            // find next
            for (let j = i + 1; j < distLines.length; j++) {
                if (distLines[j].replace(/\s/g, '') !== '') { 
                    nextNonBlank = getCleanText(distLines[j]).replace(/\s/g, ''); 
                    break; 
                }
            }
            if (prevNonBlank && nextNonBlank) {
                // Store the last 5 chars of prev and first 5 chars of next to identify the gap
                insertions.push({
                    prev: prevNonBlank.slice(-5),
                    next: nextNonBlank.slice(0, 5)
                });
            }
        }
    }

    const newPublicLines = [];
    for (let i = 0; i < publicLines.length; i++) {
        newPublicLines.push(publicLines[i]);
        if (i < publicLines.length - 1) {
            const currentLine = publicLines[i];
            const nextLineOption = publicLines[i+1];
            
            const cleanCurrent = getCleanText(currentLine).replace(/\s/g, '');
            const cleanNext = getCleanText(nextLineOption).replace(/\s/g, '');

            if (cleanCurrent !== '' && cleanNext !== '') {
                // Check if we need to insert a blank line here
                let shouldInsertBlank = false;
                for (let ins of insertions) {
                    if (cleanCurrent.endsWith(ins.prev) && cleanNext.startsWith(ins.next)) {
                        shouldInsertBlank = true;
                        break;
                    }
                }
                if (shouldInsertBlank) {
                    newPublicLines.push('');
                }
            }
        }
    }

    fs.writeFileSync(publicPath, newPublicLines.join('\n'), 'utf8');
    console.log(`Synced ${path.basename(publicPath)}! Found ${newPublicLines.length - publicLines.length} missing blank lines.`);
}

syncFile(
    'c:/Users/shingo/Desktop/microtools/yomimono1/public/settings/ep0500.mdx',
    'c:/Users/shingo/Desktop/microtools/yomimono1/dist/export_resolved_simple/ep0500.mdx'
);

syncFile(
    'c:/Users/shingo/Desktop/microtools/yomimono1/public/settings/ep0700.mdx',
    'c:/Users/shingo/Desktop/microtools/yomimono1/dist/export_resolved_simple/ep0700.mdx'
);

console.log('Line break sync complete.');
