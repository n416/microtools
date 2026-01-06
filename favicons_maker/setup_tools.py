import os
import re
import json

def patch_package_json():
    print("📦 package.json の依存関係を更新しています...")
    try:
        with open("package.json", "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # to-ico を削除し、png-to-ico を追加
        if "dependencies" in data:
            if "to-ico" in data["dependencies"]:
                del data["dependencies"]["to-ico"]
            # png-to-ico のバージョン指定 (最新安定版付近)
            data["dependencies"]["png-to-ico"] = "^2.1.8"
            
        with open("package.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("✅ package.json を更新しました。")
    except Exception as e:
        print(f"❌ package.json の更新に失敗しました: {e}")

def patch_js_file():
    print("📜 generate-favicons.js のコードを書き換えています...")
    js_path = "generate-favicons.js"
    
    if not os.path.exists(js_path):
        print(f"❌ {js_path} が見つかりません。")
        return

    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. require の書き換え
    if "require('to-ico')" in content:
        content = content.replace("require('to-ico')", "require('png-to-ico')")
        content = content.replace("const toIco", "const pngToIco")
        print("   - require文を置換しました。")

    # 2. ICO生成ロジックの書き換え
    # 正規表現で「4. 手打ち画像の適用処理」から「警告」が出る部分までのブロックを特定して置換
    # png-to-ico はファイルパスの配列を受け取る仕様のため、ロジックをそれに合わせます
    
    new_logic = """        // 4. 手打ち画像の適用処理 (png-to-ico版)
        if (fs.existsSync(PIXEL_IMAGE)) {
            // png-to-ico はファイルパスの配列を受け取ります
            const inputs = [PIXEL_IMAGE]; // 16px (優先)

            // 自動生成された32pxがあれば追加してマルチアイコン化
            const icon32Path = path.join(OUTPUT_DIR, 'favicon-32x32.png');
            if (fs.existsSync(icon32Path)) {
                inputs.push(icon32Path);
            }

            try {
                // png-to-ico で生成
                const icoBuffer = await pngToIco(inputs);
                fs.writeFileSync(path.join(OUTPUT_DIR, 'favicon.ico'), icoBuffer);
                console.log('✨ favicon.ico generated with png-to-ico (clean dependencies).');
            } catch (err) {
                console.error('❌ Failed to generate ico:', err);
            }

            fs.copyFileSync(PIXEL_IMAGE, path.join(OUTPUT_DIR, 'favicon-16x16.png'));
            console.log('✨ favicon-16x16.png overwritten.');
        } else {
            console.warn(`⚠️ Manual source not found at ${PIXEL_IMAGE}.`);
        }"""

    # 置換対象のパターン（前回の修正有無に関わらずマッチするように広めに取る）
    pattern = r"// 4\. 手打ち画像の適用処理[\s\S]*?console\.warn.*?\n\s+}"
    
    match = re.search(pattern, content)
    if match:
        content = content.replace(match.group(0), new_logic)
        print("   - ICO生成ロジックを png-to-ico 用に更新しました。")
    else:
        print("⚠️ 置換対象のコードブロックが見つかりませんでした。すでに変更されている可能性があります。")

    with open(js_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("✅ generate-favicons.js を保存しました。")

def main():
    patch_package_json()
    patch_js_file()
    print("\n🎉 パッチ適用完了！ 以下のコマンドを実行して依存関係を更新してください:")
    print("---------------------------------------------------")
    print("npm install")
    print("node generate-favicons.js")
    print("---------------------------------------------------")

if __name__ == "__main__":
    main()