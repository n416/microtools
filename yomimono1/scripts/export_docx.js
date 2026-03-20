import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isNoTerms = process.argv.includes('--no-terms');
const isSimpleTerms = process.argv.includes('--simple-terms');
const isRubyTerms = process.argv.includes('--ruby-terms');
const isRubyP2Terms = process.argv.includes('--ruby-p2-terms');

const templatePath = 'sample_format.docx';
let inputPath = 'output_novel.txt';
let outputPath = 'output_novel.docx';

if (isNoTerms) {
  inputPath = 'output_novel_noterms.txt';
  outputPath = 'output_novel_noterms.docx';
} else if (isSimpleTerms) {
  inputPath = 'output_novel_simple.txt';
  outputPath = 'output_novel_simple.docx';
} else if (isRubyTerms) {
  inputPath = 'output_novel_ruby.txt';
  outputPath = 'output_novel_ruby.docx';
} else if (isRubyP2Terms) {
  inputPath = 'output_novel_ruby_p2.txt';
  outputPath = 'output_novel_ruby_p2.docx';
}

console.log(`Generating docx... (no-terms: ${isNoTerms}, simple-terms: ${isSimpleTerms}, ruby-terms: ${isRubyTerms}, ruby-p2-terms: ${isRubyP2Terms})`);

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

  function appendTextRun(parentP, textStr) {
      if (!isRubyP2Terms) {
          const r = doc.createElement('w:r');
          const t = doc.createElement('w:t');
          t.setAttribute('xml:space', 'preserve');
          t.appendChild(doc.createTextNode(textStr));
          r.appendChild(t);
          parentP.appendChild(r);
          return;
      }

      const tcyRegex = /(\!\!|\!\?|\?\!|\d{2})/g;
      let tMatch;
      let tLastIndex = 0;
      while ((tMatch = tcyRegex.exec(textStr)) !== null) {
          if (tMatch.index > tLastIndex) {
              const plain = textStr.substring(tLastIndex, tMatch.index);
              const r = doc.createElement('w:r');
              const t = doc.createElement('w:t');
              t.setAttribute('xml:space', 'preserve');
              t.appendChild(doc.createTextNode(plain));
              r.appendChild(t);
              parentP.appendChild(r);
          }
          
          const tcyText = tMatch[1];
          const tcyR = doc.createElement('w:r');
          const tcyRPr = doc.createElement('w:rPr');
          const eastAsianLayout = doc.createElement('w:eastAsianLayout');
          eastAsianLayout.setAttribute('w:id', '1');
          eastAsianLayout.setAttribute('w:combine', '1');
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
          const t = doc.createElement('w:t');
          t.setAttribute('xml:space', 'preserve');
          t.appendChild(doc.createTextNode(plain));
          r.appendChild(t);
          parentP.appendChild(r);
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
      // 「第X話」または「プロローグ」
      if (/^(第\d+話|プロローグ)/.test(line)) {
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
      
      if (line === '') {
          // Empty line
          const newR = doc.createElement('w:r');
          const newT = doc.createElement('w:t');
          newT.setAttribute('xml:space', 'preserve');
          newT.appendChild(doc.createTextNode(''));
          newR.appendChild(newT);
          newP.appendChild(newR);
      } else {
          // Parse ruby tags like ｜Base《Ruby》
          const rubyRegex = /｜(.+?)《(.+?)》/g;
          let match;
          let lastIndex = 0;

          while ((match = rubyRegex.exec(line)) !== null) {
              // Add normal text before the ruby tag
              if (match.index > lastIndex) {
                  const preText = line.substring(lastIndex, match.index);
                  appendTextRun(newP, preText);
              }

              const baseText = match[1];
              const rtText = match[2];

              // Generate Word ruby elements
              const rubyRun = doc.createElement('w:r'); // The outer container is typically just appended to directly, or wrapped in w:ruby
              const wRuby = doc.createElement('w:ruby');

              const wRubyPr = doc.createElement('w:rubyPr');
              const wRubyAlign = doc.createElement('w:rubyAlign');
              wRubyAlign.setAttribute('w:val', 'distributeSpace'); // Justify
              const wHps = doc.createElement('w:hps');
              wHps.setAttribute('w:val', '10'); // 5pt ruby size
              const wHpsBaseText = doc.createElement('w:hpsBaseText');
              wHpsBaseText.setAttribute('w:val', '21'); // 10.5pt base size
              const wHpsRaise = doc.createElement('w:hpsRaise');
              wHpsRaise.setAttribute('w:val', '18'); // Normal raise distance

              wRubyPr.appendChild(wRubyAlign);
              wRubyPr.appendChild(wHps);
              wRubyPr.appendChild(wHpsRaise);
              wRubyPr.appendChild(wHpsBaseText);
              wRuby.appendChild(wRubyPr);

              const wRt = doc.createElement('w:rt');
              const rtR = doc.createElement('w:r');
              const rPrRt = doc.createElement('w:rPr');
              const rtSz = doc.createElement('w:sz');
              rtSz.setAttribute('w:val', '10');
              const rtSzCs = doc.createElement('w:szCs');
              rtSzCs.setAttribute('w:val', '10');
              rPrRt.appendChild(rtSz);
              rPrRt.appendChild(rtSzCs);
              rtR.appendChild(rPrRt);
              
              const rtT = doc.createElement('w:t');
              rtT.appendChild(doc.createTextNode(rtText));
              rtR.appendChild(rtT);
              wRt.appendChild(rtR);
              wRuby.appendChild(wRt);

              const wRubyBase = doc.createElement('w:rubyBase');
              const baseR = doc.createElement('w:r');
              const baseT = doc.createElement('w:t');
              baseT.appendChild(doc.createTextNode(baseText));
              baseR.appendChild(baseT);
              wRubyBase.appendChild(baseR);
              wRuby.appendChild(wRubyBase);

              newP.appendChild(wRuby);

              lastIndex = rubyRegex.lastIndex;
          }

          // Add any remaining text
          if (lastIndex < line.length) {
              const postText = line.substring(lastIndex);
              appendTextRun(newP, postText);
          }
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
