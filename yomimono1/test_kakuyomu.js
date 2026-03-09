import { chromium } from 'playwright';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    const workId = process.env.KAKUYOMU_WORK_ID;
    const context = await chromium.launchPersistentContext('.playwright_profile', { headless: false });
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    
    await page.goto(`https://kakuyomu.jp/my/works/${workId}`);
    await page.waitForLoadState('domcontentloaded');

    if (page.url().includes('login')) {
      console.log('Needs login. Waiting 10s...');
      await page.waitForTimeout(10000);
      await page.goto(`https://kakuyomu.jp/my/works/${workId}`);
    }

    const editLinks = page.locator(`a[href*="/works/${workId}/episodes/"]`);
    const count = await editLinks.count();
    console.log(`Found ${count} edit links matching selector.`);
    
    for (let i = 0; i < count; i++) {
        const link = editLinks.nth(i);
        const text = await link.textContent();
        const href = await link.getAttribute('href');
        
        let parentText = await link.evaluate(node => {
            let curr = node;
            while (curr.parentElement) {
                const linksInParent = Array.from(curr.parentElement.querySelectorAll('a[href*="/episodes/"]'));
                const episodeLinksCount = linksInParent.filter(a => /\/episodes\/\d+$/.test(a.href)).length;
                if (episodeLinksCount > 1) break;
                curr = curr.parentElement;
            }
            return curr.textContent || '';
        });
        
        console.log(`[Link \${i}] text="\${text.trim()}", href="\${href}"`);
        console.log(`  parentText="\${parentText.trim().replace(/\\n/g, '')}"`);
        const match = href.match(/\\/episodes\\/(\\d+)$/);
        console.log(`  match ID=\${match ? match[1] : 'null'}`);
    }
    await context.close();
})();
