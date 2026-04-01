try {
  const fs = require('fs');
  const path = require('path');

  const targetDir = 'c:\\Users\\shingo\\Desktop\\microtools\\yomimono2\\public\\settings';
  const files = ['yomikiri.mdx', 'world.mdx', 'character.mdx', 'plot.mdx'];

  function formatMdx(content) {
    const lines = content.split('\n');
    const newLines = [];

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];
      const prevLine = i > 0 ? lines[i - 1] : null;

      if (prevLine !== null && prevLine.trim() !== '' && currentLine.trim() !== '') {
        const isPrevList = /^\\s*[-*]\\s/.test(prevLine);
        const isCurrentList = /^\\s*[-*]\\s/.test(currentLine);
        const isPrevHeading = /^\\s*#+\\s/.test(prevLine);
        const isCurrentHeading = /^\\s*#+\\s/.test(currentLine);

        let shouldInsertEmptyLine = true;
        if (isPrevList && isCurrentList) {
          shouldInsertEmptyLine = false;
        }

        if (shouldInsertEmptyLine) {
          newLines.push('');
        }
      }
      newLines.push(currentLine);
    }
    return newLines.join('\n');
  }

  files.forEach(file => {
    const filePath = path.join(targetDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const normalizedContent = content.replace(/\u000d\u000a/g, '\n');
      const formattedContent = formatMdx(normalizedContent);
      fs.writeFileSync(filePath, formattedContent, 'utf8');
      console.log(`Formatted ${file}`);
    } else {
      console.log(`File not found: ${file}`);
    }
  });
} catch (e) {
  console.error(e.toString());
  process.exit(1);
}
