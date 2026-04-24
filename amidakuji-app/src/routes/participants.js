import { Hono } from 'hono';
import { FirestoreClient } from '../utils/firestore-rest';
import { requireAuth } from '../middleware/auth';
import { getNextAvailableColor } from '../utils/color';
import bcrypt from 'bcryptjs';
const participants = new Hono();
function generateId(length = 32) {
    const chars = 'abcdef0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
participants.post('/events/:eventId/doodle', async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const { memberId, doodle } = await c.req.json();
        const token = c.req.header('x-auth-token');
        if (!memberId || !doodle || !token) {
            return c.json({ error: '必要な情報が不足しています。' }, 400);
        }
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const eventDoc = await db.getDocument(`events/${eventId}`);
        if (!eventDoc || !eventDoc.name)
            return c.json({ error: 'イベントが見つかりません。' }, 404);
        const eventData = db.firestoreToJson(eventDoc);
        const groupId = eventData.groupId;
        const memberDoc = await db.getDocument(`groups/${groupId}/members/${memberId}`);
        if (!memberDoc || !memberDoc.name) {
            return c.json({ error: '認証に失敗しました。', errorCode: 'INVALID_TOKEN' }, 403);
        }
        const memberData = db.firestoreToJson(memberDoc);
        if (memberData.deleteToken !== token) {
            return c.json({ error: '認証に失敗しました。', errorCode: 'INVALID_TOKEN' }, 403);
        }
        if (!eventData.allowDoodleMode) {
            return c.json({ error: 'このイベントでは落書きモードが許可されていません。' }, 403);
        }
        if (eventData.status !== 'pending') {
            return c.json({ error: 'このイベントは既に開始されているか終了しています。' }, 403);
        }
        const existingDoodles = eventData.doodles || [];
        const otherDoodles = existingDoodles.filter((d) => d.memberId !== memberId);
        const newDoodle = { ...doodle, memberId, createdAt: new Date().toISOString() };
        const allLines = [...(eventData.lines || []), ...otherDoodles];
        const isTooClose = allLines.some((line) => {
            if (line.fromIndex === newDoodle.fromIndex || line.toIndex === newDoodle.fromIndex || line.fromIndex === newDoodle.toIndex) {
                if (Math.abs(line.y - newDoodle.y) < 15)
                    return true;
            }
            return false;
        });
        if (isTooClose)
            return c.json({ error: '他の線に近すぎるため、線を引けません。' }, 400);
        const updatedDoodles = [...otherDoodles, newDoodle];
        await db.patchDocument(`events/${eventId}`, { doodles: updatedDoodles });
        return c.json({ message: '線を追加しました。' }, 200);
    }
    catch (error) {
        console.error('Error adding doodle:', error);
        return c.json({ error: '線の追加処理中にエラーが発生しました。' }, 500);
    }
});
participants.delete('/events/:eventId/doodle', async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const { memberId } = await c.req.json();
        const token = c.req.header('x-auth-token');
        if (!memberId || !token)
            return c.json({ error: '必要な情報が不足しています。' }, 400);
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const eventDoc = await db.getDocument(`events/${eventId}`);
        if (!eventDoc || !eventDoc.name)
            return c.json({ error: 'イベントが見つかりません。' }, 404);
        const eventData = db.firestoreToJson(eventDoc);
        const groupId = eventData.groupId;
        const memberDoc = await db.getDocument(`groups/${groupId}/members/${memberId}`);
        if (!memberDoc || !memberDoc.name)
            return c.json({ error: '認証に失敗しました。', errorCode: 'INVALID_TOKEN' }, 403);
        const memberData = db.firestoreToJson(memberDoc);
        if (memberData.deleteToken !== token)
            return c.json({ error: '認証に失敗しました。', errorCode: 'INVALID_TOKEN' }, 403);
        if (eventData.status !== 'pending')
            return c.json({ error: 'このイベントは既に開始されているか終了しています。' }, 403);
        const doodles = eventData.doodles || [];
        const updatedDoodles = doodles.filter((d) => d.memberId !== memberId);
        await db.patchDocument(`events/${eventId}`, { doodles: updatedDoodles });
        return c.json({ message: '線を削除しました。' }, 200);
    }
    catch (error) {
        console.error('Error deleting doodle:', error);
        return c.json({ error: '線の削除処理中にエラーが発生しました。' }, 500);
    }
});
participants.post('/events/:eventId/join', async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const { name, memberId } = await c.req.json();
        if (!name || name.trim() === '')
            return c.json({ error: '名前は必須です。' }, 400);
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const eventDoc = await db.getDocument(`events/${eventId}`);
        if (!eventDoc || !eventDoc.name)
            return c.json({ error: 'イベントが見つかりません。' }, 404);
        const eventData = db.firestoreToJson(eventDoc);
        const groupId = eventData.groupId;
        let memberData = null;
        let finalMemberId = memberId;
        let token = '';
        if (memberId) {
            const mDoc = await db.getDocument(`groups/${groupId}/members/${memberId}`);
            if (mDoc && mDoc.name) {
                memberData = db.firestoreToJson(mDoc);
            }
        }
        else {
            const query = {
                from: [{ collectionId: 'members' }],
                where: { fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: name.trim() } } },
                limit: 1
            };
            const results = await db.runQuery(`groups/${groupId}`, query);
            if (results && results.length > 0 && results[0].document) {
                memberData = db.firestoreToJson(results[0].document);
                const nameParts = results[0].document.name.split('/');
                finalMemberId = nameParts[nameParts.length - 1];
            }
        }
        if (memberData) {
            if (memberData.password) {
                return c.json({
                    error: '合言葉が必要です。',
                    requiresPassword: true,
                    memberId: finalMemberId,
                    name: memberData.name,
                }, 401);
            }
            token = memberData.deleteToken;
        }
        else {
            finalMemberId = generateId(32);
            token = generateId(32);
            const membersQuery = { from: [{ collectionId: 'members' }] };
            const allMembersRes = await db.runQuery(`groups/${groupId}`, membersQuery);
            const existingColors = (allMembersRes || []).filter((r) => r.document).map((r) => db.firestoreToJson(r.document).color);
            const newColor = getNextAvailableColor(existingColors);
            memberData = {
                id: finalMemberId,
                name: name.trim(),
                password: null,
                deleteToken: token,
                color: newColor,
                iconUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=random&color=fff`,
                isActive: true,
                createdAt: new Date().toISOString(),
            };
            await db.patchDocument(`groups/${groupId}/members/${finalMemberId}`, memberData);
        }
        if (eventData.status !== 'started') {
            const alreadyJoined = (eventData.participants || []).some((p) => p.memberId === finalMemberId);
            if (alreadyJoined) {
                return c.json({
                    message: '既にイベントに参加済みです。',
                    token: token,
                    memberId: finalMemberId,
                    name: memberData.name,
                }, 200);
            }
            const availableSlotIndex = (eventData.participants || []).findIndex((p) => p.name === null);
            if (availableSlotIndex === -1) {
                return c.json({
                    message: 'ログインには成功しましたが、イベントが満員のため参加できませんでした。',
                    token: token,
                    memberId: finalMemberId,
                    name: memberData.name,
                    status: 'event_full',
                }, 200);
            }
            const newParticipants = [...(eventData.participants || [])];
            newParticipants[availableSlotIndex] = {
                ...newParticipants[availableSlotIndex],
                name: memberData.name,
                memberId: finalMemberId,
                iconUrl: memberData.iconUrl,
                color: memberData.color,
            };
            await db.patchDocument(`events/${eventId}`, { participants: newParticipants });
        }
        return c.json({
            message: eventData.status === 'started' ? 'ログインしました。イベントは開始済みのため、結果を確認してください。' : 'イベントに参加しました。',
            token: token,
            memberId: finalMemberId,
            name: memberData.name,
        }, 200);
    }
    catch (error) {
        console.error('Error joining event:', error);
        return c.json({ error: '参加処理中にエラーが発生しました。' }, 500);
    }
});
participants.post('/events/:eventId/join-slot', async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const { memberId, slot } = await c.req.json();
        const token = c.req.header('x-auth-token');
        if (!token)
            return c.json({ error: '認証トークンが必要です。' }, 401);
        if (slot === undefined || slot === null)
            return c.json({ error: '参加枠が指定されていません。' }, 400);
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const eventDoc = await db.getDocument(`events/${eventId}`);
        if (!eventDoc || !eventDoc.name)
            return c.json({ error: 'イベントが見つかりません。' }, 404);
        const eventData = db.firestoreToJson(eventDoc);
        if (eventData.status === 'started')
            return c.json({ error: 'このイベントは既に開始されているため、参加できません。' }, 403);
        const groupId = eventData.groupId;
        const memberDoc = await db.getDocument(`groups/${groupId}/members/${memberId}`);
        if (!memberDoc || !memberDoc.name)
            return c.json({ error: '認証情報が無効です。', errorCode: 'INVALID_TOKEN' }, 403);
        const memberData = db.firestoreToJson(memberDoc);
        if (memberData.deleteToken !== token)
            return c.json({ error: '認証情報が無効です。', errorCode: 'INVALID_TOKEN' }, 403);
        const newParticipants = [...(eventData.participants || [])];
        if (slot < 0 || slot >= newParticipants.length || newParticipants[slot].name !== null) {
            return c.json({ error: 'この参加枠は既に埋まっているか、無効です。' }, 409);
        }
        newParticipants[slot].name = memberData.name;
        newParticipants[slot].memberId = memberId;
        newParticipants[slot].iconUrl = memberData.iconUrl;
        newParticipants[slot].color = memberData.color;
        await db.patchDocument(`events/${eventId}`, { participants: newParticipants });
        return c.json({ message: 'イベントに参加しました。' }, 200);
    }
    catch (error) {
        console.error('Error joining slot:', error);
        return c.json({ error: '参加処理中にエラーが発生しました。' }, 500);
    }
});
participants.post('/events/:eventId/verify-password', async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const { memberId, password, slot } = await c.req.json();
        if (!memberId || !password)
            return c.json({ error: 'IDと合言葉は必須です。' }, 400);
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const eventDoc = await db.getDocument(`events/${eventId}`);
        if (!eventDoc || !eventDoc.name)
            return c.json({ error: 'イベントが見つかりません。' }, 404);
        const eventData = db.firestoreToJson(eventDoc);
        const groupId = eventData.groupId;
        const memberDoc = await db.getDocument(`groups/${groupId}/members/${memberId}`);
        if (!memberDoc || !memberDoc.name)
            return c.json({ error: 'ユーザーが見つかりません。' }, 401);
        const memberData = db.firestoreToJson(memberDoc);
        if (!memberData.password)
            return c.json({ error: 'ユーザーが見つからないか、合言葉が設定されていません。' }, 401);
        const match = await bcrypt.compare(password, memberData.password);
        if (!match)
            return c.json({ error: '合言葉が違います。' }, 401);
        if (slot !== undefined && slot !== null && eventData.status !== 'started') {
            const newParticipants = [...(eventData.participants || [])];
            if (slot < 0 || slot >= newParticipants.length || newParticipants[slot].name !== null) {
                return c.json({ error: 'この参加枠は既に埋まっているか、無効です。' }, 409);
            }
            newParticipants[slot].name = memberData.name;
            newParticipants[slot].memberId = memberId;
            newParticipants[slot].iconUrl = memberData.iconUrl;
            newParticipants[slot].color = memberData.color;
            await db.patchDocument(`events/${eventId}`, { participants: newParticipants });
        }
        return c.json({
            message: 'ログインしました。',
            token: memberData.deleteToken,
            memberId: memberId,
            name: memberData.name,
        }, 200);
    }
    catch (error) {
        console.error('Error verifying password:', error);
        return c.json({ error: '認証中にエラーが発生しました。' }, 500);
    }
});
participants.delete('/events/:eventId/participants', async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const { deleteToken } = await c.req.json();
        if (!deleteToken)
            return c.json({ error: '削除トークンが必要です。' }, 400);
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const eventDoc = await db.getDocument(`events/${eventId}`);
        if (!eventDoc || !eventDoc.name)
            return c.json({ error: 'イベントが見つかりません。' }, 404);
        const eventData = db.firestoreToJson(eventDoc);
        if (eventData.status === 'started')
            return c.json({ error: 'イベント開始後は参加情報を削除できません。' }, 403);
        let memberIdToDelete = null;
        const newParticipants = [...(eventData.participants || [])];
        const participantIndex = newParticipants.findIndex((p) => p.deleteToken === deleteToken); // this was deleteToken originally, but slot logic uses memberId + token. Actually let's just check memberId or deleteToken. In original it was 'deleteToken' inside participant... Wait original participant model doesn't store deleteToken anymore in new code, it's just memberId.
        // Let's adjust to original: it searches participant's deleteToken OR searches members collection for the token.
        // We will find the member by deleteToken in groups/${groupId}/members
        const groupId = eventData.groupId;
        const query = {
            from: [{ collectionId: 'members' }],
            where: { fieldFilter: { field: { fieldPath: 'deleteToken' }, op: 'EQUAL', value: { stringValue: deleteToken } } },
            limit: 1
        };
        const results = await db.runQuery(`groups/${groupId}`, query);
        if (!results || results.length === 0 || !results[0].document) {
            return c.json({ error: '指定された参加者情報が見つかりません。', errorCode: 'INVALID_TOKEN' }, 404);
        }
        const nameParts = results[0].document.name.split('/');
        memberIdToDelete = nameParts[nameParts.length - 1];
        const participantIdx = newParticipants.findIndex((p) => p.memberId === memberIdToDelete);
        if (participantIdx === -1) {
            return c.json({ error: 'イベントに参加していません。' }, 404);
        }
        newParticipants[participantIdx].name = null;
        newParticipants[participantIdx].memberId = null;
        newParticipants[participantIdx].iconUrl = null;
        let updatePayload = { participants: newParticipants };
        if (memberIdToDelete && eventData.doodles && eventData.doodles.length > 0) {
            updatePayload.doodles = eventData.doodles.filter((doodle) => doodle.memberId !== memberIdToDelete);
        }
        await db.patchDocument(`events/${eventId}`, updatePayload);
        return c.json({ message: '参加情報が削除されました。' }, 200);
    }
    catch (error) {
        console.error('Error deleting participant data:', error);
        return c.json({ error: '参加情報の削除中にエラーが発生しました。' }, 500);
    }
});
participants.post('/events/:eventId/acknowledge-result', async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const { memberId } = await c.req.json();
        const token = c.req.header('x-auth-token');
        if (!token || !memberId)
            return c.json({ error: '認証情報が不足しています。' }, 400);
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const eventDoc = await db.getDocument(`events/${eventId}`);
        if (!eventDoc || !eventDoc.name)
            return c.json({ error: 'イベントが見つかりません。' }, 404);
        const eventData = db.firestoreToJson(eventDoc);
        const groupId = eventData.groupId;
        const memberDoc = await db.getDocument(`groups/${groupId}/members/${memberId}`);
        if (!memberDoc || !memberDoc.name)
            return c.json({ error: '認証に失敗しました。', errorCode: 'INVALID_TOKEN' }, 403);
        const memberData = db.firestoreToJson(memberDoc);
        if (memberData.deleteToken !== token)
            return c.json({ error: '認証に失敗しました。', errorCode: 'INVALID_TOKEN' }, 403);
        const participantIndex = (eventData.participants || []).findIndex((p) => p.memberId === memberId);
        if (participantIndex === -1)
            return c.json({ error: 'イベントに参加していません。' }, 404);
        const updatedParticipants = [...(eventData.participants || [])];
        updatedParticipants[participantIndex].acknowledgedResult = true;
        await db.patchDocument(`events/${eventId}`, { participants: updatedParticipants });
        return c.json({ message: '結果を確認しました。' }, 200);
    }
    catch (error) {
        console.error('Error acknowledging result:', error);
        return c.json({ error: '結果の確認処理に失敗しました。' }, 500);
    }
});
participants.post('/events/:eventId/fill-slots', requireAuth, async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const { assignments } = await c.req.json();
        if (!assignments || !Array.isArray(assignments))
            return c.json({ error: '割り当てるメンバーのリストが必要です。' }, 400);
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const eventDoc = await db.getDocument(`events/${eventId}`);
        if (!eventDoc || !eventDoc.name)
            return c.json({ error: 'イベントが見つかりません。' }, 404);
        const eventData = db.firestoreToJson(eventDoc);
        const updatedParticipants = [...(eventData.participants || [])];
        const emptySlotIndices = updatedParticipants.map((p, index) => (p.name === null ? index : -1)).filter(index => index !== -1);
        for (let i = emptySlotIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [emptySlotIndices[i], emptySlotIndices[j]] = [emptySlotIndices[j], emptySlotIndices[i]];
        }
        for (let i = 0; i < assignments.length && i < emptySlotIndices.length; i++) {
            const memberToAssign = assignments[i];
            const slotIndex = emptySlotIndices[i];
            const memberDoc = await db.getDocument(`groups/${eventData.groupId}/members/${memberToAssign.id}`);
            if (memberDoc && memberDoc.name) {
                const memberData = db.firestoreToJson(memberDoc);
                updatedParticipants[slotIndex] = {
                    ...updatedParticipants[slotIndex],
                    memberId: memberToAssign.id,
                    name: memberData.name,
                    color: memberData.color,
                    iconUrl: memberData.iconUrl,
                };
            }
        }
        await db.patchDocument(`events/${eventId}`, { participants: updatedParticipants, lastModifiedAt: new Date().toISOString() });
        return c.json({ message: '参加枠を更新しました。', participants: updatedParticipants }, 200);
    }
    catch (error) {
        console.error('Error filling slots:', error);
        return c.json({ error: '参加枠の更新に失敗しました。' }, 500);
    }
});
export default participants;
