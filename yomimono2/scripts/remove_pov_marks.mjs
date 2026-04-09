import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.resolve(__dirname, '../public/settings');

const files = fs.readdirSync(targetDir)
    .filter(f => f.endsWith('.mdx') && (f.startsWith('ep') || f.startsWith('yomikiri')));

let totalReplaced = 0;

for (const file of files) {
    const filePath = path.join(targetDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    // 置換対象の正規表現設計
    // ^[ 　]*(＊　＊　＊|◆　◆　◆|◇　◇　◇)[ 　]*\n
    // (\s*\n)*
    // <!--\s*POV:
    // これは、行頭から「何らかの区切り記号」のみがあり、その後に任意個の空行があって、
    // 更に「<!-- POV:」が出現するパターンにマッチする。
    
    // 改行がLFかCRLFか混在している可能性があるので、\r?\nを使用。
    const regex = /^[ 　]*(?:[＊\*]　[＊\*]　[＊\*]|◆　◆　◆|◇　◇　◇)[ 　]*(?:\r?\n)+((?:[ 　]*(?:\r?\n))*)[ 　]*<!--\s*POV:/gm;

    const originalLength = content.length;
    // 置換後の文字列には「<!-- POV:」が含まれなくなるため、キャプチャグループを使って元通りにする。
    content = content.replace(regex, (match, emptyLines) => {
        return `${emptyLines}<!-- POV:`; // 区切り記号だけを消し、もともと空いていた空行とPOVタグ自体は残す
    });

    if (content.length !== originalLength) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated: ${file}`);
        totalReplaced++;
    }
}

console.log(`\nRemoval complete. Files modified: ${totalReplaced}`);
