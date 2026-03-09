import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function publishPlugin() {
  return {
    name: 'vite-plugin-publish',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // SPA routing fallback for admin page
        if (req.url === '/admin' || req.url === '/admin/') {
          req.url = '/admin.html';
          next();
          return;
        }

        if (req.url === '/api/publish' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
             try {
               const { filename, platform, dryRun } = JSON.parse(body);

               if (!filename) {
                 res.statusCode = 400;
                 res.end(JSON.stringify({ error: 'filename (e.g. ep1.mdx) is required' }));
                 return;
               }

               const targetPlatform = platform || 'all';
               const scriptPath = path.resolve(__dirname, 'publish.js');
               const args = [scriptPath, filename, targetPlatform];
               if (dryRun) {
                  args.push('--dry-run');
               }

               console.log(`[Publish API] Starting publish.js for: ${filename} (Platform: ${targetPlatform}, DryRun: ${!!dryRun})`);
               
               // Viteサーバーをブロックしないよう非同期実行。
               const child = spawn('node', args);

               let stdout = '';
               let stderr = '';

               child.stdout.on('data', (data) => {
                 stdout += data.toString();
                 console.log(`[Publish API] stdout: ${data}`);
               });

               child.stderr.on('data', (data) => {
                 stderr += data.toString();
                 console.error(`[Publish API] stderr: ${data}`);
               });

               child.on('close', (code) => {
                 if (code !== 0) {
                   console.error(`[Publish API] Error: process exited with code ${code}`, stderr);
                   res.statusCode = 500;
                   res.end(JSON.stringify({ error: stderr || error.message, output: stdout }));
                   return;
                 }
                 console.log(`[Publish API] Success for ${filename}`);
                 res.statusCode = 200;
                 res.end(JSON.stringify({ success: true, output: stdout }));
               });
             } catch (err) {
               res.statusCode = 400;
               res.end(JSON.stringify({ error: 'Invalid JSON' }));
             }
          });
        } else {
          next();
        }
      });
    }
  };
}
