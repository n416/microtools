import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatePath = 'sample_format.docx';
const inputPath = 'output_novel.txt';
const outputPath = 'output_novel.docx';

console.log('Generating docx...');

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

  // Read novel text
  const text = fs.readFileSync(inputPath, 'utf8');
  const lines = text.split('\n');

  let hasGlossary = false;
  let inGlossaryTail = false;

  // --- あらすじの挿入 ---
  const synopsisPath = path.resolve(__dirname, '../public/settings/synopsis.txt');
  if (fs.existsSync(synopsisPath)) {
      const synopsisText = fs.readFileSync(synopsisPath, 'utf8');
      if (synopsisText.trim() !== '') {
          const synopsisLines = synopsisText.split('\n');
          for (const sLine of synopsisLines) {
              const cleanedLine = sLine.replace(/\r$/, '');
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
      
      // Page break logic: when we hit a new chapter, check if previous chapter had a glossary
      // 「第X話」
      if (/^第\d+話/.test(line)) {
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
      if (defaultPPr) {
          newP.appendChild(defaultPPr.cloneNode(true));
      }
      
      const newR = doc.createElement('w:r');
      const newT = doc.createElement('w:t');
      
      if (line === '') {
          // Empty line
          newT.setAttribute('xml:space', 'preserve');
          newT.appendChild(doc.createTextNode(''));
      } else {
          newT.appendChild(doc.createTextNode(line));
      }
      
      newR.appendChild(newT);
      newP.appendChild(newR);
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
