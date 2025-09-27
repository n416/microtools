import laspy
import numpy as np
import rasterio
from PIL import Image

# --- 設定 ---
# ★★★ ファイル名を自分の環境に合わせて変更してください ★★★
INPUT_LAS_FILE = "downloaded_file.las"

# ★★★ 4つのTIFファイル名をリストとしてすべて記述します ★★★
INPUT_TIF_FILES = [
    "09LD0750.tif",
    "09LD0761.tif",
    "09LD0760.tif",
    "09LD0751.tif"
]

OUTPUT_BINARY_FILE = "points_textured.bin"
THINNING_RATE = 2
# --- ここまで ---

print("--- 点群テクスチャリング処理開始 ---")

try:
    # 1. 4つの航空写真(GeoTIFF)をすべて読み込む
    tif_datasets = []
    for tif_path in INPUT_TIF_FILES:
        print(f"航空写真 '{tif_path}' を読み込んでいます...")
        dataset = rasterio.open(tif_path)
        tif_datasets.append({
            "path": tif_path,
            "dataset": dataset,
            "transform": dataset.transform,
            "width": dataset.width,
            "height": dataset.height,
            "bounds": dataset.bounds # 写真がカバーする座標範囲
        })
        print(f" -> 読み込み完了 (解像度: {dataset.width}x{dataset.height})")

    # 2. 点群(LAS)ファイルを読み込む
    print(f"\n点群 '{INPUT_LAS_FILE}' を読み込んでいます...")
    with laspy.open(INPUT_LAS_FILE) as las_file:
        las = las_file.read()

        # 3. 点群を間引く
        print(f"元の点群数: {len(las.points)}")
        thinned_points = las.points[::THINNING_RATE]
        print(f"間引き後の点群数: {len(thinned_points)}")

        # 4. 座標変換と地面合わせ
        positions = np.vstack((
            thinned_points.x, thinned_points.z, thinned_points.y
        )).transpose().astype(np.float32)
        if positions.size > 0:
            min_y = np.min(positions[:, 1])
            positions[:, 1] -= min_y

        # 5. 各点の色を、対応する写真から取得する
        print("\n各点に対応する色を写真から抽出中...")
        colors = []
        point_coords_x = thinned_points.x
        point_coords_y = thinned_points.y

        # 各TIF画像の画像データを一度だけ読み込む（高速化のため）
        for tif in tif_datasets:
            tif["image_data"] = tif["dataset"].read()

        for i in range(len(point_coords_x)):
            px, py = point_coords_x[i], point_coords_y[i]
            
            found_color = False
            # どの写真の範囲にこの点が含まれるか探す
            for tif in tif_datasets:
                # bounds -> (左, 下, 右, 上)
                if tif["bounds"].left <= px <= tif["bounds"].right and \
                   tif["bounds"].bottom <= py <= tif["bounds"].top:
                    
                    # ピクセル座標に変換
                    rows, cols = rasterio.transform.rowcol(tif["transform"], xs=[px], ys=[py])
                    row, col = rows[0], cols[0]

                    if 0 <= row < tif["height"] and 0 <= col < tif["width"]:
                        r = tif["image_data"][0, row, col]
                        g = tif["image_data"][1, row, col]
                        b = tif["image_data"][2, row, col]
                        colors.append([r, g, b])
                        found_color = True
                        break # 対応する写真を見つけたらループを抜ける
            
            if not found_color:
                colors.append([128, 128, 128]) # どの写真にも属さない点は灰色

        colors_np = np.array(colors, dtype=np.uint8)

        # 6. 最終的なバイナリファイルとして書き出す
        with open(OUTPUT_BINARY_FILE, "wb") as bf:
            bf.write(positions.tobytes())
            bf.write(colors_np.tobytes())
            
        print(f"\n--- 処理完了！ ---")
        print(f"テクスチャ付き点群データを '{OUTPUT_BINARY_FILE}' に保存しました。")

    # 開いたデータセットをすべて閉じる
    for tif in tif_datasets:
        tif["dataset"].close()

except FileNotFoundError as e:
    print(f"\nエラー: ファイルが見つかりません。-> {e.filename}")
    print("LASファイル名や、TIFファイル名・パスが正しいか確認してください。")
except Exception as e:
    print(f"\nエラーが発生しました: {e}")