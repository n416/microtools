import { Hono } from 'hono';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import groupsRouter from './routes/groups';
import eventsRouter from './routes/events';
import adminRouter from './routes/admin';
import membersRouter from './routes/members';
import { authMiddleware } from './middleware/auth';
import { cors } from 'hono/cors';
const app = new Hono();
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    credentials: true,
}));
// すべてのルートで認証ミドルウェアを適用
app.use('*', authMiddleware);
// ヘルスチェック
app.get('/_ah/warmup', (c) => {
    return c.text('OK');
});
app.get('/api/test', (c) => {
    const user = c.get('user');
    return c.json({ message: 'Hello from Hono!', user });
});
import participantsRouter from './routes/participants';
import publicRouter from './routes/public';
import utilsRouter from './routes/utils';
// ルートのマウント
app.route('/auth', authRouter);
app.route('/api', usersRouter);
app.route('/api', groupsRouter);
app.route('/api', eventsRouter);
app.route('/api', adminRouter);
app.route('/api', membersRouter);
app.route('/api', participantsRouter);
app.route('/api', publicRouter);
app.route('/api', utilsRouter);
// フロントエンド向け初期化設定API
app.get('/api/config', (c) => {
    try {
        const config = JSON.parse(c.env.FIREBASE_CONFIG);
        return c.json(config);
    }
    catch (e) {
        return c.json({}, 500);
    }
});
app.get('/api/emoji-map', (c) => {
    const emojiMap = [
        { emoji: '🏠', lucide: 'home' },
        { emoji: '👤', lucide: 'user' },
        { emoji: '▼', lucide: 'chevron-down' },
        { emoji: '❓', lucide: 'help-circle' },
    ];
    return c.json(emojiMap);
});
// SPAのフォールバックルーティング
app.get('*', async (c) => {
    if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/auth/')) {
        return c.json({ error: 'Not Found' }, 404);
    }
    const url = new URL(c.req.url);
    url.pathname = '/';
    const req = new Request(url, c.req.raw);
    return c.env.ASSETS.fetch(req);
});
export default app;
