import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const txtPath = path.join(__dirname, '../output_novel_ruby_p2.txt');
const text = fs.readFileSync(txtPath, 'utf8');
const lines = text.split('\n');

const CPL = 42;
let hangingLines = [];
let totalPhysicalLines = 0;

lines.forEach((line, index) => {
    let cleanLine = line.replace(/｜(.+?)《.+?》/g, '$1');
    let displayLength = cleanLine.length;
    
    let physicalLines = Math.ceil(displayLength / CPL);
    if (physicalLines === 0) physicalLines = 1;
    totalPhysicalLines += physicalLines;
    
    if (displayLength > 0) {
        let remainder = displayLength % CPL;
        if (remainder >= 1 && remainder <= 3) {
            hangingLines.push({
                lineNum: index + 1,
                length: displayLength,
                overhang: remainder
            });
        }
    }
});

let reportContent = `Total Physical DOCX Lines: ${totalPhysicalLines}\n\n`;
reportContent += `Total Hanging Lines: ${hangingLines.length}\n`;
fs.writeFileSync(path.join(__dirname, '../hanging_lines_report.txt'), reportContent, 'utf8');
console.log('Total Physical DOCX Lines:', totalPhysicalLines);
