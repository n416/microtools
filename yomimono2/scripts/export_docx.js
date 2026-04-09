import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { formatForVerticalText } from './utils_vertical_format.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isNoTerms = process.argv.includes('--no-terms');

const templatePath = 'sample_format.docx';
let inputPath = 'output_novel.txt';
let outputPath = 'output_novel.docx';

if (isNoTerms) {
  inputPath = 'output_novel_noterms.txt';
  outputPath = 'output_novel_noterms.docx';
}

console.log(`Generating docx... (no-terms: ${isNoTerms})`);

try {
  // Read docx zip
  const templateContent = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(templateContent);

  const docXmlText = zip.file('word/document.xml').asText();

  const parser = new DOMParser();
  const doc = parser.parseFromString(docXmlText, 'text/xml');

  const body = doc.getElementsByTagName('w:body')[0];

  // Extract style of the first paragraph, if exists
  const paragraphs = body.getElementsByTagName('w:p');
  let defaultPPr = null;
  if (paragraphs.length > 0) {
      const pPrElements = paragraphs[0].getElementsByTagName('w:pPr');
      if (pPrElements.length > 0) {
          defaultPPr = pPrElements[0].cloneNode(true);
      }
  }

  // Extract sectPr
  let sectPr = null;
  const sectPrElements = body.getElementsByTagName('w:sectPr');
  if (sectPrElements.length > 0) {
      // There should be only one at the end of body, but we take the last one just in case
      sectPr = sectPrElements[sectPrElements.length - 1].cloneNode(true);
  }

  // Clear body (remove all existing contents but keep sectPr for the end)
  while (body.firstChild) {
      body.removeChild(body.firstChild);
  }

  let text = fs.readFileSync(inputPath, 'utf8');
  text = formatForVerticalText(text);
  let lines = text.split('\n');

  function appendTextRun(parentP, textStr, isBold = false) {
      const tcyRegex = /(\!\!|\!\?|\?\!|\d{2}|(?<![0-9A-Za-z])(?:[0-9][A-Za-z]|[A-Za-z][0-9])(?![0-9A-Za-z]))/g;
      let tMatch;
      let tLastIndex = 0;
      while ((tMatch = tcyRegex.exec(textStr)) !== null) {
          if (tMatch.index > tLastIndex) {
              const plain = textStr.substring(tLastIndex, tMatch.index);
              const r = doc.createElement('w:r');
              if (isBold) {
                  const rPr = doc.createElement('w:rPr');
                  rPr.appendChild(doc.createElement('w:b'));
                  r.appendChild(rPr);
              }
              const t = doc.createElement('w:t');
              t.setAttribute('xml:space', 'preserve');
              t.appendChild(doc.createTextNode(plain));
              r.appendChild(t);
              parentP.appendChild(r);
          }
          
          const tcyText = tMatch[1];
          const tcyR = doc.createElement('w:r');
          const tcyRPr = doc.createElement('w:rPr');
          
          if (isBold) {
              tcyRPr.appendChild(doc.createElement('w:b'));
          }
          
          const rFonts = doc.createElement('w:rFonts');
          rFonts.setAttribute('w:hint', 'eastAsia');
          tcyRPr.appendChild(rFonts);

          const eastAsianLayout = doc.createElement('w:eastAsianLayout');
          eastAsianLayout.setAttribute('w:id', '1');
          eastAsianLayout.setAttribute('w:vert', '1');
          eastAsianLayout.setAttribute('w:vertCompress', '1');

          tcyRPr.appendChild(eastAsianLayout);
          tcyR.appendChild(tcyRPr);
          const tcyT = doc.createElement('w:t');
          tcyT.appendChild(doc.createTextNode(tcyText));
          tcyR.appendChild(tcyT);
          parentP.appendChild(tcyR);

          tLastIndex = tcyRegex.lastIndex;
      }
      if (tLastIndex < textStr.length) {
          const plain = textStr.substring(tLastIndex);
          const r = doc.createElement('w:r');
          if (isBold) {
              const rPr = doc.createElement('w:rPr');
              rPr.appendChild(doc.createElement('w:b'));
              r.appendChild(rPr);
          }
          const t = doc.createElement('w:t');
          t.setAttribute('xml:space', 'preserve');
          t.appendChild(doc.createTextNode(plain));
          r.appendChild(t);
          parentP.appendChild(r);
      }
  }

  let hasGlossary = false;
  let inGlossaryTail = false;

  // --- あらすじの挿入 ---
  const synopsisPath = path.resolve(__dirname, '../public/settings/synopsis.txt');
  if (fs.existsSync(synopsisPath)) {
      const synopsisText = fs.readFileSync(synopsisPath, 'utf8');
      if (synopsisText.trim() !== '') {
          const synopsisLines = synopsisText.split('\n');
          for (const sLine of synopsisLines) {
              let cleanedLine = sLine.replace(/\r$/, '');
              
              if (cleanedLine !== '' && !cleanedLine.startsWith('【') && !/^[ 　\t]/.test(cleanedLine)) {
                  cleanedLine = '　' + cleanedLine;
              }

              const sP = doc.createElement('w:p');
              if (defaultPPr) sP.appendChild(defaultPPr.cloneNode(true));
              const sR = doc.createElement('w:r');
              const sT = doc.createElement('w:t');
              if (cleanedLine === '') {
                  sT.setAttribute('xml:space', 'preserve');
                  sT.appendChild(doc.createTextNode(''));
              } else {
                  sT.appendChild(doc.createTextNode(cleanedLine));
              }
              sR.appendChild(sT);
              sP.appendChild(sR);
              body.appendChild(sP);
          }
          
          // あらすじの後に改ページを挿入
          const pbP = doc.createElement('w:p');
          const pbR = doc.createElement('w:r');
          const pb = doc.createElement('w:br');
          pb.setAttribute('w:type', 'page');
          pbR.appendChild(pb);
          pbP.appendChild(pbR);
          body.appendChild(pbP);
      }
  }

  for (let i = 0; i < lines.length; i++) {
      let line = lines[i].replace(/\r$/, '');
      
      if (line.trim() === '【用語解説】' || line.includes('【用語解説】')) {
          hasGlossary = true;
          inGlossaryTail = true;
      }
      
      // If we are right after the glossary, skip pure empty lines
      if (inGlossaryTail) {
          if (line.trim() === '' && lines[i-1] && lines[i-1].replace(/\r$/, '').trim() === '') {
             // It's a consecutive empty line, but let's just skip all trailing empty lines
             continue;
          }
          if (line.trim() !== '' && !line.includes('【用語解説】') && !line.startsWith('※')) {
             // We've moved past the glossary elements (the empty lines and definition lines)
             inGlossaryTail = false;
          }
      }
      
      // Page break logic & Chapter title formatting
      const isChapterTitle = /^(?:第[一二三四五六七八九十百千万]+章|序章|終章|プロローグ|エピローグ|幕間|最終章)/.test(line);

      if (isChapterTitle) {
          if (hasGlossary) {
              // insert page break
              const pbP = doc.createElement('w:p');
              const pbR = doc.createElement('w:r');
              const pb = doc.createElement('w:br');
              pb.setAttribute('w:type', 'page');
              pbR.appendChild(pb);
              pbP.appendChild(pbR);
              body.appendChild(pbP);
          }
          hasGlossary = false; // reset for the new chapter
      }
      
      // Create new paragraph
      const newP = doc.createElement('w:p');
      let pPr = defaultPPr ? defaultPPr.cloneNode(true) : null;
      
      if (/^　?(?:＊　＊　＊|◆　◆　◆|◇　◇　◇)\s*$/.test(line)) {
          line = line.replace(/^　/, ''); // 中央揃え時のズレを防ぐため先頭の全角スペースを削除
          if (!pPr) pPr = doc.createElement('w:pPr');
          let jcList = pPr.getElementsByTagName('w:jc');
          if (jcList.length > 0) {
              jcList[0].setAttribute('w:val', 'center');
          } else {
              const jc = doc.createElement('w:jc');
              jc.setAttribute('w:val', 'center');
              pPr.appendChild(jc);
          }
      }
      
      if (pPr) {
          newP.appendChild(pPr);
      }
      
      if (line === '') {
          // Empty line
          const newR = doc.createElement('w:r');
          const newT = doc.createElement('w:t');
          newT.setAttribute('xml:space', 'preserve');
          newT.appendChild(doc.createTextNode(''));
          newR.appendChild(newT);
          newP.appendChild(newR);
      } else {
          // If it's a chapter title, pass true for bold
          appendTextRun(newP, line, isChapterTitle);
      }
      
      body.appendChild(newP);
  }

  // Append sectPr at the very end to retain page layout logic
  if (sectPr) {
      body.appendChild(sectPr);
  }

  const serializer = new XMLSerializer();
  const newDocXmlText = serializer.serializeToString(doc);

  zip.file('word/document.xml', newDocXmlText);
  const outBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outputPath, outBuf);

  console.log('Successfully generated output_novel.docx');
} catch (error) {
  console.error('Error generating docx:', error);
}
