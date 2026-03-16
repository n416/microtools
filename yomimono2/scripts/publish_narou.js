import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../publish.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function publishNarou(title, body, existingEpisodeId = null, isDryRun = false) {
  const novelId = config.narou.novelId;

  if (!novelId) {
    throw new Error('config.narou.novelId is not set in publish.config.js');
  }

  // Persistent contextの設定
  const userDataDir = path.resolve(__dirname, '../.playwright_profile');
  const context = await chromium.launchPersistentContext(userDataDir, { 
    headless: false 
  });
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  let newEpisodeId = existingEpisodeId; // 引き継ぐか新規採番するか
  let skipped = false;

  try {
    // 1. 管理画面トップへ（ログイン済みかチェック）
    console.log('[Narou] Navigating to manage URL to check login status...');
    await page.goto(`https://syosetu.com/usernovelmanage/top/ncode/${novelId}/`);
    await page.waitForLoadState('domcontentloaded');

    // なろうの場合、未ログインだと https://syosetu.com/login/input/ 等に飛ばされます
    if (page.url().includes('login')) {
      console.log('================================================================');
      console.log('[Narou] Login required.');
      console.log(`[Narou] Please log in manually within the browser window.`);
      console.log('================================================================');

      console.log('[Narou] Waiting for successful login and redirection...');
      try {
        // ログイン完了すると /login 以外に飛ぶはずです
        await page.waitForURL(url => !url.href.includes('login'), { timeout: 60000 });
        console.log('[Narou] Login successful!');
      } catch (err) {
        throw new Error('Timeout waiting for manual login. Please try again within 60 seconds.');
      }
      
      await page.waitForLoadState('networkidle');
      
      // ===== 重要: ログイン完了後、再度目的の管理ページを開き直す =====
      // これをしないと、なろうの通常のマイページトップにいるだけで、
      // その後の処理でエラーになる場合があります。
      await page.goto(`https://syosetu.com/usernovelmanage/top/ncode/${novelId}/`);
      await page.waitForLoadState('domcontentloaded');
    }
    
    // それでもURLがusernovelmanage/top/ncodeを含んでいない、またはエラー表記がある場合
    if (!page.url().includes('usernovelmanage')) {
       throw new Error(`[Narou] Permission Error: Could not access dashboard. Please check NAROU_NOVEL_ID in .env`);
    }

    // 2. ID解決フェーズ（既存IDの検証 -> 自動探索 -> 新規作成の順で試行）
    let formFound = false;
    let fallbackToAutoDiscover = false;

    if (existingEpisodeId) {
       console.log(`[Narou] Mapped ID exists: ${existingEpisodeId}. Attempting Fast-Path...`);
       let rawId = existingEpisodeId.replace('draft-', '');
       if (existingEpisodeId.startsWith('draft-')) {
          await page.goto(`https://syosetu.com/draftepisode/view/draftepisodeid/${rawId}/`);
          await page.waitForLoadState('domcontentloaded');
          const isError = await page.locator(':has-text("エラーが発生しました"), :has-text("ページが見つかりません")').count() > 0;
          if (!isError) {
             const editBtn = page.locator('a:has-text("編集"), button:has-text("編集")').first();
             if (await editBtn.count() > 0) {
                 await editBtn.click();
                 await page.waitForLoadState('domcontentloaded');
             }
          }
       } else {
          await page.goto(`https://syosetu.com/usernoveldatamanage/updateinput/ncode/${novelId}/noveldataid/${rawId}/`);
          await page.waitForLoadState('domcontentloaded');
       }

       const isMismatchError = await page.locator(':has-text("NコードとID不一致")').count() > 0;
       if (!isMismatchError) {
          try {
             await page.waitForSelector('input[name="subtitle"]', { state: 'visible', timeout: 3000 });
             formFound = true;
          } catch(e) {}
       }

       if (!formFound) {
          console.log(`[Narou] WARNING: Mapped ID ${existingEpisodeId} is invalid/mismatched/published-from-draft. Falling back to Auto-Discovery...`);
          fallbackToAutoDiscover = true;
       }
    } else {
       fallbackToAutoDiscover = true;
    }

    // 3. Auto-Discovery フェーズ（タイトルから検索）
    if (fallbackToAutoDiscover && !formFound) {
       console.log(`[Narou] Attempting to auto-discover existing episode by title across Published and Draft tabs...`);
       existingEpisodeId = null;
       
       const extractIdFromList = async () => {
           // 対象エピソードのタイトルリンク自体（/noveldataid/等のhrefを持つaタグ）を直接検索対象にする
           const links = page.locator('a[href*="/noveldataid/"], a[href*="/draftepisodeid/"]');
           const count = await links.count();
           for (let i = 0; i < count; i++) {
               const link = links.nth(i);
               const text = await link.textContent();
               
               // aタグ直近の親要素のテキストだけを取得（全体を取らないよう制限）
               const parentText = await link.evaluate(node => {
                   let curr = node;
                   // 異なるエピソードID（noveldataid, draftepisodeid）が複数含まれるでかい親まで遡らない
                   while (curr.parentElement) {
                       const links = Array.from(curr.parentElement.querySelectorAll('a[href*="/noveldataid/"], a[href*="/draftepisodeid/"]'));
                       const uniqueIds = new Set(
                           links.map(a => {
                               const m1 = a.href.match(/\/noveldataid\/(\d+)/);
                               if (m1) return m1[1];
                               const m2 = a.href.match(/\/draftepisodeid\/(\d+)/);
                               if (m2) return 'draft-' + m2[1];
                               return null;
                           }).filter(id => id !== null)
                       );
                       // 2つ以上の異なる話数のリンクが含まれていれば、それはリスト全体のコンテナ
                       if (uniqueIds.size > 1) break;
                       curr = curr.parentElement;
                   }
                   return curr.textContent || '';
               });

               const normalize = (s) => (s || '').replace(/\s+/g, '');
               if (normalize(text).includes(normalize(title)) || normalize(parentText).includes(normalize(title))) {
                   const href = await link.getAttribute('href');
                   const dpMatch = href && href.match(/\/draftepisodeid\/(\d+)/);
                   if (dpMatch) return "draft-" + dpMatch[1];
                   const ndMatch = href && href.match(/\/noveldataid\/(\d+)/);
                   if (ndMatch) return ndMatch[1];
               }
           }
           return null;
       };

       // 3-1. 投稿済／予約中タブの検索
       await page.goto(`https://syosetu.com/usernovelmanage/top/ncode/${novelId}/`);
       await page.waitForLoadState('domcontentloaded');
       let discoveredId = await extractIdFromList();
       
       if (discoveredId) {
           console.log(`[Narou] Auto-discovered Published/Reserved episode! ID: ${discoveredId}`);
           existingEpisodeId = discoveredId;
           newEpisodeId = discoveredId;
       } else {
           // 3-2. 下書きタブの検索
           await page.goto(`https://syosetu.com/usernovelmanage/top/ncode/${novelId}/?filter=draft`);
           await page.waitForLoadState('domcontentloaded');
           discoveredId = await extractIdFromList();
           if (discoveredId) {
               console.log(`[Narou] Auto-discovered Draft episode! ID: ${discoveredId}`);
               existingEpisodeId = discoveredId;
               newEpisodeId = discoveredId;
           }
       }
       
       // 発見できたら直接編集画面へアクセス
       if (discoveredId) {
           let rawId = discoveredId.replace('draft-', '');
           if (discoveredId.startsWith('draft-')) {
               await page.goto(`https://syosetu.com/draftepisode/view/draftepisodeid/${rawId}/`);
               await page.waitForLoadState('domcontentloaded');
               const editBtn = page.locator('a:has-text("編集"), button:has-text("編集")').first();
               if (await editBtn.count() > 0) {
                   await editBtn.click();
                   await page.waitForLoadState('domcontentloaded');
               }
           } else {
               // 投稿済／予約中なら /updateinput/ を直接開く
               await page.goto(`https://syosetu.com/usernoveldatamanage/updateinput/ncode/${novelId}/noveldataid/${rawId}/`);
               await page.waitForLoadState('domcontentloaded');
           }
           
           try {
              await page.waitForSelector('input[name="subtitle"]', { state: 'visible', timeout: 3000 });
              formFound = true;
           } catch(e) {
              formFound = false;
           }
       }
    }

    // 4. 新規作成フェーズ（ID解決もAuto-Discoveryも失敗した場合）
    if (!formFound) {
       console.log(`[Narou] Could not resolve any existing episode. Proceeding to create a completely NEW episode...`);
       existingEpisodeId = null;
       newEpisodeId = null;

       await page.goto(`https://syosetu.com/usernovelmanage/top/ncode/${novelId}/`);
       await page.waitForLoadState('domcontentloaded');
       const fallbackNewLink = page.locator('a:has-text("次話投稿"), a:has-text("新しいエピソードを追加"), a[href*="/draftepisode/input/"], a[href*="/ziwainput/"]').first();
       if (await fallbackNewLink.count() > 0) {
          await fallbackNewLink.click();
          await page.waitForLoadState('domcontentloaded');
       } else {
          throw new Error(`[Narou] Could not find "新しいエピソードを追加" (New Episode) link on the dashboard.`);
       }
    }

    // 5. タイトルと本文の入力判定
    console.log('[Narou] Checking if content is changed...');
    const subtitleInput = page.locator('input[name="subtitle"]');
    const novelInput = page.locator('textarea[name="novel"]');
    
    // 現在のテキストを取得
    const currentTitle = await subtitleInput.inputValue();
    const currentBody = await novelInput.inputValue();

    // 比較（改行コードの違いを吸収するため正規化してから比較する）
    const normalize = (str) => str.replace(/\r\n/g, '\n').trim();
    if (normalize(currentTitle) === normalize(title) && normalize(currentBody) === normalize(body)) {
       console.log('[Narou] Content is identical. Skipping save.');
       skipped = true;
       // ドライランでも同一ならそのまま返すが、currentテキストも一応返す
       if (isDryRun) {
           return { id: existingEpisodeId, skipped, dryRun: true, currentTitle, currentBody };
       }
    } else {
       if (isDryRun) {
           console.log('[Narou] Dry-Run mode active. Returning existing text without saving.');
           return { id: existingEpisodeId, skipped: false, dryRun: true, currentTitle, currentBody };
       }

       console.log('[Narou] Filling subtitle and body...');
       await subtitleInput.fill('');
       await subtitleInput.fill(title);
       
       await novelInput.fill('');
       await novelInput.fill(body);

       // 4. 確認画面へ進む（最初の送信ボタンをクリック）
       console.log('[Narou] Clicking the primary save/confirm button on the edit page...');
       
       // 新規作成でも部分改稿でも、大抵は「〜確認」や「設定を保存」や「下書き保存」というボタンを押して次へ進む
       const primaryButton = page.locator('button:has-text("下書き保存"), input[type="submit"][value*="確認"], input[type="submit"][value*="改稿"], input[type="submit"][value*="設定を保存"], button:has-text("確認")').first();
       
       if (await primaryButton.count() > 0) {
         await primaryButton.click();
         await page.waitForLoadState('domcontentloaded');
         console.log('[Narou] Passed the first stage. Now on the confirmation screen (or finished).');
       } else {
         console.log('[Narou] No primary submit button found. Trying to proceed anyway...');
       }

       // 5. 最終実行画面での処理（確認画面の「実行」「書き込み」「保存[実行]」を押す）
       console.log('[Narou] Checking for final execution button on the confirmation page...');
       
       // 【既存エピソード（部分改稿）の場合】
       if (existingEpisodeId) {
          // なろうの「部分改稿」確認画面には「保存[実行]」等のボタンがある。
          // 既存話のアップデートなので、最後まで自動実行してOK。
          const finalExecuteButton = page.locator('input[type="submit"][value*="実行"], input[type="submit"][value*="書込"], input[type="submit"][value*="書き込み"], button:has-text("実行"), button:has-text("保存[実行]")').first();
          
          if (await finalExecuteButton.count() > 0) {
             await finalExecuteButton.click();
             await page.waitForLoadState('domcontentloaded');
             console.log('[Narou] Successfully FULLY updated existing episode.');
          } else {
             console.log('[Narou] Final execution button not found. It might have saved already, or the UI changed.');
          }
       } else {
          // 【新規エピソード作成の場合】
          // 新規作成は「下書き保存」などのボタンを押した時点で自動的に「下書き」扱いとして
          // https://syosetu.com/draftepisode/view/draftepisodeid/12345/ といったURLに飛ぶ仕様になった場合
          const currentUrl = page.url();
          const draftMatch = currentUrl.match(/\/draftepisodeid\/(\d+)/) || currentUrl.match(/\/noveldataid\/(\d+)/);
          
          if (draftMatch) {
             newEpisodeId = draftMatch[1];
             console.log(`[Narou] Successfully captured new draft episode ID: ${newEpisodeId} directly from URL (was missing in map).`);
          } else {
             // 見つからなければ、確認画面で止まっている可能性があるため猶予を持たせる
             console.log('================================================================');
             console.log('[Narou] Need manual publication settings (e.g. Schedule Reservation).');
             console.log('[Narou] Please manually select publication settings and click Submit in the browser window.');
             console.log('================================================================');
             
             try {
                // 30秒間 URL変化（draftepisodeid か noveldataid の出現）を待つ
                await page.waitForURL(url => url.href.includes('/draftepisodeid/') || url.href.includes('/noveldataid/'), { timeout: 30000 });
                const finalUrl = page.url();
                const fm = finalUrl.match(/\/draftepisodeid\/(\d+)/) || finalUrl.match(/\/noveldataid\/(\d+)/);
                if (fm) {
                   newEpisodeId = fm[1];
                   console.log(`[Narou] Discovered new Episode ID after manual interaction: ${newEpisodeId}`);
                }
             } catch(e) {
                console.log('[Narou] Timed out waiting for URL change to draft/published page. Using fallback to fetch ID...');
                // タイムアウトしたら最終手段として一覧から取得
                console.log('[Narou] Fetching newly assigned episode ID from the management list...');
                await page.goto(`https://syosetu.com/usernovelmanage/top/ncode/${novelId}/`);
                await page.waitForLoadState('domcontentloaded');
                const allLinks = page.locator(`a[href*="/noveldataid/"]`);
                const count = await allLinks.count();
                if (count > 0) {
                   const lastLinkPath = await allLinks.nth(count - 1).getAttribute('href');
                   const match = lastLinkPath && lastLinkPath.match(/\/noveldataid\/(\d+)/);
                   if (match) {
                      newEpisodeId = match[1];
                      console.log(`[Narou] Discovered new Episode ID from fallback list: ${newEpisodeId}`);
                   }
                }
             }
          }
       }
    }

  } finally {
    await page.waitForTimeout(3000);
    // Persistent Contextの場合は context.close()
    await context.close();
  }

  return { id: newEpisodeId, skipped };
}
