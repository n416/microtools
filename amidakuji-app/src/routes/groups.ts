import { Hono } from 'hono';
import { FirestoreClient } from '../utils/firestore-rest';
import { requireAuth } from '../middleware/auth';
import { sign } from 'hono/jwt';
import { generateV4UploadSignedUrl } from '../utils/gcs-signer';
import bcrypt from 'bcryptjs';
import { setCookie, getCookie } from 'hono/cookie';

function generateRandomHex(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const groups = new Hono<{ Bindings: any, Variables: any }>();

groups.get('/groups', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const query = {
      from: [{ collectionId: 'groups' }],
      where: {
        fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: user.targetUserId } }
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }]
    };
    const results = await db.runQuery('', query);
    const groupList = (results || [])
      .filter((r: any) => r.document)
      .map((r: any) => {
        const data = db.firestoreToJson(r.document);
        const nameParts = r.document.name.split('/');
        return { id: nameParts[nameParts.length - 1], ...data };
      });
    return c.json(groupList, 200);
  } catch (error) {
    console.error('Error fetching groups:', error);
    return c.json({ error: 'Failed to fetch groups' }, 500);
  }
});

groups.post('/groups', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { groupName } = await c.req.json();
    if (!groupName) return c.json({ error: 'groupName is required' }, 400);

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const groupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    
    const newGroup = {
      name: groupName,
      ownerId: user.targetUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: { description: '', defaultPrizeCount: 5, defaultPrizes: [] }
    };

    await db.createDocument('groups', groupId, newGroup);
    return c.json({ id: groupId, ...newGroup }, 201);
  } catch (error) {
    console.error('Error creating group:', error);
    return c.json({ error: 'Failed to create group' }, 500);
  }
});

groups.get('/groups/:groupId', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const doc = await db.getDocument(`groups/${groupId}`);
    if (!doc) return c.json({ error: 'Group not found' }, 404);
    
    const groupData = db.firestoreToJson(doc);
    return c.json({ id: groupId, ...groupData }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to fetch group' }, 500);
  }
});

groups.get('/groups/url/:customUrl', async (c) => {
  try {
    const customUrl = c.req.param('customUrl');
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const query = {
      from: [{ collectionId: 'groups' }],
      where: { fieldFilter: { field: { fieldPath: 'customUrl' }, op: 'EQUAL', value: { stringValue: customUrl } } },
      limit: 1
    };
    const results = await db.runQuery('', query);
    if (!results || results.length === 0 || !results[0].document) {
      return c.json({ error: 'Group not found' }, 404);
    }
    const groupDoc = results[0].document;
    const nameParts = groupDoc.name.split('/');
    return c.json({ id: nameParts[nameParts.length - 1], ...db.firestoreToJson(groupDoc) }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to fetch group by custom URL' }, 500);
  }
});

groups.put('/groups/:groupId/settings', requireAuth, async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const user = c.get('user');
    const settings = await c.req.json();
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);

    const doc = await db.getDocument(`groups/${groupId}`);
    if (!doc) return c.json({ error: 'Group not found' }, 404);
    
    const groupData = db.firestoreToJson(doc);
    if (groupData.ownerId !== user.targetUserId) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    const updatedSettings = { ...groupData.settings, ...settings };
    let updatePayload: any = {
      settings: updatedSettings,
      updatedAt: new Date().toISOString()
    };
    if (settings.name && settings.name.trim()) updatePayload.name = settings.name.trim();
    if (settings.customUrl !== undefined) updatePayload.customUrl = settings.customUrl.trim();
    if (settings.noIndex !== undefined) updatePayload.noIndex = !!settings.noIndex;
    if (settings.password) {
      updatePayload.password = await bcrypt.hash(settings.password, 10);
    }
    
    await db.patchDocument(`groups/${groupId}`, updatePayload);

    return c.json({ message: 'Settings updated' }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to update settings' }, 500);
  }
});

groups.delete('/groups/:groupId', requireAuth, async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const user = c.get('user');
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);

    const doc = await db.getDocument(`groups/${groupId}`);
    if (!doc) return c.json({ error: 'Group not found' }, 404);
    
    const groupData = db.firestoreToJson(doc);
    if (groupData.ownerId !== user.targetUserId) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    await db.deleteDocument(`groups/${groupId}`);
    return c.json({ message: 'Group deleted' }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to delete group' }, 500);
  }
});

