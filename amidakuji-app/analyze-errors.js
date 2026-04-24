const { execSync } = require('child_process');
const fs = require('fs');

try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('Success!');
} catch (error) {
  const output = error.stdout.toString();
  const eventsErrors = output.split('\n').filter(l => l.includes('src/routes/events.ts'));
  const linesToFix = new Set();
  
  eventsErrors.forEach(err => {
    const match = err.match(/events\.ts\((\d+),/);
    if (match) linesToFix.add(parseInt(match[1]));
  });
  
  const content = fs.readFileSync('src/routes/events.ts', 'utf8').split('\n');
  console.log(`Found ${linesToFix.size} error lines in events.ts`);
  
  let count = 0;
  for (let lineNum of [...linesToFix].sort((a,b)=>a-b)) {
    if (count++ >= 20) break;
    console.log(`\n--- Line ${lineNum} ---`);
    console.log(`${lineNum-1}: ${content[lineNum-2]}`);
    console.log(`${lineNum}: ${content[lineNum-1]}`);
    console.log(`${lineNum+1}: ${content[lineNum]}`);
  }
}
