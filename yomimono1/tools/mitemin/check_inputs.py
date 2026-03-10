from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('https://mitemin.net/login/input/')
    
    print("--- 取得した input タグ ---")
    inputs = page.locator('input').all()
    for i in inputs:
        name = i.get_attribute("name")
        type_attr = i.get_attribute("type")
        val = i.get_attribute("value")
        print(f"Name: {name}, Type: {type_attr}, Value: {val}")
        
    browser.close()
