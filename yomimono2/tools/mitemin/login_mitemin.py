import time
from playwright.sync_api import sync_playwright

from config import USER_DATA_DIR

print("=========================================================")
print("🌐 ブラウザを起動します。")
print("みてみん (mitemin.net) にログインしてください。")
print("ログインが完了したら、この画面に戻って Enterキー を押してください。")
print("=========================================================")

with sync_playwright() as p:
    browser = p.chromium.launch_persistent_context(
        user_data_dir=USER_DATA_DIR,
        headless=False
    )
    page = browser.new_page()
    page.goto("https://mitemin.net/login/input/")
    
    input("ログインが完了したらEnterを押してください...")
    
    browser.close()
    print("✅ ログイン状態を保存しました！ `python app.py` を再度実行してください。")
