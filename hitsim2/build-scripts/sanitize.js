import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.join(rootDir, 'Icons');
const publicDir = path.join(rootDir, '.generated');
const publicIconsDir = path.join(publicDir, 'Icons');

const dataFiles = ['itemdata.json', 'setdata.json', 'stat_rates.json', 'enhancement_data.json'];

if (fs.existsSync(publicIconsDir)) {
    fs.rmSync(publicIconsDir, { recursive: true, force: true });
}
fs.mkdirSync(publicIconsDir, { recursive: true });

function sanitizeString(str) {
    if (!str) return '';
    // Always hash the string to obfuscate original file names and IDs
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 16);
}

async function run() {
    console.log('Starting sanitize script...');

    const itemDataPath = path.join(rootDir, 'itemdata.json');
    if (!fs.existsSync(itemDataPath)) {
        console.error('itemdata.json not found!');
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(itemDataPath, 'utf8'));
    const iconMap = new Map();

    for (const item of data) {
        if (item.Id) {
            item.Id = sanitizeString(item.Id);
        }
        if (item.Icon) {
            const originalIcon = item.Icon;
            const sanitizedIcon = sanitizeString(originalIcon);
            item.Icon = sanitizedIcon;

            if (!iconMap.has(originalIcon)) {
                iconMap.set(originalIcon, sanitizedIcon);
            }
        }
    }

    fs.writeFileSync(path.join(publicDir, 'itemdata.json'), JSON.stringify(data));
    console.log(`Saved sanitized itemdata.json to public dir.`);

    let successCount = 0;
    let failCount = 0;
    
    for (const [originalIcon, sanitizedIcon] of iconMap.entries()) {
        const srcPath = path.join(iconsDir, `${originalIcon}.png`);
        const destPath = path.join(publicIconsDir, `${sanitizedIcon}.png`);

        if (fs.existsSync(srcPath)) {
            try {
                // Resize to max 128x128 and compress PNG
                await sharp(srcPath)
                    .resize(128, 128, { fit: 'inside', withoutEnlargement: true })
                    .png({ quality: 80, compressionLevel: 9 })
                    .toFile(destPath);
                successCount++;
            } catch (e) {
                console.error(`Error processing image ${srcPath}:`, e);
                failCount++;
            }
        } else {
            // Some items might share the same missing icon, or JSON has items with no valid icon file
            // We just warn it once per missing icon
            failCount++;
        }
    }
    console.log(`Finished processing icons. Success: ${successCount}, Fail: ${failCount}`);

    // Copy other JSON files
    for (const file of dataFiles) {
        if (file === 'itemdata.json') continue;
        const srcPath = path.join(rootDir, file);
        const destPath = path.join(publicDir, file);
        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied ${file} to public dir.`);
        }
    }
}

run().catch(console.error);
