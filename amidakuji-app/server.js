const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');

// 秘密情報を取得し、環境変数に設定する非同期関数
async function setupSecrets() {
  // ローカル環境の場合は .env ファイルを読み込む
  if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
    return; // ローカルではSecret Managerを使わない
  }

  const client = new SecretManagerServiceClient();
  const projectId = 'amidakuji-app-native'; // ご自身のプロジェクトID

  const secrets = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'SESSION_SECRET', 'GCS_BUCKET_NAME'];

  for (const secretName of secrets) {
    try {
      const [version] = await client.accessSecretVersion({
        name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
      });
      process.env[secretName] = version.payload.data.toString();
    } catch (error) {
      console.error(`シークレット '${secretName}' の取得に失敗しました。`, error);
      // エラーが発生しても処理を続行するが、ログには残す
    }
  }
}

// サーバーを起動するメインの非同期関数
async function startServer() {
  await setupSecrets(); // 秘密情報の設定が終わるまで待つ

  // --- ここから下は元の server.js の内容 ---
  const express = require('express');
  const path = require('path');
  const session = require('express-session');
  const passport = require('passport');
  const {emojiToLucide, emojiMap} = require('./utils/emoji-map'); // ★ emoji-mapをインポート
  const {firestore} = require('./utils/firestore');
  const {FirestoreStore} = require('@google-cloud/connect-firestore');

  // Passport設定の読み込み
  require('./config/passport')(passport);

  const app = express();
  app.set('trust proxy', 1); // プロキシ設定
  const port = process.env.PORT || 3000;

  // EJS設定
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Expressのapp.localsにヘルパー関数とデータを設定
  // これにより、すべてのテンプレートでグローバルに利用可能になる
  app.locals.emojiToLucide = emojiToLucide;
  app.locals.emojiMapJSON = JSON.stringify(Array.from(emojiMap.entries()));

  // 静的ファイルとJSONパーサーのミドルウェア
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.json());

  // ▼▼▼ 今ある session の設定を、丸ごとこれに置き換える ▼▼▼
  app.use(
    session({
      store: new FirestoreStore({
        dataset: firestore,
        collection: 'sessions',
      }),
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
      cookie: {secure: process.env.NODE_ENV === 'production', maxAge: 14 * 24 * 60 * 60 * 1000}, // 2週間
    })
  );
  // ▲▲▲ ここまで ▲▲▲

  app.use(passport.initialize());
  app.use(passport.session());

  // --- ルートのインポートとマウント ---
  const indexRoutes = require('./routes/index');
  const authRoutes = require('./routes/auth');
  const userRoutes = require('./routes/users');
  const groupRoutes = require('./routes/groups');
  const eventRoutes = require('./routes/events');
  const adminRoutes = require('./routes/admin');

  // 各ルーターに正しいプレフィックスを付けてマウントします
  app.use('/auth', authRoutes);
  app.use('/api', userRoutes);
  app.use('/api', groupRoutes);
  app.use('/api', eventRoutes);
  app.use('/api', adminRoutes);
  app.use('/', indexRoutes); // ページ表示などのルートは最後に配置

  // --- エラーハンドリング ---
  process.on('unhandledRejection', (reason, promise) => {
    console.error('致命的なエラー (unhandledRejection):', promise, '理由:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('致命的なエラー (uncaughtException):', err);
  });

  // --- サーバー起動 ---
  app.listen(port, () => {
    console.log(`✅ サーバーが起動しました: http://localhost:${port}`);
  });
}

// --- サーバー起動の実行 ---
startServer().catch((err) => {
  console.error('致命的なエラー: サーバーの起動に失敗しました。', err);
  process.exit(1);
});
