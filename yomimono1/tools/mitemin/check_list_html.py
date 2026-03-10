from playwright.sync_api import sync_playwright
import time
import os

from config import USER_DATA_DIR

print("--- 画像一覧取得テスト ---")
if not os.path.exists(USER_DATA_DIR):
    print("ログインプロファイルが見つかりません。")
else:
    with sync_playwright() as p:
        browser = p.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            headless=True
        )
        page = browser.new_page()
        page.goto('https://mitemin.net/userimagesearch/search/')
        page.wait_for_load_state("networkidle")
        
        print(f"URL: {page.url}")
        
        if "login" in page.url:
            print("ログインが必要です。手動ログインから試してください。")
        else:
            with open('mitemin_list.html', 'w', encoding='utf-8') as f:
                f.write(page.content())
            print("一覧ページのHTMLを保存しました。")
        browser.close()
