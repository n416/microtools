import { Hono } from 'hono';
import { FirestoreClient } from '../utils/firestore-rest';
import { requireAuth } from '../middleware/auth';
import { sign } from 'hono/jwt';
import { setCookie } from 'hono/cookie';
const admin = new Hono();
// グループに対するパスワードリセットリクエスト取得
admin.get('/admin/groups/:groupId/password-requests', requireAuth, async (c) => {
    try {
        const { groupId } = c.req.param();
        const user = c.get('user');
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        // グループの所有者か確認
        const groupDoc = await db.getDocument(`groups/${groupId}`);
        if (!groupDoc || !groupDoc.name) {
            return c.json({ error: 'グループが見つかりません。' }, 404);
        }
        const groupData = db.firestoreToJson(groupDoc);
        if (groupData.ownerId !== user.targetUserId) {
            return c.json({ error: '権限がありません。' }, 403);
        }
        const query = {
            from: [{ collectionId: 'passwordResetRequests' }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'groupId' },
                    op: 'EQUAL',
                    value: { stringValue: groupId }
                }
            },
            orderBy: [{
                    field: { fieldPath: 'requestedAt' },
                    direction: 'DESCENDING'
                }]
        };
        const results = await db.runQuery('', query);
        const requests = (results || []).map((item) => {
            if (!item.document)
                return null;
            return {
                id: item.document.name.split('/').pop(),
                ...db.firestoreToJson(item.document)
            };
        }).filter(Boolean);
        return c.json(requests);
    }
    catch (error) {
        console.error('Error fetching password requests:', error);
        return c.json({ error: 'パスワードリセットリクエストの取得に失敗しました。' }, 500);
    }
});
// パスワードリセット承認
admin.post('/admin/members/:memberId/delete-password', requireAuth, async (c) => {
    try {
        const { memberId } = c.req.param();
        const { groupId, requestId } = await c.req.json();
        const user = c.get('user');
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const groupDoc = await db.getDocument(`groups/${groupId}`);
        if (!groupDoc || !groupDoc.name) {
            return c.json({ error: 'グループが見つかりません。' }, 404);
        }
        const groupData = db.firestoreToJson(groupDoc);
        if (groupData.ownerId !== user.targetUserId) {
            return c.json({ error: '権限がありません。' }, 403);
        }
        // パスワードを削除 (ハッシュを消す)
        // participants内の該当メンバーのpasswordHashを削除
        let participants = groupData.participants || [];
        let updated = false;
        participants = participants.map((p) => {
            if (p.id === memberId) {
                delete p.passwordHash;
                updated = true;
            }
            return p;
        });
        if (!updated) {
            return c.json({ error: 'メンバーが見つかりません。' }, 404);
        }
        await db.patchDocument(`groups/${groupId}`, { participants });
        if (requestId) {
            await db.deleteDocument(`passwordResetRequests/${requestId}`);
        }
        return c.json({ message: 'パスワードをリセットしました。' });
    }
    catch (error) {
        console.error('Error deleting password:', error);
        return c.json({ error: 'パスワードリセットに失敗しました。' }, 500);
    }
});
// システム管理者一覧取得
admin.get('/admin/system-admins', requireAuth, async (c) => {
    try {
        const user = c.get('user');
        if (user.role !== 'system_admin') {
            return c.json({ error: '権限がありません。' }, 403);
        }
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const query = {
            from: [{ collectionId: 'users' }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'role' },
                    op: 'EQUAL',
                    value: { stringValue: 'system_admin' }
                }
            }
        };
        const searchId = c.req.query('searchId');
        const results = await db.runQuery('', query);
        let admins = (results || []).map((item) => {
            if (!item.document)
                return null;
            return {
                id: item.document.name.split('/').pop(),
                ...db.firestoreToJson(item.document)
            };
        }).filter(Boolean);
        if (searchId) {
            admins = admins.filter((admin) => admin.id.includes(searchId) || (admin.name && admin.name.includes(searchId)));
        }
        return c.json({ admins, lastVisible: null, hasNextPage: false });
    }
    catch (error) {
        return c.json({ error: '管理者一覧の取得に失敗しました。' }, 500);
    }
});
// グループ管理者一覧取得
admin.get('/admin/group-admins', requireAuth, async (c) => {
    try {
        const user = c.get('user');
        if (user.role !== 'system_admin') {
            return c.json({ error: '権限がありません。' }, 403);
        }
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        // 旧仕様では getGroupAdmins という名前だが実際は全ユーザー一覧を返していたためフィルタなし
        const query = {
            from: [{ collectionId: 'users' }]
        };
        const searchId = c.req.query('searchId');
        const results = await db.runQuery('', query);
        let admins = (results || []).map((item) => {
            if (!item.document)
                return null;
            return {
                id: item.document.name.split('/').pop(),
                ...db.firestoreToJson(item.document)
            };
        }).filter(Boolean);
        if (searchId) {
            admins = admins.filter((admin) => admin.id.includes(searchId) || (admin.name && admin.name.includes(searchId)));
        }
        // とりあえず100件までに制限して返す（インメモリページネーションの代替）
        admins = admins.slice(0, 100);
        return c.json({ admins, lastVisible: null, hasNextPage: false });
    }
    catch (error) {
        return c.json({ error: 'グループ管理者一覧の取得に失敗しました。' }, 500);
    }
});
// システム管理者申請一覧
admin.get('/admin/requests', requireAuth, async (c) => {
    try {
        const user = c.get('user');
        if (user.role !== 'system_admin') {
            return c.json({ error: '権限がありません。' }, 403);
        }
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const query = {
            from: [{ collectionId: 'adminRequests' }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'status' },
                    op: 'EQUAL',
                    value: { stringValue: 'pending' }
                }
            }
        };
        const results = await db.runQuery('', query);
        const requests = (results || []).map((item) => {
            if (!item.document)
                return null;
            return {
                id: item.document.name.split('/').pop(),
                ...db.firestoreToJson(item.document)
            };
        }).filter(Boolean);
        return c.json(requests);
    }
    catch (error) {
        return c.json({ error: '申請一覧の取得に失敗しました。' }, 500);
    }
});
// 管理者申請の作成
admin.post('/admin/request', requireAuth, async (c) => {
    try {
        const user = c.get('user');
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const requestData = {
            userId: user.targetUserId,
            email: user.email,
            name: user.name,
            status: 'pending',
            requestedAt: new Date().toISOString()
        };
        const newId = crypto.randomUUID();
        await db.createDocument('adminRequests', newId, requestData);
        return c.json({ message: '管理者権限を申請しました。' });
    }
    catch (error) {
        return c.json({ error: '申請に失敗しました。' }, 500);
    }
});
// 管理者申請の承認
admin.post('/admin/approve', requireAuth, async (c) => {
    try {
        const user = c.get('user');
        if (user.role !== 'system_admin')
            return c.json({ error: '権限がありません。' }, 403);
        const { requestId } = await c.req.json();
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const requestDoc = await db.getDocument(`adminRequests/${requestId}`);
        if (!requestDoc || !requestDoc.name)
            return c.json({ error: '申請が見つかりません。' }, 404);
        const reqData = db.firestoreToJson(requestDoc);
        // 対象ユーザーをシステム管理者にする（元の仕様に従う）
        await db.patchDocument(`users/${reqData.userId}`, { role: 'system_admin' });
        // 申請を承認済みに
        await db.patchDocument(`adminRequests/${requestId}`, { status: 'approved' });
        return c.json({ message: '承認しました。' });
    }
    catch (error) {
        return c.json({ error: '承認に失敗しました。' }, 500);
    }
});
// 管理者権限の剥奪
admin.post('/admin/demote', requireAuth, async (c) => {
    try {
        const user = c.get('user');
        if (user.role !== 'system_admin')
            return c.json({ error: '権限がありません。' }, 403);
        const { userId } = await c.req.json();
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const currentAdminId = user.isImpersonating ? user.originalAdminId : user.targetUserId;
        if (userId === currentAdminId) {
            return c.json({ error: '自分自身を降格させることはできません。' }, 400);
        }
        await db.patchDocument(`users/${userId}`, { role: 'user' });
        return c.json({ message: '権限を剥奪しました。' });
    }
    catch (error) {
        return c.json({ error: '権限の剥奪に失敗しました。' }, 500);
    }
});
// なりすまし開始
admin.post('/admin/impersonate', requireAuth, async (c) => {
    try {
        const user = c.get('user');
        if (user.role !== 'system_admin')
            return c.json({ error: '権限がありません。' }, 403);
        const { targetUserId } = await c.req.json();
        const originalAdminId = user.isImpersonating ? user.originalAdminId : user.targetUserId;
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const targetUserDoc = await db.getDocument(`users/${targetUserId}`);
        if (!targetUserDoc)
            return c.json({ error: '対象ユーザーが見つかりません。' }, 404);
        const targetData = db.firestoreToJson(targetUserDoc);
        const payload = {
            targetUserId: targetUserId,
            email: targetData.email,
            name: targetData.name,
            role: targetData.role || 'user',
            verifiedGroups: [], // なりすまし時はクリア
            originalAdminId: originalAdminId,
            isImpersonating: true,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14,
        };
        const token = await sign(payload, c.env.SESSION_SECRET, "HS256");
        setCookie(c, 'session', token, {
            path: '/',
            secure: new URL(c.req.url).protocol === 'https:',
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 14,
            sameSite: 'Lax',
        });
        return c.json({ message: '成り代わりを開始します。' });
    }
    catch (error) {
        return c.json({ error: '成り代わり設定に失敗しました。' }, 500);
    }
});
// なりすまし解除
admin.post('/admin/stop-impersonating', requireAuth, async (c) => {
    try {
        const user = c.get('user');
        if (!user.isImpersonating)
            return c.json({ error: '現在成り代わり中ではありません。' }, 400);
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const originalAdminDoc = await db.getDocument(`users/${user.originalAdminId}`);
        if (!originalAdminDoc)
            return c.json({ error: '元の管理者アカウントが見つかりません。' }, 404);
        const adminData = db.firestoreToJson(originalAdminDoc);
        const payload = {
            targetUserId: user.originalAdminId,
            email: adminData.email,
            name: adminData.name,
            role: adminData.role || 'user',
            verifiedGroups: [],
            isImpersonating: false,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14,
        };
        const token = await sign(payload, c.env.SESSION_SECRET, "HS256");
        setCookie(c, 'session', token, {
            path: '/',
            secure: new URL(c.req.url).protocol === 'https:',
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 14,
            sameSite: 'Lax',
        });
        return c.json({ message: '成り代わりを解除しました。' });
    }
    catch (error) {
        return c.json({ error: '成り代わり解除に失敗しました。' }, 500);
    }
});
export default admin;
