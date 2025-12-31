import os

# ターゲットファイルのパス
file_path = os.path.join('src', 'lib', 'exporter.ts')

def apply_patch():
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 変更箇所の定義
    # 1. ループの前でレイヤーの位置情報(position)を取得する変数を定義
    target_1 = "const center = size / 2;"
    replacement_1 = """const center = size / 2;
    const [tx, ty] = layer.position || [0, 0];"""

    # 2. X座標の計算に移動量(tx)を加算
    target_2 = "const x = center + rx;"
    replacement_2 = "const x = center + rx + tx;"

    # 3. Y座標の計算に移動量(ty)を加算
    target_3 = "const y = center + ry;"
    replacement_3 = "const y = center + ry + ty;"

    # パッチの適用確認と実行
    if target_1 not in content:
        print("Warning: Target string 1 not found. Patch might already be applied or file changed.")
        return
    
    new_content = content.replace(target_1, replacement_1)
    new_content = new_content.replace(target_2, replacement_2)
    new_content = new_content.replace(target_3, replacement_3)

    if content == new_content:
        print("No changes were made.")
    else:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Successfully patched {file_path}")

if __name__ == "__main__":
    apply_patch()