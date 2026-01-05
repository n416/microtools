import os
import shutil
from pathlib import Path

def main():
    print("--- 📦 ディレクトリ構成の最適化（フラット化）を開始します ---")

    # 現在のルートディレクトリ (C:\...\favicons_maker)
    root_dir = Path(".")
    
    # 深くなってしまったディレクトリ
    deep_dir = root_dir / "scripts" / "favicons_maker"

    # 移動対象のファイル群
    targets = ["package.json", "index.js", "README.md", "generate-favicons.js"]

    if not deep_dir.exists():
        print(f"[Info] {deep_dir} が見つかりません。すでに移動済みか、構成が異なります。")
        # 念のため、もしルートにまだ何もないなら確認するロジックを入れてもいいですが
        # ここではシンプルに終了します
        return

    # 1. ファイルをルートに移動
    for filename in targets:
        src_path = deep_dir / filename
        
        # index.js は generate-favicons.js という名前に戻して移動すると分かりやすい
        if filename == "index.js":
            dst_name = "generate-favicons.js"
        else:
            dst_name = filename

        dst_path = root_dir / dst_name

        if src_path.exists():
            # ルートに同名ファイルがある場合はバックアップまたは上書き
            # ここでは上書き移動します
            if dst_path.exists():
                print(f"[Override] ルートの {dst_name} を上書きします。")
                os.remove(dst_path)
            
            shutil.move(str(src_path), str(dst_path))
            print(f"[Move] {filename} -> ./{dst_name}")

    # 2. 不要になった深いフォルダを削除
    # node_modules が深いところにあると重いので削除推奨
    deep_node_modules = deep_dir / "node_modules"
    if deep_node_modules.exists():
        print("[Delete] 古い node_modules を削除しています... (少し時間がかかります)")
        # Windowsでの権限エラー回避のため ignore_errors=True にすることもありますが
        # 基本的にはこれで消します
        shutil.rmtree(deep_node_modules, ignore_errors=True)

    # scripts フォルダごと削除（中に他に重要なものがなければ）
    # 安全のため、scripts/favicons_maker だけ消して、scripts は空なら消す
    shutil.rmtree(deep_dir, ignore_errors=True)
    
    scripts_dir = root_dir / "scripts"
    if scripts_dir.exists() and not any(scripts_dir.iterdir()):
        scripts_dir.rmdir()
        print("[Delete] 空になった scripts フォルダを削除しました。")

    print("\n✅ 完了しました！")
    print("ディレクトリがスッキリしました。以下の手順でセットアップし直してください。")
    print("---------------------------------------------------")
    print("1. npm install               (ルートで依存関係を入れ直す)")
    print("2. node generate-favicons.js (実行コマンドもシンプルになりました)")
    print("---------------------------------------------------")

if __name__ == "__main__":
    main()