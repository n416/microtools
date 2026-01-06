# Favicons Maker

WebアプリやPWA用のアイコン一式を、**高解像度ロゴ**と**手打ちドット絵**を組み合わせて生成するツールです。
依存関係の問題を解決し、`png-to-ico` と `sharp` を使用したクリーンな構成になっています。

## 🚀 特徴

* **ハイブリッド生成**: スマホ用などの高解像度アイコンは `src/logo-300px.png` から自動生成します。
* **ドット絵優先**: PCタブブラウザ用(`16px`, `32px`)は `src/icon-16px.png` を優先使用します。
* **クリスプな拡大**: 16pxのドット絵を **Nearest Neighbor法** でくっきりと32pxに拡大し、ぼやけを防ぎます。
* **マルチアイコン**: `favicon.ico` には16pxと32pxの両方を格納しています（透明表示バグ対策済み）。

## 📂 ディレクトリ構成

```text
favicons_maker/
├── src/
│   ├── logo-300px.png   # [入力] 高画質メイン画像
│   └── icon-16px.png    # [入力] 16px手打ちドット絵
├── public/
│   └── icons/           # [出力] 生成物はここに出力されます
├── generate-favicons.js # 生成スクリプト
└── package.json
```

## 🛠 セットアップ

```bash
npm install
```

## ⚡ 使い方

プロジェクトルートで以下のコマンドを実行してください。

```bash
node generate-favicons.js
```

実行後、`public/icons` フォルダに以下のファイルが生成されます。

* `favicon.ico` (マルチサイズ)
* `favicon-16x16.png`, `favicon-32x32.png`
* `apple-touch-icon.png` (iOS用)
* `android-chrome-*.png` (Android用)
* `manifest.webmanifest`
* `index.html` (headタグのサンプル)