groups.delete('/groups/:groupId/password', requireAuth, async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const user = c.get('user');
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);

    const doc = await db.getDocument(`groups/${groupId}`);
    if (!doc) return c.json({ error: 'Group not found' }, 404);
    
    const groupData = db.firestoreToJson(doc);
    if (groupData.ownerId !== user.targetUserId) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    // Set password to empty to remove it
    await db.patchDocument(`groups/${groupId}`, { password: "" });
    return c.json({ message: '合言葉を削除しました。' }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to delete password' }, 500);
  }
});

groups.post('/groups/:groupId/login-or-register', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const { name, createIfNotFound, password } = await c.req.json();
    
    if (!name || name === 'undefined') {
      return c.json({ error: 'Name is required' }, 400);
    }

    const normalized = name.trim().replace(/[\s　]+/g, ' ');
    if (!normalized) {
      return c.json({ error: 'Name is required' }, 400);
    }

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);

    const query = {
      from: [{ collectionId: 'members' }],
      where: {
        fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: normalized } }
      }
    };
    
    const results = await db.runQuery(`groups/${groupId}`, query);
    const existing = (results || []).find((r: any) => r.document);

    if (existing) {
      const data = db.firestoreToJson(existing.document);
      const nameParts = existing.document.name.split('/');
      const existingMemberId = nameParts[nameParts.length - 1];

      if (data.password) {
         if (!password) return c.json({ error: 'Password required', requiresPassword: true }, 401);
         const match = await bcrypt.compare(password, data.password);
         if (!match) return c.json({ error: 'Invalid password', requiresPassword: true }, 401);
      }

      return c.json({ message: 'Login successful', memberId: existingMemberId, token: data.deleteToken, name: data.name }, 200);
    }

    // 旧アプリの挙動に合わせ、存在しない場合は常に新規作成する

    const newMemberId = 'member_' + generateRandomHex(8);
    const deleteToken = generateRandomHex(16);
    const newMember = {
      name: normalized,
      createdAt: new Date().toISOString(),
      password: password ? await bcrypt.hash(password, 10) : null,
      deleteToken: deleteToken,
      color: '#007bff', // default color or maybe we should fetch existing to generate one, but this is fine
      iconUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(normalized)}&background=random&color=fff`,
      createdBy: 'user',
      isActive: true,
    };

    await db.createDocument(`groups/${groupId}/members`, newMemberId, newMember);

    return c.json({ message: 'Member registered', memberId: newMemberId, token: deleteToken, name: normalized }, 201);
  } catch (error) {
    return c.json({ error: 'Login or registration failed' }, 500);
  }
});

groups.post('/groups/:groupId/verify-password', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const { password } = await c.req.json();
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);

    const doc = await db.getDocument(`groups/${groupId}`);
    if (!doc) return c.json({ error: 'Group not found' }, 404);
    
    const groupData = db.firestoreToJson(doc);
    const match = groupData.password ? await bcrypt.compare(password, groupData.password) : true;
    if (match) {
      const verifiedStr = getCookie(c, 'verifiedGroups') || '';
      const verifiedGroups = new Set(verifiedStr.split(',').filter(Boolean));
      verifiedGroups.add(groupId);
      setCookie(c, 'verifiedGroups', Array.from(verifiedGroups).join(','), { path: '/', httpOnly: true, secure: true, maxAge: 60 * 60 * 24 * 30, sameSite: 'Lax' });
      return c.json({ message: 'OK', success: true }, 200);
    }
    return c.json({ error: 'Invalid password' }, 401);
  } catch (error) {
    return c.json({ error: 'Verification failed' }, 500);
  }
});

groups.get('/groups/:groupId/prize-masters', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const query = {
      from: [{ collectionId: 'prize-masters' }],
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'ASCENDING' }]
    };
    const results = await db.runQuery(`groups/${groupId}`, query);
    const masters = (results || [])
      .filter((r: any) => r.document)
      .map((r: any) => {
        const data = db.firestoreToJson(r.document);
        const nameParts = r.document.name.split('/');
        return { id: nameParts[nameParts.length - 1], ...data };
      });
    return c.json(masters, 200);
  } catch (error) {
    return c.json({ error: 'Failed to fetch prize masters' }, 500);
  }
});

groups.post('/groups/:groupId/prize-masters', requireAuth, async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const user = c.get('user');
    const { name, imageUrl, rank } = await c.req.json();
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);

    const doc = await db.getDocument(`groups/${groupId}`);
    if (!doc) return c.json({ error: 'Group not found' }, 404);
    
    const groupData = db.firestoreToJson(doc);
    if (groupData.ownerId !== user.targetUserId) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    const masterId = 'prize_' + generateRandomHex(8);
    const newMaster = {
      name,
      imageUrl: imageUrl || '',
      rank: rank || 'common',
      createdAt: new Date().toISOString()
    };

    await db.createDocument(`groups/${groupId}/prize-masters`, masterId, newMaster);
    return c.json({ id: masterId, ...newMaster }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create prize master' }, 500);
  }
});

groups.post('/groups/:groupId/prize-masters/generate-upload-url', requireAuth, async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const { fileType, fileHash } = await c.req.json();
    const user = c.get('user');

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const groupDoc = await db.getDocument(`groups/${groupId}`);
    if (!groupDoc) return c.json({ error: 'Group not found' }, 404);

    const groupData = db.firestoreToJson(groupDoc);
    if (groupData.ownerId !== user.targetUserId) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    const fileExt = fileType.split('/')[1];
    if (!['png', 'jpeg', 'jpg', 'gif', 'webp'].includes(fileExt)) {
      return c.json({ error: 'Invalid file type' }, 400);
    }

    const fileName = `shared_images/${fileHash}.${fileExt}`;
    const bucketName = c.env.GCS_BUCKET_NAME || 'amidakuji-app-native-bucket';

    const signedUrl = await generateV4UploadSignedUrl(
        c.env.FIREBASE_SERVICE_ACCOUNT,
        bucketName,
        fileName,
        fileType,
        15 * 60
    );

    return c.json({
        signedUrl: signedUrl,
        imageUrl: `https://storage.googleapis.com/${bucketName}/${fileName}`
    });
  } catch (error) {
    console.error('generate-upload-url error:', error);
    return c.json({ error: 'Failed to generate upload URL' }, 500);
  }
});

