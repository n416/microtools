import fs from 'fs';
import path from 'path';

// 完全なファイル順序
const sequence = [
  'prologue1', 'prologue2', 'prologue3',
  'ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep5_5', 'ep6', 
  'ep7_1', 'ep7_2', 'ep7_3', 'ep8', 
  'ep9_0', 'ep9_1', 'ep9_2',
  'ep10_0', 'ep10_1', 'ep10_2', 'ep10_3', 'ep10_4', 'ep10_5', 'ep10_6', 'ep10_7',
  'ep11', 'ep11_1', 'ep11_2',
  'ep12', 'ep12_5', 'ep13_0', 'ep13_0_5', 
  'lore_lin_hidden',
  'ep13_0_6', 'ep13_1', 
  'ep14', 'ep14_5', 'ep15',
  'ep16_1', 'ep16_2', 'ep16_3', 'ep16_4', 
  'ep17', 
  'lore_kurosu_hidden',
  'ep18', 'ep19'
];

const targetDir = path.resolve('./public/settings');

// helper function
function getTitle(filename) {
    const p = path.join(targetDir, filename + '.mdx');
    if (!fs.existsSync(p)) return '次へ進む';
    const lines = fs.readFileSync(p, 'utf-8').split('\n');
    for (const l of lines) {
        if (l.startsWith('# ')) {
            // Remove '# '
            let title = l.replace('# ', '').trim();
            // ":" や "：" で分割し、後半（サブタイトル部分）を取得する
            if (title.includes('：')) {
                 title = title.split('：')[1].trim(); 
            } else if (title.includes(':')) {
                 title = title.split(':')[1].trim(); 
            }
            // タイトルが長すぎる場合などは「次話へ進む」等のフォールバックもあり得るがここではサブタイトル利用
            return title + ' へ進む';
        }
    }
    return '次へ進む';
}

let logs = [];
for (let i = 0; i < sequence.length - 1; i++) {
    const current = sequence[i];
    const next = sequence[i + 1];
    
    // We only process from ep6 onward
    // ep6 index is 9
    if (i < 9) continue;
    
    const p = path.join(targetDir, current + '.mdx');
    if (fs.existsSync(p)) {
        let content = fs.readFileSync(p, 'utf-8');
        let nextTitle = getTitle(next);
        
        const regex = /<button class="btn-normal-next" data-next="[^"]*">.*?<\/button>/;
        if (regex.test(content)) {
            const newButton = `<button class="btn-normal-next" data-next="${next}">${nextTitle}</button>`;
            content = content.replace(regex, newButton);
            fs.writeFileSync(p, content, 'utf-8');
            logs.push(`Updated ${current}.mdx -> ${next}`);
        } else {
            logs.push(`WARN: No button found in ${current}.mdx`);
        }
    }
}
fs.writeFileSync('scripts/fix_links_log.txt', logs.join('\n'));
