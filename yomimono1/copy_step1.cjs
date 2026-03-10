const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'settings');

console.log("Starting copy script (.cjs)...");
try {
    const copyMap = {
        'ep4.mdx': 'ep1.mdx',
        'ep5.mdx': 'ep2.mdx',
        'ep6.mdx': 'ep3.mdx',
        'ep7.mdx': 'ep4.mdx',
        'ep8.mdx': 'ep5.mdx',
        'ep8_5.mdx': 'ep5_5.mdx',
        'ep9.mdx': 'ep6.mdx',
        'ep10_1.mdx': 'ep7_1.mdx',
        'ep10_2.mdx': 'ep7_2.mdx',
        'ep10_3.mdx': 'ep7_3.mdx',
        'ep11.mdx': 'ep8.mdx',
        'ep12_0.mdx': 'ep9_0.mdx',
        'ep12_1.mdx': 'ep9_1.mdx',
        'ep12_2.mdx': 'ep9_2.mdx',
        'ep13_0.mdx': 'ep10_0.mdx',
        'ep13_1.mdx': 'ep10_1.mdx',
        'ep13_2.mdx': 'ep10_2.mdx',
        'ep13_3.mdx': 'ep10_3.mdx',
        'ep13_4.mdx': 'ep10_4.mdx',
        'ep13_5.mdx': 'ep10_5.mdx',
        'ep13_6.mdx': 'ep10_6.mdx',
        'ep13_7.mdx': 'ep10_7.mdx',
        'ep14.mdx': 'ep11.mdx',
        'ep14_1.mdx': 'ep11_1.mdx',
        'ep14_2.mdx': 'ep11_2.mdx',
        'ep15.mdx': 'ep12.mdx',
        'ep15_5.mdx': 'ep12_5.mdx',
        'ep16_0.mdx': 'ep13_0.mdx',
        'ep16_0_5.mdx': 'ep13_0_5.mdx',
        'ep16_0_6.mdx': 'ep13_0_6.mdx',
        'ep16_1.mdx': 'ep13_1.mdx',
        'ep17.mdx': 'ep14.mdx',
        'ep17_5.mdx': 'ep14_5.mdx',
        'ep18.mdx': 'ep15.mdx',
        'ep19_1.mdx': 'ep16_1.mdx',
        'ep19_2.mdx': 'ep16_2.mdx',
        'ep19_3.mdx': 'ep16_3.mdx',
        'ep19_4.mdx': 'ep16_4.mdx',
        'ep20.mdx': 'ep17.mdx',
        'ep21.mdx': 'ep18.mdx',
        'ep22.mdx': 'ep19.mdx'
    };

    let copied = 0;
    for (const [oldName, newName] of Object.entries(copyMap)) {
        const oldPath = path.join(dir, oldName);
        const newPath = path.join(dir, newName);
        if (fs.existsSync(oldPath)) {
            const content = fs.readFileSync(oldPath);
            fs.writeFileSync(newPath, content);
            console.log(`Copied: ${oldName} -> ${newName}`);
            copied++;
        }
    }
    console.log(`Successfully copied ${copied} files!`);
} catch (e) {
    fs.writeFileSync('copy_error.txt', String(e));
}
