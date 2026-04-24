import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
export const authMiddleware = createMiddleware(async (c, next) => {
    const sessionToken = getCookie(c, 'session');
    console.log('[DEBUG] authMiddleware: session token exists?', !!sessionToken);
    if (!sessionToken) {
        console.log('[DEBUG] authMiddleware: No session token found.');
        c.set('user', null);
        await next();
        return;
    }
    try {
        const payload = await verify(sessionToken, c.env.SESSION_SECRET, "HS256");
        console.log('[DEBUG] authMiddleware: Token verified. targetUserId=', payload.targetUserId);
        c.set('user', payload);
    }
    catch (err) {
        console.error('[DEBUG] authMiddleware: Token verification failed:', err);
        c.set('user', null);
    }
    await next();
});
// 管理者権限が必要なルートなどで使うミドルウェアの例
export const requireAuth = createMiddleware(async (c, next) => {
    const user = c.get('user');
    if (!user) {
        return c.redirect('/?login_error=1');
    }
    await next();
});
