require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session'); // ★★★★★ ここを修正しました ★★★★★
const passport = require('passport');

// Passport設定の読み込み
require('./config/passport')(passport);

const app = express();
const port = process.env.PORT || 3000;

// EJS設定
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 静的ファイルとJSONパーサーのミドルウェア
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// セッションとPassportのミドルウェア
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {secure: process.env.NODE_ENV === 'production'},
  })
);
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
app.use('/', indexRoutes);   // ページ表示などのルートは最後に配置


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