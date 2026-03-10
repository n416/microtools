import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

        // --- Raw File API (Editor) ---
        if (req.url.startsWith('/api/raw')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          let filename = urlObj.searchParams.get('file');

          if (req.method === 'GET') {
            try {
              if (!filename || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Invalid or missing file parameter' }));
                  return;
              }
              const filePath = path.resolve(__dirname, '../public/settings', filename);
              if (!filePath.startsWith(path.resolve(__dirname, '../public/settings'))) {
                  res.statusCode = 403;
                  res.end(JSON.stringify({ error: 'Forbidden' }));
                  return;
              }

              if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                res.statusCode = 200;
                res.end(JSON.stringify({ content }));
              } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'File not found' }));
              }
            } catch(e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
            return;
          } else if (req.method === 'POST') {
             let body = '';
             req.on('data', chunk => { body += chunk.toString(); });
             req.on('end', () => {
               try {
                 const { file, content } = JSON.parse(body);
                 if (!file || !/^[a-zA-Z0-9_.-]+$/.test(file)) {
                     res.statusCode = 400;
                     res.end(JSON.stringify({ error: 'Invalid filename' }));
                     return;
                 }
                 const filePath = path.resolve(__dirname, '../public/settings', file);
                 if (!filePath.startsWith(path.resolve(__dirname, '../public/settings'))) {
                     res.statusCode = 403;
                     res.end(JSON.stringify({ error: 'Forbidden' }));
                     return;
                 }
                 
                 fs.writeFileSync(filePath, content || '', 'utf8');
                 res.statusCode = 200;
                 res.end(JSON.stringify({ success: true }));
               } catch(e) {
                 res.statusCode = 500;
                 res.end(JSON.stringify({ error: e.message }));
               }
             });
             return;
          }
        }

        // --- あらすじ (Synopsis) API ---
        if (req.url === '/api/synopsis') {
          const synopsisPath = path.resolve(__dirname, '../public/settings/synopsis.txt');
          
          if (req.method === 'GET') {
            try {
              if (fs.existsSync(synopsisPath)) {
                const text = fs.readFileSync(synopsisPath, 'utf8');
                res.statusCode = 200;
                res.end(JSON.stringify({ text }));
              } else {
                res.statusCode = 200;
                res.end(JSON.stringify({ text: '' }));
              }
            } catch(e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
            return;
          } else if (req.method === 'POST') {
             let body = '';
             req.on('data', chunk => { body += chunk.toString(); });
             req.on('end', () => {
               try {
                 const { text } = JSON.parse(body);
                 fs.writeFileSync(synopsisPath, text || '', 'utf8');
                 res.statusCode = 200;
                 res.end(JSON.stringify({ success: true }));
               } catch(e) {
                 res.statusCode = 500;
                 res.end(JSON.stringify({ error: e.message }));
               }
             });
             return;
          }
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
