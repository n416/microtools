const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\shingo\\Desktop\\microtools\\yomimono2\\public\\settings';
const inputPath = path.join(dir, 'micro_blocks.json');
const outputPath = path.join(dir, 'batch2_for_ai.txt');

try {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    
    // Target ep0050 to ep0090
    const targetEpisodes = ['ep0050.mdx', 'ep0060.mdx', 'ep0070.mdx', 'ep0080.mdx', 'ep0090.mdx'];
    const batch = data.filter(b => targetEpisodes.includes(b.file));
    
    let outText = '';
    for(const block of batch) {
        outText += `\n--- BLOCK ID: ${block.id} | FILE: ${block.file} | POV: ${block.pov} | LINE: ${block.startLine}-${block.endLine} ---\n`;
        outText += block.text + "\n";
    }
    
    fs.writeFileSync(outputPath, outText, 'utf-8');
    console.log(`Extracted ${batch.length} blocks for Batch 2.`);
} catch(e) {
    console.error(e);
}
