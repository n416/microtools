const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\shingo\\Desktop\\microtools\\yomimono2\\public\\settings';
const inputPath = path.join(dir, 'micro_blocks.json');

try {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    
    const episodesBatch1 = ['ep0010.mdx', 'ep0020.mdx', 'ep0030.mdx', 'ep0040.mdx'];
    const episodesBatch2 = ['ep0050.mdx', 'ep0060.mdx', 'ep0070.mdx', 'ep0080.mdx', 'ep0090.mdx'];
    const episodesBatch3 = ['ep0100.mdx', 'ep0110.mdx', 'ep0120.mdx', 'ep0130.mdx', 'ep0140.mdx'];
    const episodesBatch4 = ['ep0150.mdx', 'ep0160.mdx', 'ep0170.mdx', 'ep0180.mdx', 'ep0190.mdx'];
    const episodesBatch5 = ['ep0200.mdx', 'ep0210.mdx', 'ep0220.mdx', 'ep0230.mdx', 'ep0240.mdx'];
    const episodesBatch6 = ['ep0250.mdx', 'ep0260.mdx', 'ep0270.mdx', 'ep0280.mdx', 'ep0290.mdx'];
    const episodesBatch7 = ['ep0300.mdx', 'ep0310.mdx', 'ep0320.mdx', 'ep0330.mdx', 'ep0340.mdx'];
    const episodesBatch8 = ['ep0350.mdx', 'ep0360.mdx', 'ep0370.mdx', 'ep0380.mdx', 'ep0390.mdx'];
    const episodesBatch9 = ['ep0400.mdx', 'ep0410.mdx'];
    
    const writeBatch = (episodes, name) => {
        const batch = data.filter(b => episodes.includes(b.file));
        const outText = batch.map(b => `\n--- BLOCK ID: ${b.blockId} | FILE: ${b.file} | POV: ${b.pov} | LINE: ${b.lineStart}-${b.lineEnd} ---\n${b.text}`).join('\n');
        fs.writeFileSync(path.join(dir, name), outText, 'utf-8');
    };
    
    writeBatch(episodesBatch1, 'batch1_for_ai.txt');
    writeBatch(episodesBatch2, 'batch2_for_ai.txt');
    writeBatch(episodesBatch3, 'batch3_for_ai.txt');
    writeBatch(episodesBatch4, 'batch4_for_ai.txt');
    writeBatch(episodesBatch5, 'batch5_for_ai.txt');
    writeBatch(episodesBatch6, 'batch6_for_ai.txt');
    writeBatch(episodesBatch7, 'batch7_for_ai.txt');
    writeBatch(episodesBatch8, 'batch8_for_ai.txt');
    writeBatch(episodesBatch9, 'batch9_for_ai.txt');
    
    console.log(`All 9 Batches prepared successfully.`);
} catch(e) {
    console.error(e);
}
