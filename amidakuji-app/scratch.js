const fs = require('fs');
const files = ['public/js/ui.js', 'public/js/tutorial/tutorialManager.js', 'public/js/main.js', 'public/js/components/eventEdit.js'];
files.forEach(f => {
  const text = fs.readFileSync(f, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('showCustomConfirm')) {
      console.log(`[${f}] Line ${i+1}: ${lines[i]}`);
    }
  }
});
