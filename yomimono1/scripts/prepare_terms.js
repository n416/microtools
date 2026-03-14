import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  console.log('[prepare_terms] Running apply_terms.js...');
  execSync('node scripts/apply_terms.js', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  console.log('[prepare_terms] Running generate_term_map.js...');
  execSync('node scripts/generate_term_map.js', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  console.log('[prepare_terms] Running generate_sidebar.js...');
  execSync('node scripts/generate_sidebar.js', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  console.error('[prepare_terms] Script execution failed.', error.message);
  process.exit(1);
}
