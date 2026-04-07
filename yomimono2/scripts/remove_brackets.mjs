import fs from 'fs/promises';
import path from 'path';

const settingsDir = path.join(process.cwd(), 'public', 'settings');
const excludeFiles = ['ep0265.mdx'];

async function main() {
  const files = await fs.readdir(settingsDir);
  const targetFiles = files.filter(f => f.startsWith('ep') && f.endsWith('.mdx') && !excludeFiles.includes(f));

  let modifiedCount = 0;
  let logLines = [];

  for (const file of targetFiles) {
    const filePath = path.join(settingsDir, file);
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Count occurrences of 『
    const matches = content.match(/『/g);
    const count = matches ? matches.length : 0;

    if (count >= 1) {
      // Remove all 『 and 』
      const newContent = content.replace(/『/g, '').replace(/』/g, '');
      
      if (newContent !== content) {
        await fs.writeFile(filePath, newContent, 'utf-8');
        logLines.push(`[Modified] ${file} - Removed ${count} occurrences of 『』`);
        modifiedCount++;
      }
    } else if (count === 1) {
      logLines.push(`[Skipped] ${file} - Only 1 occurrence found`);
    }
  }

  logLines.push(`\nOperation complete. Modified ${modifiedCount} files out of ${targetFiles.length} checked.`);
  const logOutput = logLines.join('\n');
  await fs.writeFile(path.join(process.cwd(), 'remove_brackets_summary.txt'), logOutput, 'utf-8');
  console.log(logOutput);
}

main().catch(console.error);
