/* trim_ai_words_v3.js */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsDir = path.join(__dirname, 'public', 'settings');

// Safe removal patterns
const removePatterns = [
    // Fluff adverbs overused by AI
    { regex: /完全には?/g, replace: '' },
    { regex: /まるで/g, replace: '' },
    { regex: /静かに/g, replace: '' },
    { regex: /ゆっくり(?:と)?/g, replace: '' },
    { regex: /思わず/g, replace: '' },
    { regex: /無意識に/g, replace: '' },
    { regex: /ひどく/g, replace: '' },

    // "ふと" specifically avoiding "ふとした"
    { regex: /(?<![あ-んア-ン])ふと(?![し])/g, replace: '' },

    // "少しだけ" "ほんの少し" -> "少し"
    { regex: /少しだけ/g, replace: '少し' },
    { regex: /ほんの少し/g, replace: '少し' },
    
    // Simplify verbose compound words
    { regex: /得体の知れない/g, replace: '謎の' },
    { regex: /不可解な/g, replace: '謎の' },
    { regex: /名状しがたい/g, replace: '謎の' },
    { regex: /ような気がする/g, replace: '気がする' },

    // Simplify verbose endings gracefully
    { regex: /るのだ([。、])/g, replace: 'る$1' },
    { regex: /るのだ$/gm, replace: 'る' },
    { regex: /たのだ([。、])/g, replace: 'た$1' },
    { regex: /たのだ$/gm, replace: 'た' },
    { regex: /ているのだ([。、])/g, replace: 'ている$1' },
    { regex: /ているのだ$/gm, replace: 'ている' },

    // Cleanup artifacts from adverb removal
    { regex: /間違いなく/g, replace: '' },
    
    // Commas and punctuation cleanup
    { regex: /、\s*、+/g, replace: '、' },     // Double commas
    { regex: /。\s*、/g, replace: '。' },      // Comma after period
    { regex: /、\s*。/g, replace: '。' },      // Period after comma
    { regex: /「、/g, replace: '「' },        // Comma inside quote start
    { regex: /、」/g, replace: '」' },        // Comma inside quote end
    { regex: /『、/g, replace: '『' },        // Comma inside bracket start
    { regex: /、』/g, replace: '』' },        // Comma inside bracket end
    { regex: /（、/g, replace: '（' },        // Comma inside paren start
    { regex: /、）/g, replace: '）' },        // Comma inside paren end
    { regex: /^\s*、/gm, replace: '' },       // Comma at start of line
    { regex: /。\s*。/g, replace: '。' },      // Double periods
    { regex: /？\s*、/g, replace: '？' },      // Comma after question mark
    { regex: /！\s*、/g, replace: '！' },      // Comma after exclamation mark
];

let totalSavedChars = 0;

fs.readdir(settingsDir, (err, files) => {
    if (err) throw err;

    files.filter(f => f.endsWith('.mdx')).forEach(file => {
        const filePath = path.join(settingsDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        const originalLength = content.length;

        // Apply patterns sequentially
        removePatterns.forEach(({ regex, replace }) => {
            content = content.replace(regex, replace);
        });

        const newLength = content.length;
        if (originalLength !== newLength) {
            totalSavedChars += (originalLength - newLength);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated ${file}: Saved ${originalLength - newLength} characters.`);
        }
    });

    console.log(`\nAll done. Total characters saved in v3 pass: ${totalSavedChars}.`);
    
    fs.writeFileSync(path.join(__dirname, 'trim_results.txt'), 
        `Pass 3: Saved ${totalSavedChars} characters.\n\n`, 
        { flag: 'a' }
    );
});
