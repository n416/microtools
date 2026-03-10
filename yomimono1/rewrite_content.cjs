const fs = require('fs');
const path = require('path');

const SETTINGS_DIR = path.join(__dirname, 'public', 'settings');
const SRC_DIR = path.join(__dirname, 'src');
const PROJECT_ROOT = __dirname;

const shiftMap = {
    'ep4': 'ep1',
    'ep5': 'ep2',
    'ep6': 'ep3',
    'ep7': 'ep4',
    'ep8': 'ep5',
    'ep8_5': 'ep5_5',
    'ep9': 'ep6',
    'ep10_1': 'ep7_1',
    'ep10_2': 'ep7_2',
    'ep10_3': 'ep7_3',
    'ep11': 'ep8',
    'ep12_0': 'ep9_0',
    'ep12_1': 'ep9_1',
    'ep12_2': 'ep9_2',
    'ep13_0': 'ep10_0',
    'ep13_1': 'ep10_1',
    'ep13_2': 'ep10_2',
    'ep13_3': 'ep10_3',
    'ep13_4': 'ep10_4',
    'ep13_5': 'ep10_5',
    'ep13_6': 'ep10_6',
    'ep13_7': 'ep10_7',
    'ep14': 'ep11',
    'ep14_1': 'ep11_1',
    'ep14_2': 'ep11_2',
    'ep15': 'ep12',
    'ep15_5': 'ep12_5',
    'ep16_0': 'ep13_0',
    'ep16_0_5': 'ep13_0_5',
    'ep16_0_6': 'ep13_0_6',
    'ep16_1': 'ep13_1',
    'ep17': 'ep14',
    'ep17_5': 'ep14_5',
    'ep18': 'ep15',
    'ep19_1': 'ep16_1',
    'ep19_2': 'ep16_2',
    'ep19_3': 'ep16_3',
    'ep19_4': 'ep16_4',
    'ep20': 'ep17',
    'ep21': 'ep18',
    'ep22': 'ep19'
};

// Also map original prologues in case they appear as hard links
const allMap = {
    'ep1': 'prologue1',
    'ep2': 'prologue2',
    'ep3': 'prologue3',
    ...shiftMap
};

// Sort keys longest first to avoid partial replacements (like ep10 before ep1)
const replaceKeys = Object.keys(allMap).sort((a, b) => b.length - a.length);

function replaceContentInFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');
    let originalContent = content;

    // A. Replace specific internal string references like data-next="ep4" -> "ep1"
    replaceKeys.forEach(oldName => {
        const newName = allMap[oldName];
        
        // Match standard links
        content = content.replace(new RegExp(`data-next=["']${oldName}["']`, 'g'), `data-next="${newName}"`);
        content = content.replace(new RegExp(`data-target=["']${oldName}["']`, 'g'), `data-target="${newName}"`);
        
        // Exact strings in JS/JSON, avoiding sub-matches by expecting word boundaries or quotes.
        content = content.replace(new RegExp(`'${oldName}'`, 'g'), `'${newName}'`);
        content = content.replace(new RegExp(`"${oldName}"`, 'g'), `"${newName}"`);
        content = content.replace(new RegExp(`"${oldName}.mdx"`, 'g'), `"${newName}.mdx"`);
        content = content.replace(new RegExp(`'${oldName}.mdx'`, 'g'), `'${newName}.mdx'`);
    });

    // B. Replace Text Titles: 第4話 -> 第1話
    // We only shift text titles for ep4+. Prologues already hand-edited.
    const titleKeys = Object.keys(shiftMap).sort((a, b) => b.length - a.length);
    titleKeys.forEach(oldName => {
        const epMatch = oldName.match(/^ep(\d+)(_([\d]+))?$/);
        if (epMatch) {
            const oldMain = epMatch[1]; // e.g., 4
            const oldSub = epMatch[3];  // e.g., 1 (from ep10_1)
            
            const newName = shiftMap[oldName];
            const newMatch = newName.match(/^ep(\d+)(_([\d]+))?$/);
            const newMain = newMatch[1];
            const newSub = newMatch[3];
            
            if (oldSub) {
                // Example: 第10.1話 -> 第7.1話
                content = content.replace(new RegExp(`第${oldMain}.${oldSub}話`, 'g'), `第${newMain}.${newSub}話`);
                content = content.replace(new RegExp(`ep${oldMain}.${oldSub}`, 'g'), `ep${newMain}.${newSub}`); // for log markers
            } else {
                // Example: 第4話 -> 第1話
                content = content.replace(new RegExp(`第${oldMain}話`, 'g'), `第${newMain}話`);
                content = content.replace(new RegExp(`ep${oldMain}`, 'g'), `ep${newMain}`);
            }
        }
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated content: ${path.basename(filePath)}`);
    }
}

// Target files: only the newly copied ones in settings + global ones
try {
    const settingsFiles = fs.readdirSync(SETTINGS_DIR);
    settingsFiles.forEach(file => {
        // Skip prologue1, 2, 3 as we already hand-tuned them and don't want "ep1" being replaced inside prologue3 incorrectly by title rules.
        if (file.startsWith('prologue')) return;
        if (file.endsWith('.mdx') || file.endsWith('.json')) {
            replaceContentInFile(path.join(SETTINGS_DIR, file));
        }
    });

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

    console.log("Content replacement finished.");
} catch (e) {
    fs.writeFileSync('replace_error.txt', String(e));
}
