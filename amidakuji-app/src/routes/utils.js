import { Hono } from 'hono';
const utilsRouter = new Hono();
const DEFAULT_IMAGE_URL = 'https://storage.googleapis.com/amidakuji-app-native.appspot.com/default-ogp.png';
// 外部アバター画像取得のプロキシ (CORS対策等)
utilsRouter.get('/avatar-proxy', async (c) => {
    try {
        const name = c.req.query('name');
        if (!name) {
            return c.json({ error: 'Name is required' }, 400);
        }
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
        const response = await fetch(avatarUrl);
        if (!response.ok) {
            return c.json({ error: 'Failed to fetch avatar' }, 500);
        }
        const buffer = await response.arrayBuffer();
        return c.body(buffer, 200, {
            'Content-Type': response.headers.get('content-type') || 'image/png',
            'Cache-Control': 'public, max-age=86400'
        });
    }
    catch (error) {
        return c.json({ error: 'Proxy error' }, 500);
    }
});
// OGP画像の動的生成 (Cloudflare Workers版)
// ※Edge環境では sharp による動的ブラー(ぼかし)処理が実行できないため、
// 代替としてデフォルトのOGP画像を返す（ネタバレ防止策）か、
// 事前にCloudflare Images等の画像リサイズ機能を通す必要があります。
// 現状は安全のため、一律でデフォルト画像を返却します。
utilsRouter.get('/share/:eventId/:participantName/ogp.png', async (c) => {
    try {
        const { eventId, participantName } = c.req.param();
        const decodedParticipantName = decodeURIComponent(participantName);
        // ネタバレ防止のため、本来は当落結果の画像にブラーを掛けていましたが、
        // Edge環境でのsharp非対応のため、デフォルト画像を返却します。
        return c.redirect(DEFAULT_IMAGE_URL);
    }
    catch (error) {
        console.error('OGP Image Error:', error);
        return c.redirect(DEFAULT_IMAGE_URL);
    }
});
export default utilsRouter;
