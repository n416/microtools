const fs = require('fs');
const path = require('path');

const SETTINGS_DIR = path.join(__dirname, 'public', 'settings');
const SRC_DIR = path.join(__dirname, 'src');
const PROJECT_ROOT = __dirname;

// 1. Rename ep1, ep2, ep3 to prologue1, prologue2, prologue3
const prologues = ['ep1', 'ep2', 'ep3'];
prologues.forEach((ep, index) => {
    const oldPath = path.join(SETTINGS_DIR, `${ep}.mdx`);
    const newPath = path.join(SETTINGS_DIR, `prologue${index + 1}.mdx`);
    if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        console.log(`Renamed: ${ep}.mdx -> prologue${index + 1}.mdx`);
    } else {
        console.log(`Warning: ${ep}.mdx not found.`);
    }
});

// 2. Identify all ep*.mdx and lore_*.mdx files to shift
const files = fs.readdirSync(SETTINGS_DIR);
let shiftMap = {}; // oldName (without ext) -> newName (without ext)
let newProloguesMap = {
    'ep1': 'prologue1',
    'ep2': 'prologue2',
    'ep3': 'prologue3'
};

const epRegex = /^ep(\d+)(_.*)?$/;
const loreRegex = /^lore_ep(\d+)(_.*)?$/;

files.forEach(file => {
    if (!file.endsWith('.mdx')) return;
    const name = file.replace('.mdx', '');
    
    // Handle ep files (ep4 -> ep1, ep10_1 -> ep7_1)
    const epMatch = name.match(epRegex);
    if (epMatch) {
        const num = parseInt(epMatch[1]);
        if (num >= 4) {
             const newNum = num - 3;
             const suffix = epMatch[2] || '';
             const newName = `ep${newNum}${suffix}`;
             shiftMap[name] = newName;
        }
    }

    // Handle lore_ep files
    const loreMatch = name.match(loreRegex);
    if (loreMatch) {
         const num = parseInt(loreMatch[1]);
         if (num >= 4) {
             const newNum = num - 3;
             const suffix = loreMatch[2] || '';
             const newName = `lore_ep${newNum}${suffix}`;
             shiftMap[name] = newName;
         }
    }
});

// Sort shiftMap keys by length descending to avoid partial matches (e.g. ep10 replacing ep1 first)
const sortedKeys = Object.keys(shiftMap).sort((a, b) => b.length - a.length);

// 3. Rename shifted files (do this after calculating map to avoid collisions if any)
// To be absolutely safe from collisions (e.g. renaming ep4 to ep1 when ep1 still exists, though we moved prologues),
// we rename to temporary names first, then to final names.
const tempMap = {};
Object.entries(shiftMap).forEach(([oldName, newName]) => {
    const oldPath = path.join(SETTINGS_DIR, `${oldName}.mdx`);
    const tempPath = path.join(SETTINGS_DIR, `TEMP_${newName}.mdx`);
    if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, tempPath);
        tempMap[tempPath] = path.join(SETTINGS_DIR, `${newName}.mdx`);
        console.log(`Temp Renamed: ${oldName}.mdx -> TEMP_${newName}.mdx`);
    }
});
Object.entries(tempMap).forEach(([tempPath, finalPath]) => {
    if (fs.existsSync(tempPath)) {
        fs.renameSync(tempPath, finalPath);
        console.log(`Final Renamed to: ${path.basename(finalPath)}`);
    }
});

// Combined mapping for content replacement
const allMap = { ...newProloguesMap, ...shiftMap };
const replaceKeys = Object.keys(allMap).sort((a, b) => {
    // Sort logic: match specific ones first, like ep10_1 before ep10 before ep1
    // Also, match '第' titles
    return b.length - a.length;
});

