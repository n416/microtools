# nekokan2-backend

「NEKO-KAN 2」の共有ルーム機能を支えるバックエンドAPIです。
Cloudflare Workers と D1 (SQLite) を使用して構築されています。

## 主な機能
- **ルームの作成 (`POST /api/rooms`)**: 新しいルームとオーナー権限（owner_token）を発行し、D1に初期状態を保存します。
- **パスワード保護**: パスワードは `Web Crypto API` (SHA-256) によってハッシュ化され、平文では保存されません。
- **データ取得 (`GET /api/rooms/:room_id`)**: 現在のルームの状態を取得します。パスワードが設定されている場合はヘッダー等での認証が必要です。
- **データ更新とマージ (`PUT /api/rooms/:room_id`)**: 
  - オプティミスティック・ロック（Last-Write-Wins）によるバッティング対策を実装。
  - フロントエンドから送られてきた各フィールドの `timestamps` を比較し、新しい時間を持つデータだけを採用して安全にマージ（合成）します。
- **パスワード変更 (`PATCH /api/rooms/:room_id/password`)**: ルーム作成時に発行されたオーナーのみがパスワードを変更できます。

## 開発環境の立ち上げ (ローカル)

```bash
# 依存関係のインストール
npm install

# ローカルデータベースの初期化
npm run db:init

# 開発サーバーの起動 (デフォルトで http://127.0.0.1:8787 が立ち上がります)
npm run dev
```

## 本番環境へのデプロイ手順

1. **D1データベースの作成**
   ```bash
   npx wrangler d1 create nekokan2-db
   ```
2. 発行された `database_id` を `wrangler.toml` に反映させます。
3. **本番データベースへテーブルの作成**
   ```bash
   npx wrangler d1 execute DB --remote --file=./schema.sql
   ```
4. **Cloudflare Workers へデプロイ**
   ```bash
   npm run deploy
   ```