groups.delete('/prize-masters/:masterId', requireAuth, async (c) => {
  try {
    const masterId = c.req.param('masterId');
    const { groupId } = await c.req.json();
    const user = c.get('user');

    if (!groupId) return c.json({ error: 'groupId is required' }, 400);

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const groupDoc = await db.getDocument(`groups/${groupId}`);
    if (!groupDoc) return c.json({ error: 'Group not found' }, 404);
    if (db.firestoreToJson(groupDoc).ownerId !== user.targetUserId) return c.json({ error: 'Permission denied' }, 403);

    await db.deleteDocument(`groups/${groupId}/prize-masters/${masterId}`);
    return c.json({ message: 'Deleted' }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to delete prize master' }, 500);
  }
});

groups.post('/groups/:groupId/cleanup-events', requireAuth, async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const user = c.get('user');
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);

    const groupDoc = await db.getDocument(`groups/${groupId}`);
    if (!groupDoc) return c.json({ error: 'Group not found' }, 404);
    if (db.firestoreToJson(groupDoc).ownerId !== user.targetUserId) return c.json({ error: 'Permission denied' }, 403);

    const membersRes = await db.runQuery(`groups/${groupId}`, { from: [{ collectionId: 'members' }] });
    const existingMemberIds = new Set((membersRes || []).filter((r: any) => r.document).map((r: any) => {
      const p = r.document.name.split('/');
      return p[p.length - 1];
    }));

    const eventsRes = await db.runQuery('', {
      from: [{ collectionId: 'events' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'groupId' }, op: 'EQUAL', value: { stringValue: groupId } } },
            { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'pending' } } }
          ]
        }
      }
    });

    let updatedCount = 0;
    for (const r of (eventsRes || [])) {
      if (!r.document) continue;
      const eventData = db.firestoreToJson(r.document);
      const eNameParts = r.document.name.split('/');
      const eventId = eNameParts[eNameParts.length - 1];
      
      let needsUpdate = false;
      const newParticipants = (eventData.participants || []).map((p: any) => {
        if (p.memberId && !existingMemberIds.has(p.memberId)) {
          needsUpdate = true;
          return { ...p, name: null, memberId: null, iconUrl: null, color: null };
        }
        return p;
      });

      if (needsUpdate) {
        await db.patchDocument(`events/${eventId}`, { participants: newParticipants });
        updatedCount++;
      }
    }

    return c.json({ message: `${updatedCount}件のイベントをクリーンアップしました。` }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to cleanup events' }, 500);
  }
});

export default groups;
