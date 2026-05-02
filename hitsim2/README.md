# HIT2 Equipment Simulator (hitsim2)

HIT2の装備シミュレーターです。装備のステータス計算、セット効果の確認、強化値のシミュレーションなどをブラウザ上で行うことができます。

## 技術スタック
- HTML5 / CSS3 / Vanilla JavaScript
- [Vite](https://vitejs.dev/) - フロントエンドビルドツール
- [Driver.js](https://driverjs.com/) - チュートリアル・ウィザード機能
- [Cloudflare Pages](https://pages.cloudflare.com/) - ホスティング・デプロイ環境

## 開発環境のセットアップ

Node.js（npm）がインストールされていることを確認し、依存パッケージをインストールします。

```bash
npm install
```

## スクリプト一覧

### 開発サーバーの起動

ローカルでの開発・動作確認を行う場合は以下のコマンドを実行します。
（内部で `node build-scripts/sanitize.js` が走り、JSONデータのサニタイズ処理が自動で行われます）

```bash
npm run dev
```

### ビルド（本番用）

本番用の静的ファイルを生成する場合は以下のコマンドを実行します。
生成されたファイルは `dist/` ディレクトリに出力されます。

```bash
npm run build
```

### プレビュー

ビルド後の `dist/` ディレクトリの内容をローカルサーバーでプレビューします。

```bash
npm run preview
```

### デプロイ

Cloudflare Pages へデプロイを行います。
（事前に `npm run build` を実行しておくか、あるいは `package.json` で指定されている設定に基づいてデプロイされます）

```bash
npm run deploy
```

> **Note:** デプロイには [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (`npx wrangler pages deploy`) が使用されます。初回実行時は Cloudflare へのログイン認証が求められる場合があります。

## ディレクトリ構成

- `index.html` : メインのシミュレータ画面
- `data.html` : 装備データの選択・管理画面
- `build-scripts/` : ビルド時に実行される Node.js スクリプト（JSONデータのクリーニング等）
- `dist/` : ビルド結果の出力先（デプロイ対象）
- `.wrangler/` : Cloudflare Pages（Wrangler）の設定・キャッシュディレクトリ
