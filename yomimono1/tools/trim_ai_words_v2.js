import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directoryPath = path.join(__dirname, 'public', 'settings');
const mdxFiles = fs.readdirSync(directoryPath).filter(file => file.endsWith('.mdx') && file.startsWith('ep'));

let totalSaved = 0;
let logOutput = "";

const replacements = [
    // Previous passes (already applied to most but keep them for completeness)
    { regex: /静かに(頷|息|笑|微笑|立ち上が|目を閉|受け入れ|見つめ|声|歩)/g, replace: '$1' },
    { regex: /ゆっくりと(顔|立ち上|歩|振り返|手|息|目)/g, replace: '$1' },
    { regex: /(?<!あと|もう|ほんの)少しだけ/g, replace: '' },
    { regex: /(?<!あと|もう|ほんの)少し(?!の)/g, replace: '' },
    { regex: /ふと、?/g, replace: '' },
    { regex: /思わず(息|声|苦笑|笑|後ずさ|立ち止ま|吹き出|目)/g, replace: '$1' },
    { regex: /苦笑い?し(ながら|て)/g, replace: '笑い$1' },
    { regex: /小さく(頷|息|笑|微笑|呟|首|ため息|声を)/g, replace: '$1' },
    { regex: /そっと(手|目|触|視線|息|肩)/g, replace: '$1' },
    { regex: /無意識に/g, replace: '' },
    { regex: /完全に/g, replace: '' },
    { regex: /どこか(寂し|悲し|懐かし|冷た|不気味|違和感|遠|誇ら)/g, replace: '$1' },
    { regex: /確かな(重み|感触|記憶|熱|証拠|意志|手応え|痛み)/g, replace: '$1' },
    { regex: /まるで(.*?)のよう(に|な|だ)/g, replace: '$1のよう$2' },
    { regex: /信じられない/g, replace: '' },
    { regex: /静かな(怒り|声|目|息)/g, replace: '$1' },
    { regex: /明らかな/g, replace: '' },
    
    // Pass 2: Redundant grammar and explanatory phrase trimming
    { regex: /(る|た|いる|した|ない|れる|られる|せる|させる)(の|ん)(だ|だった|である)(。|、)/g, replace: '$1$4' }, // e.g., 走るのだ。 -> 走る。
    { regex: /という事実が、?/g, replace: '事実が' },
    { regex: /という(感覚|気持ち|違和感|錯覚|恐怖)/g, replace: 'の$1' },
    { regex: /ような(気|感覚|錯覚)(がした|がする|に陥る|になる)/g, replace: '$1$2' }, // ような気がした -> 気がした
    { regex: /得体の知れない/g, replace: '謎の' },
    { regex: /不思議な/g, replace: '妙な' },
    { regex: /ひどい(違和感|疲労感|頭痛|気持ち悪さ|嫌悪感|焦燥感)/g, replace: '強い$1' },
    { regex: /名状しがたい/g, replace: '謎の' },
    { regex: /決定的な/g, replace: '' },
    { regex: /圧倒的な/g, replace: '' },
    { regex: /絶対的な/g, replace: '' },
    { regex: /理不尽な/g, replace: '' },
    { regex: /不可解な/g, replace: '謎の' },
    { regex: /極めて/g, replace: '' },
    { regex: /異常なほど(の|に)/g, replace: '' },
    { regex: /ひどく/g, replace: '' },
    { regex: /ただの/g, replace: '' },
    { regex: /まさに(.*?)そのもの/g, replace: '$1' }, // まさに地獄そのもの -> 地獄
    { regex: /どう考えても/g, replace: '' },
    { regex: /文字通り(の|に)?/g, replace: '' },
    { regex: /間違いなく/g, replace: '' },
    { regex: /紛れもなく/g, replace: '' }
];

mdxFiles.forEach(file => {
    const filePath = path.join(directoryPath, file);
    const originalContent = fs.readFileSync(filePath, 'utf8');
    let newContent = originalContent;

    replacements.forEach(({ regex, replace }) => {
        newContent = newContent.replace(regex, replace);
    });

    // Fix grammar issues caused by blind replacements
    newContent = newContent.replace(/、、/g, '、');
    newContent = newContent.replace(/、。/g, '。');
    newContent = newContent.replace(/「、/g, '「');
    newContent = newContent.replace(/\n、/g, '\n');
    newContent = newContent.replace(/。しかし、/g, '。しかし、'); 

    const diff = originalContent.length - newContent.length;
    if (diff !== 0) {
        totalSaved += diff;
        fs.writeFileSync(filePath, newContent, 'utf8');
        logOutput += `Updated ${file} - Saved ${diff} characters.\n`;
    }
});

logOutput += `Total additional characters saved: ${totalSaved}\n`;
fs.writeFileSync(path.join(__dirname, 'trim_results.txt'), logOutput, 'utf8');
