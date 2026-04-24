import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';

type Env = {
  Bindings: {
    SESSION_SECRET: string;
  };
  Variables: {
    user: any | null; // JWTから復元したユーザー情報
  };
};

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const sessionToken = getCookie(c, 'session');

  if (!sessionToken) {
    c.set('user', null);
    await next();
    return;
  }

  try {
    const payload = await verify(sessionToken, c.env.SESSION_SECRET, "HS256");
    c.set('user', payload);
  } catch (err) {
    c.set('user', null);
  }

  await next();
});

// 管理者権限が必要なルートなどで使うミドルウェアの例
export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.redirect('/?login_error=1');
  }
  await next();
});
