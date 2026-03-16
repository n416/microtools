from bs4 import BeautifulSoup
import re

html_path = 'mitemin_list.html'
try:
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()
        
    soup = BeautifulSoup(html, 'html.parser')
    
    # ユーザーIDを抽出
    user_id_match = re.search(r'mitemin\.net/user(?:page)?/(?:top/)?(\d{4,8})', html)
    if not user_id_match:
         user_id_match = re.search(r'https?://(\d{4,8})\.mitemin\.net', html)
    user_id = user_id_match.group(1) if user_id_match else "unknown"
    
    # 画像リストを取得（aタグからの抽出等が必要そう）
    print("--- リンク一覧 ---")
    links = soup.find_all('a', href=re.compile(r'/image(?:manage|upload|view)/(?:top|icamp|view)/(?:icode/)?i\d+'))
    for link in links[:15]:
        href = link.get('href')
        img = link.find('img')
        img_src = img.get('src') if img else "画像なし"
        title = img.get('alt') if img else "タイトルなし"
        
        # URLから画像IDを抽出
        id_match = re.search(r'(i\d{5,8})', href)
        image_id = id_match.group(1) if id_match else "ID不明"
        
        print(f"ID: {image_id}, Title: {title}, Image: {img_src}")
        
    print(f"User ID: {user_id}")
        
except Exception as e:
    print(f"Error: {e}")
