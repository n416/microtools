import os
import json

# config.pyが存在するディレクトリ(tools/mitemin)
DEFAULT_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(DEFAULT_BASE_DIR, 'config.json')

config_data = {}
if os.path.exists(CONFIG_FILE):
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
    except Exception as e:
        print(f"[Warning] config.jsonの読み込みに失敗しました: {e}")

# 親から指定されたディレクトリがあればそれを使用（優先順位: 環境変数 > config.json > デフォルト(tools/mitemin)）
raw_base_dir = os.environ.get('MITEMIN_DATA_DIR') or config_data.get('MITEMIN_DATA_DIR') or DEFAULT_BASE_DIR

# もし相対パスが指定されていた場合、config.pyのディレクトリを基準として絶対パスに変換する
if not os.path.isabs(raw_base_dir):
    BASE_DATA_DIR = os.path.abspath(os.path.join(DEFAULT_BASE_DIR, raw_base_dir))
else:
    BASE_DATA_DIR = raw_base_dir

# 各種ディレクトリへのパス解決
UPLOAD_FOLDER = os.path.join(BASE_DATA_DIR, 'uploads')
CACHE_FOLDER = os.path.join(BASE_DATA_DIR, 'static', 'cache')
CACHE_FILE = os.path.join(CACHE_FOLDER, 'image_list.json')
USER_DATA_DIR = os.path.join(BASE_DATA_DIR, 'playwright_profile')

# ディレクトリの自動生成（存在しない場合は作成）
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CACHE_FOLDER, exist_ok=True)
