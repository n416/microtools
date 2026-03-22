import fs from 'fs';
import { execSync } from 'child_process';
try {
  let out = execSync('node scripts/export_novel.js --ruby-p2-terms', { encoding: 'utf-8' });
  fs.writeFileSync('test_export_log.txt', out);
} catch (e) {
  fs.writeFileSync('test_export_log.txt', 'ERROR:\n' + e.stdout + '\n' + e.stderr + '\n' + e.message);
}
