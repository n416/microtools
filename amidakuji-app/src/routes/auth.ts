import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { FirestoreClient } from '../utils/firestore-rest';

const auth = new Hono<{
  Bindings: {
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    SESSION_SECRET: string;
    FIREBASE_SERVICE_ACCOUNT: string;
  }
}>();

// Google OAuthのログイン画面へリダイレクト
auth.get('/google', (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  
  // デプロイ先のURLに合わせてリダイレクトURLを構築（今回はリクエストURLから動的に生成）
  const url = new URL(c.req.url);
  const redirectUri = `${url.origin}/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'profile email',
    access_type: 'online',
    prompt: 'select_account',
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Google OAuthのコールバック処理
auth.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) {
    return c.redirect('/?login_error=1');
  }

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  
  const url = new URL(c.req.url);
  const redirectUri = `${url.origin}/auth/google/callback`;

  try {
    // 1. アクセストークンの取得
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      return c.redirect('/?login_error=1');
    }

    const tokenData = await tokenResponse.json() as any;


    // 2. ユーザー情報の取得
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      return c.redirect('/?login_error=1');
    }

    const profile = await userResponse.json() as any;


    // ---
    // Firestoreにユーザー情報を保存・更新する
    // ---
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    
    // 既存ユーザーの確認
    const existingUser = await db.getDocument(`users/${profile.id}`);
    
    let userRole = 'user';
    if (!existingUser) {
        // 新規ユーザー登録
        const newUser = {
            email: profile.email,
            name: profile.name,
            role: 'user',
            createdAt: new Date().toISOString()
        };
        await db.createDocument('users', profile.id, newUser);

        // デフォルトグループの作成
        const defaultGroup = {
            name: '新規グループ',
            ownerId: profile.id,
            createdAt: new Date().toISOString(),
            participants: []
        };
        const newGroupId = crypto.randomUUID();
        await db.createDocument('groups', newGroupId, defaultGroup);

    } else {
        const userData = db.firestoreToJson(existingUser);
        userRole = userData.role || 'user';

    }

    // 3. JWTセッションの作成
    let verifiedGroups: string[] = [];
    const existingSession = getCookie(c, 'session');
    if (existingSession) {
      try {
        const decoded = await verify(existingSession, c.env.SESSION_SECRET, "HS256");
        if (decoded.verifiedGroups && Array.isArray(decoded.verifiedGroups)) {
          verifiedGroups = decoded.verifiedGroups as string[];
        }
      } catch (e) {
        // invalid token
      }
    }

    // JWTに含めるペイロード
    const payload = {
      targetUserId: profile.id, // パスポート互換
      email: profile.email,
      name: profile.name,
      role: userRole,
      verifiedGroups: verifiedGroups,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14, // 14日間
    };

    const token = await sign(payload, c.env.SESSION_SECRET, "HS256");

    // 4. Cookieに保存してリダイレクト
    setCookie(c, 'session', token, {
      path: '/',
      secure: new URL(c.req.url).protocol === 'https:',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 14, // 14日間
      sameSite: 'Lax',
    });

    return c.redirect('/');

  } catch (error) {
    return c.redirect('/?login_error=1');
  }
});

// ログアウト処理
auth.get('/logout', (c) => {
  deleteCookie(c, 'session', { path: '/' });
  deleteCookie(c, 'verifiedGroups', { path: '/' });
  return c.redirect('/');
});

// 合言葉セッションクリア処理
auth.post('/clear-group-verification', async (c) => {
  try {
    deleteCookie(c, 'verifiedGroups', { path: '/' });
    
    const sessionToken = getCookie(c, 'session');
    if (!sessionToken) {
        return c.json({ success: true });
    }
    
    const payload = await verify(sessionToken, c.env.SESSION_SECRET, "HS256");
    
    // verifiedGroups を空にして再署名
    const newPayload = {
        ...payload,
        verifiedGroups: [],
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14,
    };
    
    const newToken = await sign(newPayload, c.env.SESSION_SECRET, "HS256");
    
    setCookie(c, 'session', newToken, {
      path: '/',
      secure: new URL(c.req.url).protocol === 'https:',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 14,
      sameSite: 'Lax',
    });

    return c.json({ success: true });
  } catch (err) {
      console.error(err);
      return c.json({ success: false, error: 'セッションの更新に失敗しました' }, 500);
  }
});

export default auth;
