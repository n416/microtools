import fs from 'fs';
import PizZip from 'pizzip';

try {
  const content = fs.readFileSync('sample_format.docx', 'binary');
  const zip = new PizZip(content);
  const xml = zip.file('word/document.xml').asText();
  const sectPrMatch = xml.match(/<w:sectPr.*?>.*?<\/w:sectPr>/g);
  const sect = "sectPr: " + (sectPrMatch ? sectPrMatch[0] : "Not found") + "\n";
  const pPrMatch = xml.match(/<w:pPr>.*?<\/w:pPr>/);
  const ppr = "pPr: " + (pPrMatch ? pPrMatch[0] : "Not found") + "\n";
  fs.writeFileSync('debug_docx.txt', sect + ppr);
} catch(e) {
  console.error(e);
}
