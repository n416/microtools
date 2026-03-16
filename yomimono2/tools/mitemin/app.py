import os
import re
import time
from flask import Flask, request, render_template, jsonify
from playwright.sync_api import sync_playwright

app = Flask(__name__)
from config import UPLOAD_FOLDER, CACHE_FOLDER, USER_DATA_DIR, CACHE_FILE

@app.route('/get_cached_list', methods=['GET'])
def get_cached_list():
    if os.path.exists(CACHE_FILE):
        try:
            import json
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return jsonify({'status': 'success', 'user_id': data.get('user_id', ''), 'images': data.get('images', [])})
        except Exception as e:
            pass
    return jsonify({'status': 'success', 'user_id': '', 'images': []})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'ファイルがありません'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'ファイル名が空です'})

    # 一時保存
    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)
    file_name_without_ext = os.path.splitext(file.filename)[0]
    
    # ログイン情報を受け取る
    login_id = request.form.get('login_id', '')
    login_password = request.form.get('login_password', '')

    if not login_id or not login_password:
         os.remove(filepath)
         return jsonify({'status': 'error', 'message': 'ログインIDとパスワードを入力してください'})

    # Playwrightで自動アップロード処理
    try:
        with sync_playwright() as p:
            # headless=False にするとブラウザが動く様子が見えます
            browser = p.chromium.launch_persistent_context(
                user_data_dir=USER_DATA_DIR,
                headless=False 
            )
            page = browser.new_page()

            # --- STEP 1: ファイル選択画面 ---
            target_url = "https://mitemin.net/imageupload/input/"
            print(f"[DEBUG] アクセス先: {target_url}")
            page.goto(target_url)
            page.wait_for_load_state("networkidle")
            
            current_url = page.url
            print(f"[DEBUG] 現在のURL: {current_url}")
            
            # ※ログイン画面に飛ばされた場合は自動ログインを試みる
            if "login" in current_url:
                print(f"[DEBUG] ログイン画面にリダイレクトされました。自動ログインを実行します。")
                print(f"[DEBUG] 送信されたID: {login_id}, パスワード文字数: {len(login_password)}")
                
                page.locator('input[name="miteminid"]').click()
                page.locator('input[name="miteminid"]').fill(login_id)
                time.sleep(0.5)
                
                page.locator('input[name="pass"]').click()
                page.locator('input[name="pass"]').fill(login_password)
                time.sleep(0.5)
                
                # 次回から自動的にログインにチェックを入れておく
                if page.locator('input[name="skip"]').is_visible():
                     page.locator('input[name="skip"]').check()
                     
                page.get_by_role("button", name="LOGIN").click()
                page.wait_for_load_state("networkidle")
                time.sleep(1)
                
                # ログイン成功後、再度アップロード画面へ遷移
                page.goto(target_url)
                page.wait_for_load_state("networkidle")
                
                # それでもloginページにいるならID/PASS間違いなど
                if "login" in page.url:
                    browser.close()
                    os.remove(filepath)
                    return jsonify({'status': 'error', 'message': '自動ログインに失敗しました。IDとパスワードを確認してください。'})
            
            print("[DEBUG] ログイン済みを確認。アップロード処理を開始します。")

            page.locator('input[type="file"]').set_input_files(filepath)
            page.get_by_role("button", name="画像情報入力へ").click()
            page.wait_for_load_state("networkidle")

            # --- エラーチェック (二重アップロード等) ---
            # 「画像情報入力へ」を押した段階で重複しているとエラー画面(input2/)に飛ばされる
            error_text = "この画像はすでにアップロードされています"
            if error_text in page.content():
                browser.close()
                os.remove(filepath)
                return jsonify({'status': 'error', 'message': '過去に同じ画像がアップロードされています'})

            # --- STEP 2: 画像情報入力画面 ---
            # タイトル（前は検索バーに入力されてしまっていたため、ID指定に修正）
            page.locator('#imagetitle').fill(file_name_without_ext) 
            
            # AI生成画像のラジオボタン
            page.locator('input[name="image_type"][value="2"]').check()
            
            # ジャンル（1=イラスト）
            page.locator('select[name="genre"]').select_option("1")
            
            # 確認ボタン
            page.get_by_role("button", name="アップロード[確認]").click()
            page.wait_for_load_state("networkidle")

            # --- STEP 3: 確認・実行画面 ---
            page.get_by_role("button", name=re.compile("アップロード")).click()
            page.wait_for_load_state("networkidle")

            # --- STEP 4: URL(ID)とユーザーIDの抽出 ---
            content = page.content()
            
            # 画像ID ("i" + 数字) を探す
            image_match = re.search(r'(i\d{5,8})', content)
            
            # ページ内のURL (例: https://50198.mitemin.net/i1110175/) からユーザーID（サブドメインの数字）を探す
            user_id_match = re.search(r'https?://(\d{4,8})\.mitemin\.net', content)
            if not user_id_match:
                 # 念のため、他のパターンも探す
                 user_id_match = re.search(r'mitemin\.net/user(?:page)?/(?:top/)?(\d{4,8})', content)
            
            user_id = user_id_match.group(1) if user_id_match else "ユーザーID取得失敗"

            if image_match:
                image_id = image_match.group(1)
                result = {'status': 'success', 'image_id': image_id, 'user_id': user_id}
            else:
                result = {'status': 'error', 'message': '画像IDが抽出できませんでした'}

            # サーバー負荷対策の待機時間（超重要）
            time.sleep(5)
            
            browser.close()
            # 終わったら一時ファイルを削除
            os.remove(filepath)
            
            return jsonify(result)

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/sync_list', methods=['POST'])
def sync_image_list():
    login_id = request.form.get('login_id')
    login_password = request.form.get('login_password')
    
    if not login_id or not login_password:
        return jsonify({'status': 'error', 'message': 'ログインIDとパスワードが必要です。'})
        
    # 既存のキャッシュを読み込む
    existing_cache = []
    cached_user_id = "unknown"
    if os.path.exists(CACHE_FILE):
        try:
            import json
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                existing_cache = data.get('images', [])
                cached_user_id = data.get('user_id', 'unknown')
        except:
            pass
            
    existing_ids = set([img['image_id'] for img in existing_cache])
    new_images = []
    user_id = cached_user_id
        
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch_persistent_context(
                user_data_dir=USER_DATA_DIR,
                headless=True
            )
            page = browser.new_page()
            
            import urllib.request
            import urllib.parse
            import json
            
            current_page = 1
            while True:
                # 指定されたページのURLを組み立ててアクセス
                target_url = f'https://mitemin.net/userimagesearch/search/index.php?p={current_page}'
                page.goto(target_url)
                page.wait_for_load_state("networkidle")

                # 未ログインの場合はログイン処理を実施する (1ページ目アクセス時のみ)
                if current_page == 1 and ("login/input" in page.url or "login" in page.url):
                    print(f"[DEBUG Sync] ログイン画面にリダイレクトされました。ログインを試みます。")
                    page.locator('input[name="miteminid"]').click()
                    page.locator('input[name="miteminid"]').fill(login_id)
                    time.sleep(0.5)
                    page.locator('input[name="pass"]').click()
                    page.locator('input[name="pass"]').fill(login_password)
                    time.sleep(0.5)
                    if page.locator('input[name="skip"]').is_visible():
                         page.locator('input[name="skip"]').check()
                    page.get_by_role("button", name="LOGIN").click()
                    page.wait_for_load_state("networkidle")
                    
                    # 最初に見ようとした一覧ページに再度アクセス
                    page.goto(target_url)
                    page.wait_for_load_state("networkidle")
                    
                    if "login" in page.url:
                        browser.close()
                        return jsonify({'status': 'error', 'message': 'ログインに失敗したようです。'})
                
                # --- 画像一覧とユーザーIDの取得処理 ---
                content = page.content()
                
                if current_page == 1:
                    user_id_match = re.search(r'mitemin\.net/user(?:page)?/(?:top/)?(\d{4,8})', content)
                    if not user_id_match:
                         user_id_match = re.search(r'https?://(\d{4,8})\.mitemin\.net', content)
                    if user_id_match:
                         user_id = user_id_match.group(1)
                
                # 画像のブロック要素 (<div class="image_box">...</div> 等) を正規表現で抽出
                box_matches = list(re.finditer(r'<div class="image_box">(.*?)</div><!-- search_box -->', content, re.IGNORECASE | re.DOTALL))
                
                if not box_matches:
                    break # このページに画像が1枚もなければ終了
                    
                page_has_new = False
                for box in box_matches:
                    box_html = box.group(1)
                    
                    # 画像IDの抽出 (HTML上のリンクは i 抜きになっている)
                    id_match = re.search(r'/imagemanage/top/icode/(\d+)/', box_html)
                    if not id_match:
                        continue
                    image_id = "i" + id_match.group(1)
                    
                    # すでにキャッシュされていればスキップ
                    if image_id in existing_ids:
                        continue
                    
                    # サムネイル画像のURLとタイトル(alt)の抽出
                    img_match = re.search(r'<img\s+src=["\']([^"\']+)["\']\s+alt=["\']([^"\']*)["\']', box_html, re.IGNORECASE)
                    if not img_match:
                        # 属性の順番が逆のパターン
                        img_match = re.search(r'<img\s+alt=["\']([^"\']*)["\']\s+src=["\']([^"\']+)["\']', box_html, re.IGNORECASE)
                        if img_match:
                            title, src = img_match.group(1), img_match.group(2)
                        else:
                            continue
                    else:
                        src, title = img_match.group(1), img_match.group(2)
                    
                    # キャッシュ処理: サムネイル画像をローカルに保存する
                    ext = os.path.splitext(urllib.parse.urlparse(src).path)[1]
                    if not ext: ext = ".jpg"
                    
                    cache_filename = f"{image_id}{ext}"
                    cache_filepath = os.path.join(CACHE_FOLDER, cache_filename)
                    
                    # キャッシュが存在しなければダウンロード
                    if not os.path.exists(cache_filepath):
                        try:
                            req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0'})
                            with urllib.request.urlopen(req) as response, open(cache_filepath, 'wb') as out_file:
                                out_file.write(response.read())
                        except Exception as e:
                            print(f"[CACHE ERROR] {image_id} のサムネイル取得に失敗: {e}")
                    
                    local_src = f"/static/cache/{cache_filename}"
                    
                    # 新規画像として追加
                    new_images.append({
                        'image_id': image_id,
                        'src': local_src,
                        'original_src': src, # フォールバック用
                        'title': title
                    })
                    existing_ids.add(image_id)
                    page_has_new = True
                
                if not page_has_new:
                    # このページの画像がすべてキャッシュ済みだったので、これ以上古いページを見る必要はない
                    break
                    
                # 次のページへ
                current_page += 1
                time.sleep(1) # サーバー負荷のために1秒待つ

            browser.close()
            
            # キャッシュデータを更新して保存
            updated_cache = new_images + existing_cache
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump({'user_id': user_id, 'images': updated_cache}, f, ensure_ascii=False, indent=2)
                
            return jsonify({
                'status': 'success', 
                'user_id': user_id, 
                'images': updated_cache,
                'new_count': len(new_images)
            })

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/delete', methods=['POST'])
def delete_image():
    login_id = request.form.get('login_id')
    login_password = request.form.get('login_password')
    image_id_full = request.form.get('image_id')  # e.g., "i1109910"
    deletemes = request.form.get('deletemes')
    
    if not login_id or not login_password or not image_id_full or not deletemes:
        return jsonify({'status': 'error', 'message': '必須パラメータが不足しています'})
        
    # Extract numeric part from iXXXXXX e.g. i1109910 -> 1109910
    match = re.search(r'\d+', image_id_full)
    if not match:
        return jsonify({'status': 'error', 'message': '無効な画像IDフォーマットです'})
    image_icode = match.group(0)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch_persistent_context(
                user_data_dir=USER_DATA_DIR,
                headless=False
            )
            page = browser.new_page()
            
            # --- STEP 1: Delete input page ---
            target_url = f"https://mitemin.net/imagemanage/imagedeleteinput/icode/{image_icode}/"
            print(f"[DEBUG Delete] アクセス先: {target_url}")
            page.goto(target_url)
            page.wait_for_load_state("networkidle")
            
            # Login check
            if "login/input" in page.url or "login" in page.url:
                page.locator('input[name="miteminid"]').fill(login_id)
                time.sleep(0.5)
                page.locator('input[name="pass"]').fill(login_password)
                time.sleep(0.5)
                if page.locator('input[name="skip"]').is_visible():
                     page.locator('input[name="skip"]').check()
                page.get_by_role("button", name="LOGIN").click()
                page.wait_for_load_state("networkidle")
                
                page.goto(target_url)
                page.wait_for_load_state("networkidle")
                
                if "login" in page.url:
                    browser.close()
                    return jsonify({'status': 'error', 'message': 'ログインに失敗しました'})

            # --- STEP 2: Fill delete reason and Confirm ---
            try:
                page.locator('textarea[name="deletemes"]').fill(deletemes)
                page.locator('#deleteconf, input[value="削除[確認]"]').click()
                page.wait_for_load_state("networkidle")
            except Exception as inner_e:
                browser.close()
                return jsonify({'status': 'error', 'message': f'削除画面の操作に失敗しました: {str(inner_e)}'})

            # --- STEP 3: Execute Delete ---
            try:
                # Based on mitemin UI logic, usually execution buttons contain '実行' or '削除'
                btn = page.locator('input[value*="削除"], button:has-text("実行"), button:has-text("削除")').first
                if btn.is_visible():
                    btn.click()
                    page.wait_for_load_state("networkidle")
                else:
                    # Fallback
                    page.evaluate('document.forms[0].submit()')
                    page.wait_for_load_state("networkidle")
            except Exception as inner_e:
                browser.close()
                return jsonify({'status': 'error', 'message': f'削除の最終確定に失敗しました: {str(inner_e)}'})

            time.sleep(2) # Throttle to prevent server hammering
            browser.close()
            return jsonify({'status': 'success'})

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

if __name__ == '__main__':
    print("🚀 サーバーを起動します。ブラウザで http://127.0.0.1:5000 にアクセスしてください。")
    app.run(debug=True, port=5000)