import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const userDataDir = path.resolve(__dirname, '../.playwright_profile');
  
  console.log('================================================================');
  console.log('プレビュー用ブラウザ（Playwright Persistent Context）を起動します。');
  console.log('ここでログイン・ログアウトした状態が、自動投稿スクリプトに引き継がれます。');
  console.log('コンソールで Ctrl+C を押すか、ブラウザを全て閉じると終了します。');
  console.log('================================================================');

  const context = await chromium.launchPersistentContext(userDataDir, { 
    headless: false,
    viewport: null, // デフォルトサイズを無効化し、手動でリサイズしやすくする
  });

  // 最初のページはなろうのダッシュボードへ
  const page1 = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page1.goto('https://syosetu.com/usernovelmanage/top/');

  // 2つ目のタブでカクヨムを開く
  const page2 = await context.newPage();
  await page2.goto('https://kakuyomu.jp/my');

  // ブラウザが閉じられるまで待機（Nodeプロセスを終了させない）
  context.on('close', () => {
    console.log('ブラウザが閉じられました。終了します。');
    process.exit(0);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
