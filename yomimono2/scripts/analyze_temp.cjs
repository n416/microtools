const fs = require('fs');
const path = require('path');
const { SidebarNavItems } = require('./src/sidebar_nav.js');

const results = [];
for (const item of SidebarNavItems) {
  if (item.target === 'yomikiri' || item.target === 'ep_spinoff_logan') continue; // 除外
  
  const filePath = path.join('./public/settings', item.target + '.mdx');
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const length = content.length;
    results.push({
      target: item.target,
      title: item.title,
      length: length
    });
  }
}

// targetでソート（インデックス順）
results.sort((a, b) => a.target.localeCompare(b.target));

// 出力パス
const outPath = path.join(process.env.TEMP, 'analyze_results.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
console.log('Saved to:', outPath);
