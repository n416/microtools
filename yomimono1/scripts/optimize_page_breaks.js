import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isNoTerms = process.argv.includes('--no-terms');
const isSimpleTerms = process.argv.includes('--simple-terms');
const isRubyTerms = process.argv.includes('--ruby-terms');
const isRubyP2Terms = process.argv.includes('--ruby-p2-terms');

let inputFilename = 'output_novel.txt';
let logFilename = 'debug_page_breaks_log.txt';

if (isNoTerms) {
  inputFilename = 'output_novel_noterms.txt';
  logFilename = 'debug_page_breaks_log_noterms.txt';
} else if (isSimpleTerms) {
  inputFilename = 'output_novel_simple.txt';
  logFilename = 'debug_page_breaks_log_simple.txt';
} else if (isRubyTerms) {
  inputFilename = 'output_novel_ruby.txt';
  logFilename = 'debug_page_breaks_log_ruby.txt';
} else if (isRubyP2Terms) {
  inputFilename = 'output_novel_ruby_p2.txt';
  logFilename = 'debug_page_breaks_log_ruby_p2.txt';
}

const targetFile = path.resolve(__dirname, '../' + inputFilename);
const logFile = path.resolve(__dirname, '../' + logFilename);

if (!fs.existsSync(targetFile)) {
  console.error('Error: Target file not found:', targetFile);
  process.exit(1);
}

const originalLines = fs.readFileSync(targetFile, 'utf8').split('\n');

const kinsokuHead = /^[、。，．・：；？！ヽヾ・ーぁ-ぉっゃ-ょァ-ォッャ-ョヵヶ)\]}）］｝〉》】〕」』]/;
const kinsokuTail = /^[(\[{（［｛〈《【〔「『]/;
const CHARS_PER_LINE = 42;
const LINES_PER_PAGE = 34;

function dumpConsumedLines(originalText) {
    let t = originalText;
    const tcyRegex = /(\!\!|\!\?|\?\!|\d{2})/g;
    t = t.replace(tcyRegex, 'X'); 
    if (t.length === 0) return [''];

    let splits = [];
    let remainingText = t;
    let originalRemaining = originalText;
    
    while (remainingText.length > 0) {
        let currentWidth = 0; 
        let cutPos = 0;
        
        for (let i = 0; i < remainingText.length; i++) {
            let char = remainingText[i];
            let isAscii = char.match(/[ -~]/);
            
            if (isAscii) {
                currentWidth += 0.5;
            } else {
                currentWidth += 1.0;
            }
            
            if (currentWidth > CHARS_PER_LINE) {
                cutPos = i; 
                break;
            } else if (currentWidth === CHARS_PER_LINE) {
                cutPos = i + 1;
                break;
            }
        }
        
        if (currentWidth <= CHARS_PER_LINE && cutPos === 0) {
            splits.push(originalRemaining);
            break;
        }

        if (cutPos < remainingText.length && kinsokuHead.test(remainingText[cutPos])) {
            if (/^[、。，．]/.test(remainingText[cutPos])) {
                cutPos += 1; 
                if (cutPos < remainingText.length && /^[」』）》】〕〉]/.test(remainingText[cutPos])) {
                    cutPos += 1;
                }
            } else {
                let originalCutPos = cutPos;
                cutPos -= 1; 
                let rewindCount = 1;
                while (cutPos > 0 && kinsokuHead.test(remainingText[cutPos]) && rewindCount < 5) {
                    cutPos -= 1;
                    rewindCount++;
                }
                if (rewindCount >= 5) cutPos = originalCutPos;
            }
        } else if (cutPos > 0 && kinsokuTail.test(remainingText[cutPos - 1])) {
            cutPos -= 1; 
        }
        
        if (cutPos <= 0) cutPos = 1; 
        
        splits.push(originalRemaining.substring(0, cutPos));
        remainingText = remainingText.substring(cutPos);
        originalRemaining = originalRemaining.substring(cutPos);
    }
    return splits;
}

const logStream = fs.createWriteStream(logFile, { flags: 'w' });

let allSplitsQueue = [];
let hasGlossary = false;
let startingPageNumber = 1;
let forceNewPage = false;

for (let i = 0; i < originalLines.length; i++) {
    let originalLine = originalLines[i].replace(/\r$/, '');
    let trimmedLine = originalLine;
    
    if (trimmedLine === '【用語解説】' || trimmedLine.includes('【用語解説】')) {
        hasGlossary = true;
    }
    if (/^(第\d+話|プロローグ)/.test(originalLine)) {
        if (originalLine.startsWith('プロローグ')) {
            forceNewPage = true;
            startingPageNumber = 2;
        } else if (hasGlossary) {
            forceNewPage = true;
        }
        hasGlossary = false;
    } else {
        forceNewPage = false;
    }

    let splits = dumpConsumedLines(trimmedLine);

    splits.forEach((part, index) => {
        allSplitsQueue.push({
            text: part,
            originalIndex: i, 
            isEmpty: trimmedLine === '',
            forceNewPage: index === 0 ? forceNewPage : false,
            startingPageNumber: index === 0 ? startingPageNumber : null
        });
    });
}

let pageCount = 1;
let removedOriginalLineIndices = new Set();
let logLines = [];

while (allSplitsQueue.length > 0) {
    if (allSplitsQueue[0].forceNewPage && allSplitsQueue[0].startingPageNumber !== null) {
        pageCount = allSplitsQueue[0].startingPageNumber;
    }

    while (allSplitsQueue.length > 0 && allSplitsQueue[0].isEmpty && !allSplitsQueue[0].forceNewPage) {
        let removedObj = allSplitsQueue.shift();
        removedOriginalLineIndices.add(removedObj.originalIndex);
        logLines.push(`[PAGE ${pageCount} TOP] => 【空白行削除】 (Shifted up element from line ${removedObj.originalIndex + 1})`);
    }

    if (allSplitsQueue.length === 0) break;

    if (allSplitsQueue[0].forceNewPage && allSplitsQueue[0].startingPageNumber !== null) {
         pageCount = allSplitsQueue[0].startingPageNumber;
    }
    
    let lineRaw = allSplitsQueue[0].text;
    if (lineRaw.length > 40) lineRaw = lineRaw.substring(0, 41);
    logLines.push(`[PAGE ${pageCount} TOP] : ${lineRaw}`);
    
    let linesInPage = 0;
    while (linesInPage < LINES_PER_PAGE && allSplitsQueue.length > 0) {
        if (linesInPage > 0 && allSplitsQueue[0].forceNewPage) {
            break;
        }
        allSplitsQueue.shift();
        linesInPage++;
    }
    
    pageCount++;
}

logLines.push(`\n>>> OPTIMIZATION COMPLETE.`);
logLines.push(`>>> TOTAL EMPTY LINES OBLITERATED: ${removedOriginalLineIndices.size}`);

let finalCleanLines = [];
// Removed the actual modification of the TXT file since the export pipeline handles generation. 
// However, the original script *did* write it to targetFile to finalize the optimization so Word can read it.
for (let i = 0; i < originalLines.length; i++) {
    if (removedOriginalLineIndices.has(i)) {
        continue;
    }
    finalCleanLines.push(originalLines[i]);
}

fs.writeFileSync(targetFile, finalCleanLines.join('\n'));

for (const msg of logLines) {
    logStream.write(msg + '\n');
}
logStream.end();
console.log(`[optimize_page_breaks] Completed for ${inputFilename}. Consumed ${removedOriginalLineIndices.size} empty lines.`);
