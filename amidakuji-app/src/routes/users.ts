import { Hono } from 'hono';
import { FirestoreClient } from '../utils/firestore-rest';
import { requireAuth } from '../middleware/auth';
import { generateAnonymousName } from '../utils/nameGenerator'; // 後で移行する
import { deleteCookie } from 'hono/cookie';

const users = new Hono<{
  Bindings: {
    FIREBASE_SERVICE_ACCOUNT: string;
  };
  Variables: {
    user: any;
  };
}>();

// 自身の情報を取得する
users.get('/user/me', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(null);
  }

  const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
  
  // セッションのデータに加えて最新の状態を付与する
  const currentUserData = { ...user };
  currentUserData.anonymousName = generateAnonymousName(user.targetUserId);
  currentUserData.id = user.targetUserId; // フロントエンドとの互換性のため
  if (user.isImpersonating && user.originalAdminId) {
    currentUserData.originalUser = { id: user.originalAdminId };
  }

  if (user.role === 'user') {
    const requestDoc = await db.getDocument(`adminRequests/${user.targetUserId}`);
    if (requestDoc && requestDoc.fields?.status?.stringValue === 'pending') {
      currentUserData.adminRequestStatus = 'pending';
    }
  }

  return c.json(currentUserData);
});

// 最後に使用したグループを更新
users.post('/user/me/last-group', requireAuth, async (c) => {
  try {
    const { groupId } = await c.req.json();
    if (!groupId) {
      return c.json({ error: 'Group ID is required.' }, 400);
    }

    const user = c.get('user');
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    
    await db.patchDocument(`users/${user.targetUserId}`, { lastUsedGroupId: groupId }, ['lastUsedGroupId']);
    
    return c.json({ message: 'Last used group updated.' });
  } catch (error) {
    console.error('Error updating last used group:', error);
    return c.json({ error: 'Failed to update last used group.' }, 500);
  }
});

// アカウントの削除
users.delete('/user/me', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.targetUserId;
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);

    // TODO: 本来はここで関連するグループ、イベント等の削除を行うが
    // バッチ削除(Firestore REST APIのcommit)が必要になるため、後ほど実装を充実させる
    
    // ユーザー自身とadminRequestの削除
    try { await db.deleteDocument(`users/${userId}`); } catch (e) {}
    try { await db.deleteDocument(`adminRequests/${userId}`); } catch (e) {}

    deleteCookie(c, 'session');

    return c.json({ message: 'アカウントが正常に削除されました。' });
  } catch (error) {
    console.error('Error deleting user account:', error);
    return c.json({ error: 'アカウントの削除に失敗しました。' }, 500);
  }
});

export default users;