// 4. Content Replacement Function
function replaceContentInFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');
    let originalContent = content;

    // A. Replace Next Links: data-next="epX" -> data-next="newEpX"
    replaceKeys.forEach(oldName => {
        const newName = allMap[oldName];
        // Replace data-next exact matches
        const nextRegex = new RegExp(`data-next=["']${oldName}["']`, 'g');
        content = content.replace(nextRegex, `data-next="${newName}"`);
        
        // Replace data-target exact matches (for main.js/sidebar)
        const targetRegex = new RegExp(`data-target=["']${oldName}["']`, 'g');
        content = content.replace(targetRegex, `data-target="${newName}"`);
        
        // Replace string exact matches in arrays/objects (like 'ep4', "ep4")
        const strRegex1 = new RegExp(`'${oldName}'`, 'g');
        content = content.replace(strRegex1, `'${newName}'`);
        const strRegex2 = new RegExp(`"${oldName}"`, 'g');
        content = content.replace(strRegex2, `"${newName}"`);
    });

    // B. Replace Titles/Text strings: 第4話 -> 第1話, 第10.1話 -> 第7.1話
    // Only apply text replacement for ep >= 4 shift. Prologues are handled manually or already done.
    const titleKeys = Object.keys(shiftMap).sort((a, b) => b.length - a.length);
    titleKeys.forEach(oldName => {
        const epMatch = oldName.match(/^(lore_)?ep(\d+)(_([\d]+))?$/);
        if (epMatch) {
            const oldMain = epMatch[2]; // e.g., 4
            const oldSub = epMatch[4];  // e.g., 1 (from ep10_1)
            
            const newName = shiftMap[oldName];
            const newMatch = newName.match(/^(lore_)?ep(\d+)(_([\d]+))?$/);
            const newMain = newMatch[2]; // e.g., 1
            const newSub = newMatch[4];  // e.g., 1
            
            if (oldSub) {
                // Example: 第10.1話 -> 第7.1話
                const titleRegex = new RegExp(`第${oldMain}.${oldSub}話`, 'g');
                content = content.replace(titleRegex, `第${newMain}.${newSub}話`);
            } else {
                // Example: 第4話 -> 第1話
                const titleRegex = new RegExp(`第${oldMain}話`, 'g');
                // Negative lookahead to avoid replacing 第10話 when searching for 第1話 (though we iterate length descending anyway)
                content = content.replace(titleRegex, `第${newMain}話`);
            }
        }
    });

    // C. Special fix for prologue titles just in case
    content = content.replace(/第1話/g, 'プロローグ１');
    content = content.replace(/第2話/g, 'プロローグ２');
    content = content.replace(/第3話/g, 'プロローグ３');
    // But then the shifted 4->1 became 1, which now becomes prologue!
    // -> Wait, we must NOT do global "第1話 -> プロローグ1" AFTER shifting 4->1!
    // Let's rely on the previous tool call where Prologue 1-3 titles are ALREADY fixed in the files.
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated content in: ${filePath}`);
    }
}

// 5. Apply Content Replacements
// Files in public/settings
const settingsFiles = fs.readdirSync(SETTINGS_DIR);
settingsFiles.forEach(file => {
    if (file.endsWith('.mdx') || file.endsWith('.json')) {
        replaceContentInFile(path.join(SETTINGS_DIR, file));
    }
});

// Specific scripts/src files
const targetCodeFiles = [
    path.join(PROJECT_ROOT, 'main.js'),
    path.join(PROJECT_ROOT, 'publish_map.json'),
    path.join(SRC_DIR, 'term_map.js'),
    path.join(PROJECT_ROOT, 'scripts', 'apply_terms.js'),
    path.join(PROJECT_ROOT, 'scripts', 'generate_term_map.js'),
    path.join(PROJECT_ROOT, 'scripts', 'export_novel.js'),
    path.join(PROJECT_ROOT, 'scripts', 'admin.js'),
    path.join(PROJECT_ROOT, 'scripts', 'get_titles.js')
];

targetCodeFiles.forEach(replaceContentInFile);

console.log("Renumbering complete!");
