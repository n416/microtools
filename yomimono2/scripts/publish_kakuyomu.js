import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../publish.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function publishKakuyomu(title, body, existingEpisodeId = null, isDryRun = false) {
  const workId = config.kakuyomu.workId;

  if (!workId) {
    throw new Error('config.kakuyomu.workId is not set in publish.config.js');
  }

  // ユーザーデータディレクトリ（セッションやクッキーを保存する場所）
  const userDataDir = path.resolve(__dirname, '../.playwright_profile');

  // persistent contextで起動することで、一度ログインすればクッキー等が次回以降も維持されます
  const context = await chromium.launchPersistentContext(userDataDir, { 
    headless: false // 手動ログイン操作が必要な場合があるため、常に画面を表示
  });
  
  // persistent context の場合、デフォルトで1つのページ(tabs)が開かれています
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  let newEpisodeId = null;
  let skipped = false;

  try {
    // 1. ログインページ（または管理画面トップ）へ
    console.log('[Kakuyomu] Navigating to works URL to check login status...');
    await page.goto(`https://kakuyomu.jp/my/works/${workId}`);
    await page.waitForLoadState('domcontentloaded');

    // 現在のURLがログイン画面（/login等）にリダイレクトされたかチェック
    if (page.url().includes('/login') || page.url().includes('/auth/login')) {
      console.log('================================================================');
      console.log('[Kakuyomu] Login required.');
      console.log(`[Kakuyomu] Please log in manually (e.g., using Google/Apple) within the browser window.`);
      console.log('================================================================');
      
      // ユーザーが手動でGoogle認証等を通るのを待つ
      console.log('[Kakuyomu] Waiting for successful login and redirection...');
      try {
        // URLが /login 以外になるまで最大60秒待機
        await page.waitForURL(url => !url.href.includes('/login') && !url.href.includes('/auth/'), { timeout: 60000 });
        console.log('[Kakuyomu] Login successful!');
      } catch (err) {
        throw new Error('Timeout waiting for manual login. Please try again and complete login within 60 seconds.');
      }
      
      // 追加でページロードを待つ
      await page.waitForLoadState('networkidle');
      
      // 再度、作品の管理トップへ確実に移動
      await page.goto(`https://kakuyomu.jp/my/works/${workId}`);
      await page.waitForLoadState('domcontentloaded');
    }

    // 2. 既存IDが指定されていない場合、タイトルから既存エピソードを自動探索する（重複投稿防止）
    if (!existingEpisodeId) {
      console.log(`[Kakuyomu] No mapped ID found in publish_map.json. Attempting to auto-discover existing episode by title...`);
      await page.goto(`https://kakuyomu.jp/my/works/${workId}`);
      await page.waitForLoadState('domcontentloaded');

      const editLinks = page.locator(`a[href*="/works/${workId}/episodes/"]`);
      const count = await editLinks.count();
      for (let i = 0; i < count; i++) {
        const link = editLinks.nth(i);
        const parentText = await link.evaluate(node => {
          let curr = node;
          // 行単位のコンテナを取得する：親要素内にある "/episodes/" リンクが「同じ話数（ID）のものだけ」である最大の親を探す
          while (curr.parentElement) {
             const linksInParent = Array.from(curr.parentElement.querySelectorAll('a[href*="/episodes/"]'));
             // 抽出されたエピソードIDのリストを取得し、重複を排除
             const uniqueIds = new Set(
                 linksInParent
                     .map(a => a.href.match(/\/episodes\/(\d+)$/))
                     .filter(m => m !== null)
                     .map(m => m[1])
             );
             
             // 親要素内に2種類以上の異なるエピソードIDが含まれているなら、それはリスト全体の親なので遡るのをやめる
             if (uniqueIds.size > 1) {
                 break;
             }
             curr = curr.parentElement;
          }
          return curr.textContent || '';
        });
        
        // スペースや改行を無視して部分一致を判定
        const normalize = (s) => s.replace(/\s+/g, '');
        if (normalize(parentText).includes(normalize(title))) {
          const href = await link.getAttribute('href');
          // "new" を除外してエピソードID（数字）のみ抽出
          const match = href.match(/\/episodes\/(\d+)$/);
          if (match) {
             existingEpisodeId = match[1];
             newEpisodeId = match[1];
             console.log(`[Kakuyomu] Auto-discovered existing episode ID: ${existingEpisodeId} matching title "${title}"`);
             break;
          }
        }
      }
    }

    // 3. 既存IDがあれば編集、無ければ新規作成
    if (existingEpisodeId) {
      console.log(`[Kakuyomu] Using mapped episode ID: ${existingEpisodeId}. Navigating to edit page...`);
      await page.goto(`https://kakuyomu.jp/my/works/${workId}/episodes/${existingEpisodeId}`);
      await page.waitForLoadState('domcontentloaded');
      
      // 削除済み等で404ページになった場合のフォールバック（「お探しのページは見つかりませんでした」）
      const notFoundElement = page.locator(':has-text("お探しのページは見つかりませんでした"), :has-text("お探しのエピソードは見つかりませんでした")').first();
      // __NEXT_DATA__に not_found が含まれるかでも判定可能
      const isNotFound = (await notFoundElement.count() > 0) || await page.evaluate(() => {
        const nextData = document.getElementById('__NEXT_DATA__');
        return nextData ? nextData.textContent.includes('not_found') : false;
      });

      if (isNotFound) {
        console.log(`[Kakuyomu] WARNING: Mapped episode ID ${existingEpisodeId} was not found (likely deleted). Creating new episode instead...`);
        // IDをクリアして新規作成ページへ移動
        existingEpisodeId = null;
        await page.goto(`https://kakuyomu.jp/my/works/${workId}/episodes/new`);
        await page.waitForLoadState('domcontentloaded');
      }
    } else {
      console.log(`[Kakuyomu] No mapped ID. Navigating to new episode page...`);
      await page.goto(`https://kakuyomu.jp/my/works/${workId}/episodes/new`);
      await page.waitForLoadState('domcontentloaded');
    }

    // 3. タイトルと本文の入力判定
    console.log('[Kakuyomu] Checking if content is changed...');
    const titleInput = page.locator('input[name="title"], input[placeholder="エピソードタイトル"]');
    const bodyInput = page.locator('textarea[name="body"], textarea');
    
    // 現在のテキストを取得
    const currentTitle = await titleInput.inputValue();
    const currentBody = await bodyInput.inputValue();

    // 比較（改行コードの違いを吸収するため正規化してから比較する）
    const normalize = (str) => str.replace(/\r\n/g, '\n').trim();
    if (normalize(currentTitle) === normalize(title) && normalize(currentBody) === normalize(body)) {
       console.log('[Kakuyomu] Content is identical. Skipping save.');
       skipped = true;
       if (isDryRun) {
           return { id: existingEpisodeId, skipped, dryRun: true, currentTitle, currentBody };
       }
    } else {
       if (isDryRun) {
           console.log('[Kakuyomu] Dry-Run mode active. Returning existing text without saving.');
           return { id: existingEpisodeId, skipped: false, dryRun: true, currentTitle, currentBody };
       }

       console.log('[Kakuyomu] Filling title and body...');
       // 一旦クリアしてから入力
       await titleInput.fill('');
       await titleInput.fill(title);
       
       await bodyInput.fill('');
       await bodyInput.fill(body);

      // 4. 保存
      console.log('[Kakuyomu] Saving changes... (Strictly targeting draft or save, avoiding "publish")');
      // カクヨムの公開ボタン・下書きボタンは span のテキストで判定するのが安全な場合が多い
      // "保存" または "変更を保存" を厳格に狙う。（ただし「公開」が含まれるボタンは避ける）
      const safeSaveButton = page.locator('button:has-text("下書き"), button:has-text("保存"):not(:has-text("公開")), input[type="submit"][value*="保存"]:not([value*="公開"])').first();
      
      if (await safeSaveButton.count() > 0) {
        await safeSaveButton.click();
        await page.waitForLoadState('networkidle');
        console.log('[Kakuyomu] Saved successfully!');
        
        // 保存後のURLからエピソードIDを抽出 (新規作成後にリダイレクトされるURLなど)
        // 例: /works/[ID]/episodes/[episodeId] または /works/[ID]/episodes/[episodeId]/edit
        const currentUrl = page.url();
        const match = currentUrl.match(/\/episodes\/(\d+)/);
        if (match) {
          newEpisodeId = match[1];
          console.log(`[Kakuyomu] Current Episode ID is: ${newEpisodeId}`);
        }
      } else {
        console.error('[Kakuyomu] ERROR: Safe Save button not found. Aborting to prevent accidental publish.');
        console.log('================================================================');
        console.log('[Kakuyomu] Please check the browser window to see the actual UI. Waiting 30 seconds before closing...');
        console.log('================================================================');
        await page.waitForTimeout(30000); // 画面がすぐ閉じてしまわないように待機
        throw new Error("Could not find a safe 'Save as Draft' or 'Save' button on Kakuyomu.");
      }
    }

  } finally {
    await page.waitForTimeout(3000);
    // Persistent Contextの場合は browser.close() ではなく context.close() を呼びます
    await context.close();
  }
  
  return { id: newEpisodeId, skipped }; // 呼び出し元へ返す（新規の場合はここで得たIDを保存するため）
}
