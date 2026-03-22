import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const txtPath = path.join(__dirname, '../output_novel_ruby_p2.txt');
const text = fs.readFileSync(txtPath, 'utf8');
const lines = text.split('\n');

const CPL = 42;
const LINES_PER_PAGE = 34;

let globalPhysicalLineCount = 0;
let pages = [];
let currentPageId = 1;
let currentTextChars = 0;
let currentBlankLines = 0;
let currentPhysicalLinesInPage = 0;
let currentContext = ''; 

lines.forEach((line) => {
    let cleanLine = line.replace(/｜(.+?)《.+?》/g, '$1');
    let displayLength = cleanLine.length;
    
    let physicalLines = Math.ceil(displayLength / CPL);
    if (physicalLines === 0) {
        physicalLines = 1; // blank line
    }

    // allocate physical lines
    for (let i = 0; i < physicalLines; i++) {
        if (currentPhysicalLinesInPage === 0 && displayLength > 0 && !currentContext) {
            currentContext = cleanLine.substring(0, 15);
        }

        if (displayLength === 0 && physicalLines === 1) {
            currentBlankLines++;
        } else {
            let charsInThisLine = Math.min(displayLength, CPL);
            currentTextChars += charsInThisLine;
            displayLength -= charsInThisLine;
        }

        currentPhysicalLinesInPage++;

        if (currentPhysicalLinesInPage === LINES_PER_PAGE) {
            pages.push({
                pageId: currentPageId,
                totalChars: currentTextChars,
                blankLines: currentBlankLines,
                context: currentContext || '...'
            });
            currentPageId++;
            currentTextChars = 0;
            currentBlankLines = 0;
            currentPhysicalLinesInPage = 0;
            currentContext = '';
        }
    }
});

// Final page
if (currentPhysicalLinesInPage > 0) {
    pages.push({
        pageId: currentPageId,
        totalChars: currentTextChars,
        blankLines: currentBlankLines + (LINES_PER_PAGE - currentPhysicalLinesInPage),
        context: currentContext || '...'
    });
}

const totalCharsAllPages = pages.reduce((sum, p) => sum + p.totalChars, 0);
const avgChars = Math.round(totalCharsAllPages / pages.length);

const densePages = [...pages].sort((a, b) => b.totalChars - a.totalChars).slice(0, 10);

let report = `=== Page Density Analysis ===\n`;
report += `Total Pages: ${pages.length}\n`;
report += `Average Characters per Page: ${avgChars}\n\n`;

report += `=== Top 10 Densest (Blackest) Pages ===\n`;
densePages.forEach((p, idx) => {
    const densityPercent = Math.round((p.totalChars / (LINES_PER_PAGE * CPL)) * 100);
    report += `${idx + 1}. Page ${p.pageId} - ${p.totalChars} chars (${densityPercent}% filled) | Blank lines: ${p.blankLines}\n`;
    report += `   First Line Context: "${p.context}..."\n`;
});

fs.writeFileSync(path.join(__dirname, '../density_report.txt'), report, 'utf8');
console.log('Density report generated.');
