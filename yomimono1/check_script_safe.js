const fs = require('fs');
const path = require('path');

try {
    const targetDir = 'C:\\Users\\shingo\\Desktop\\microtools\\yomimono1\\public\\settings';
    const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.mdx'));
    const issues = [];
    
    files.forEach(file => {
        const content = fs.readFileSync(path.join(targetDir, file), 'utf-8');
        const lines = content.split('\n');
    
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            const text = line.trim();
            if (!text) return;
            
            // 奇数個の三点リーダー・ダッシュの確認
            const countEllipsis = (text.match(/…/g) || []).length;
            if (countEllipsis > 0 && countEllipsis % 2 !== 0) {
                issues.push(`[三点リーダーが奇数] ${file}:${lineNum} - ${text}`);
            }
            
            const countDash = (text.match(/―/g) || []).length;
            if (countDash > 0 && countDash % 2 !== 0) {
                issues.push(`[ダッシュが奇数] ${file}:${lineNum} - ${text}`);
            }

            // 特殊ルビの表記揺れ確認 (终端 vs 端末など)
            // 作者は基本的に「终端」等の独自ルビやSF用語を使っている可能性がある。
            // また、他の揺れやすい漢字等もチェックする。
            if (text.includes('端末') && !text.includes('终端')) {
                issues.push(`[「端末」表記] ${file}:${lineNum} - ${text}`);
            }
        });
    });
    
    fs.writeFileSync('C:\\Users\\shingo\\Desktop\\microtools\\yomimono1\\check_result.txt', issues.join('\n'), 'utf-8');
    console.log('Scan completed successfully.');
} catch(e) {
    fs.writeFileSync('C:\\Users\\shingo\\Desktop\\microtools\\yomimono1\\check_result.txt', 'Error: ' + e.message, 'utf-8');
    console.log('Scan failed.');
}
