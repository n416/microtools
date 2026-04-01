import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isNoTerms = process.argv.includes('--no-terms');
const isSimpleTerms = process.argv.includes('--simple-terms');
const isRubyTerms = process.argv.includes('--ruby-terms');
const isRubyP2Terms = process.argv.includes('--ruby-p2-terms');

let inputFilename = 'output_novel.docx';

if (isNoTerms) {
    inputFilename = 'output_novel_noterms.docx';
} else if (isSimpleTerms) {
    inputFilename = 'output_novel_simple.docx';
} else if (isRubyTerms) {
    inputFilename = 'output_novel_ruby.docx';
} else if (isRubyP2Terms) {
    inputFilename = 'output_novel_ruby_p2.docx';
}

const targetDocx = path.resolve(__dirname, '../' + inputFilename);
const psScript = path.resolve(__dirname, 'remove_empty_lines_docx.ps1');

if (!fs.existsSync(targetDocx)) {
    console.error(`Error: target DOCX not found: ${targetDocx}`);
    process.exit(1);
}

// 既存の WINWORD.EXE の PID を記録
let prePids = new Set();
try {
    const stdout = execSync('tasklist /FI "IMAGENAME eq WINWORD.EXE" /NH /FO CSV', { encoding: 'utf8' });
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
        if (line.includes('WINWORD.EXE')) {
            const parts = line.split('","');
            if (parts.length > 1) {
                const pid = parts[1].replace(/["\s]/g, '');
                if (pid) prePids.add(pid);
            }
        }
    }
} catch (e) {
    // 起動していない場合はエラーになることがあるが無視
}

function cleanupZombies() {
    try {
        const stdout = execSync('tasklist /FI "IMAGENAME eq WINWORD.EXE" /NH /FO CSV', { encoding: 'utf8' });
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
            if (line.includes('WINWORD.EXE')) {
                const parts = line.split('","');
                if (parts.length > 1) {
                    const pid = parts[1].replace(/["\s]/g, '');
                    if (pid && !prePids.has(pid)) {
                        console.log(`[postprocess_docx] Cleaning up orphaned WINWORD process (PID: ${pid})`);
                        try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' }); } catch (e) {}
                    }
                }
            }
        }
    } catch (e) {}
}

// 強制終了時のハンドリング
['SIGINT', 'SIGTERM', 'uncaughtException'].forEach((sig) => {
    process.on(sig, () => {
        cleanupZombies();
        process.exit(1);
    });
});

let usePsScript = true;
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^(?:VITE_)?USE_PSSCRIPT\s*=\s*(false|0)/mi);
    if (match) {
        usePsScript = false;
    }
}

if (!usePsScript) {
    console.log(`\n[postprocess_docx] USE_PSSCRIPT is disabled in .env. Skipping PowerShell Word COM automation.`);
} else {
    console.log(`\n[postprocess_docx] Waiting for file locks to clear...`);
    try {
        execSync('timeout /t 2 /nobreak >nul 2>&1', { stdio: 'ignore' });
    } catch (e) {}

    console.log(`[postprocess_docx] Word COM automation started for: ${inputFilename}`);

    try {
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScript}" -DocPath "${targetDocx}"`;
        // Timeout added to prevent infinite invisible dialog freezes (300 seconds / 5 minutes)
        execSync(command, { encoding: 'utf8', stdio: 'inherit', timeout: 300000 });
        console.log(`[postprocess_docx] Completed empty line removal successfully.\n`);
        
        console.log(`[postprocess_docx] All tasks completed successfully.\n`);
    } catch (error) {
        console.error(`[postprocess_docx] Error executing PowerShell script:`, error.message);
        process.exitCode = 1;
    } finally {
        cleanupZombies();
    }
}
