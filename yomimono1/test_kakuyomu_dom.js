import { chromium } from 'playwright';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    const workId = process.env.KAKUYOMU_WORK_ID;
    const context = await chromium.launchPersistentContext('.playwright_profile', { headless: false });
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    
    await page.goto(`https://kakuyomu.jp/my/works/${workId}`);
    await page.waitForLoadState('domcontentloaded');

    if (page.url().includes('login')) {
      await page.waitForTimeout(10000);
      await page.goto(`https://kakuyomu.jp/my/works/${workId}`);
    }

    const html = await page.evaluate(() => {
        return document.body.innerHTML;
    });
    
    fs.writeFileSync('kakuyomu_dom.txt', html);
    console.log('DOM written to kakuyomu_dom.txt');

    await context.close();
})();
