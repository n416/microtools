import struct
import os

def inspect_ico(file_path):
    print(f"🔎 ファイルを検査中: {file_path}")
    
    if not os.path.exists(file_path):
        print("❌ ファイルが見つかりません。パスを確認してください。")
        return

    with open(file_path, 'rb') as f:
        # ICOヘッダー (6バイト)
        # Reserved(2) + Type(2) + Count(2)
        header = f.read(6)
        if len(header) < 6:
            print("❌ ファイルが壊れているか、ICO形式ではありません。")
            return
        
        reserved, type_val, count = struct.unpack('<HHH', header)
        
        if type_val != 1:
            print("❌ これはICOファイルではありません（ヘッダー不正）。")
            return
            
        print(f"✅ 正常なICOファイルを検出しました。")
        print(f"📦 格納されている画像の枚数: {count} 枚")
        print("-" * 40)
        
        # 各画像の情報を読み取る
        for i in range(count):
            # ディレクトリエントリ (16バイト)
            # Width(1), Height(1), Colors(1), Res(1), Planes(2), BitCount(2), Size(4), Offset(4)
            entry = f.read(16)
            if len(entry) < 16:
                break
                
            width, height, colors, res, planes, bpp, size, offset = struct.unpack('<BBBBHHII', entry)
            
            # 幅・高さが0の場合は256pxを意味する仕様
            w_disp = 256 if width == 0 else width
            h_disp = 256 if height == 0 else height
            
            print(f"  [{i+1}] サイズ: {w_disp} x {h_disp} px / 色深度: {bpp} bit / データサイズ: {size} bytes")

    print("-" * 40)
    if count >= 2:
        print("🎉 マルチアイコンとして生成されています！")
    else:
        print("⚠️ 画像が1枚しか含まれていません。")

if __name__ == "__main__":
    # チェックしたいファイルのパスを指定
    target_file = "favicons_maker/public/icons/favicon.ico"
    
    # 念のためカレントディレクトリ直下のパスも探す
    if not os.path.exists(target_file) and os.path.exists("public/icons/favicon.ico"):
        target_file = "public/icons/favicon.ico"
        
    inspect_ico(target_file)