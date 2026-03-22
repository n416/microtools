import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsDir = path.join(__dirname, '../public/settings');

const safeReductions = [
    { regex: /なんとか/g, replace: '' },
    { regex: /ふとした(瞬間に?|時)/g, replace: '$1' },
    { regex: /少し(だけ)?/g, replace: '' },
    { regex: /そのまま/g, replace: '' },
    { regex: /さっき(の)?/g, replace: '' },
    { regex: /小さく/g, replace: '' },
    { regex: /自身の/g, replace: '' },
    { regex: /彼の/g, replace: '' },
    { regex: /彼女の/g, replace: '' },
    { regex: /どうやら/g, replace: '' },
    { regex: /おそらく/g, replace: '' },
    { regex: /わざわざ/g, replace: '' },
    { regex: /なんとなく/g, replace: '' },
    { regex: /再び/g, replace: 'また' },
    { regex: /なぜか/g, replace: '' },
    { regex: /完全に/g, replace: '' },
    { regex: /まるで/g, replace: '' },
    { regex: /ている/g, replace: 'てる' },
    { regex: /ことなど/g, replace: 'など' },
    { regex: /ことすら/g, replace: 'すら' },
    { regex: /について/g, replace: 'に' },
    { regex: /からこそ/g, replace: 'から' },
    { regex: /となって(い)?る/g, replace: 'となってる' },
    { regex: /である/g, replace: 'だ' },
    { regex: /てある/g, replace: 'たる' },
    { regex: /ておく/g, replace: 'とく' },
    { regex: /文字通り/g, replace: '' }
];

fs.readdirSync(settingsDir).filter(f => f.endsWith('.mdx')).forEach(file => {
    const filePath = path.join(settingsDir, file);
    let original = fs.readFileSync(filePath, 'utf8');
    let mod = original;
    for (let r of safeReductions) {
        mod = mod.replace(r.regex, r.replace);
    }
    if (original !== mod) {
        fs.writeFileSync(filePath, mod, 'utf8');
        console.log(`Updated ${file}`);
    }
});
