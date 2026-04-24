import { Hono } from 'hono';
import { FirestoreClient } from '../utils/firestore-rest';
import { requireAuth } from '../middleware/auth';
import { generateV4UploadSignedUrl } from '../utils/gcs-signer';
import { getNextAvailableColor } from '../utils/color';
import bcrypt from 'bcryptjs';

const members = new Hono<{ Bindings: any; Variables: any; }>();

function generateRandomHex(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeName(name: string): string {
  if (!name) return '';
  return name.trim().replace(/[\s　]+/g, ' ');
}

// Simple Levenshtein distance
function levenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

// --- User Profile Endpoints (Phase 2) ---

members.get('/members/:memberId', async (c) => {
  try {
    const memberId = c.req.param('memberId');
    const groupId = c.req.query('groupId');
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    if (!groupId) return c.json({ error: 'GroupId required' }, 400);
    
    const doc = await db.getDocument(`groups/${groupId}/members/${memberId}`);
    if (!doc || !doc.name) return c.json({ error: 'Member not found' }, 404);
    
    const memberData = db.firestoreToJson(doc);
    const sanitizedMember = { ...memberData, id: memberId };
    delete sanitizedMember.password;
    delete sanitizedMember.deleteToken;
    return c.json(sanitizedMember, 200);
  } catch (error) {
    return c.json({ error: 'Error fetching member' }, 500);
  }
});

members.put('/members/:memberId/profile', async (c) => {
  try {
    const memberId = c.req.param('memberId');
    const { groupId, name, color, iconUrl } = await c.req.json();
    const token = c.req.header('x-auth-token');
    if (!groupId || !token) return c.json({ error: 'Unauthorized' }, 401);

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const doc = await db.getDocument(`groups/${groupId}/members/${memberId}`);
    if (!doc) return c.json({ error: 'Member not found' }, 404);

    const memberData = db.firestoreToJson(doc);
    if (memberData.deleteToken !== token) return c.json({ error: 'Unauthorized' }, 403);

    const updatePayload: any = {};
    if (name) updatePayload.name = normalizeName(name);
    if (color) updatePayload.color = color;
    if (iconUrl !== undefined) updatePayload.iconUrl = iconUrl;

    await db.patchDocument(`groups/${groupId}/members/${memberId}`, updatePayload);
    return c.json({ message: 'Profile updated' }, 200);
  } catch (error) {
    return c.json({ error: 'Error updating profile' }, 500);
  }
});

members.post('/members/:memberId/set-password', async (c) => {
  try {
    const memberId = c.req.param('memberId');
    const { groupId, password } = await c.req.json();
    const token = c.req.header('x-auth-token');
    if (!groupId || !token || !password) return c.json({ error: 'Missing info' }, 400);

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const doc = await db.getDocument(`groups/${groupId}/members/${memberId}`);
    if (!doc) return c.json({ error: 'Member not found' }, 404);

    const memberData = db.firestoreToJson(doc);
    if (memberData.deleteToken !== token) return c.json({ error: 'Unauthorized' }, 403);

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.patchDocument(`groups/${groupId}/members/${memberId}`, { password: hashedPassword });
    return c.json({ message: 'Password set' }, 200);
  } catch (error) {
    return c.json({ error: 'Error setting password' }, 500);
  }
});

members.delete('/members/:memberId', async (c) => {
  try {
    const memberId = c.req.param('memberId');
    const { groupId } = await c.req.json();
    const token = c.req.header('x-auth-token');
    if (!groupId || !token) return c.json({ error: 'Unauthorized' }, 401);

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const doc = await db.getDocument(`groups/${groupId}/members/${memberId}`);
    if (!doc) return c.json({ error: 'Member not found' }, 404);

    const memberData = db.firestoreToJson(doc);
    if (memberData.deleteToken !== token) return c.json({ error: 'Unauthorized' }, 403);

    await db.deleteDocument(`groups/${groupId}/members/${memberId}`);
    return c.json({ message: 'Account deleted' }, 200);
  } catch (error) {
    return c.json({ error: 'Error deleting account' }, 500);
  }
});

members.post('/members/:memberId/request-password-deletion', async (c) => {
  try {
    const memberId = c.req.param('memberId');
    const { groupId } = await c.req.json();
    if (!groupId) return c.json({ error: 'Missing info' }, 400);

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const doc = await db.getDocument(`groups/${groupId}/members/${memberId}`);
    if (!doc) return c.json({ error: 'Member not found' }, 404);

    // Create a request in admin dashboard (simplified logic)
    const requestId = 'req_' + generateRandomHex(8);
    await db.createDocument(`admin-requests`, requestId, {
      type: 'password_reset',
      groupId,
      memberId,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    return c.json({ message: 'Request sent' }, 200);
  } catch (error) {
    return c.json({ error: 'Error requesting reset' }, 500);
  }
});

members.post('/members/:memberId/generate-upload-url', async (c) => {
  try {
    const memberId = c.req.param('memberId');
    const { fileType, fileHash } = await c.req.json();
    const fileExt = fileType.split('/')[1];
    if (!['png', 'jpeg', 'jpg', 'gif', 'webp'].includes(fileExt)) {
      return c.json({ error: "Invalid type" }, 400);
    }
    const fileName = `shared_images/${fileHash}.${fileExt}`;
    const bucketName = c.env.GCS_BUCKET_NAME || 'amidakuji-app-native-bucket';
    const signedUrl = await generateV4UploadSignedUrl(c.env.FIREBASE_SERVICE_ACCOUNT, bucketName, fileName, fileType, 15 * 60);
    return c.json({
      signedUrl: signedUrl,
      imageUrl: `https://storage.googleapis.com/${bucketName}/${fileName}`
    });
  } catch (error) {
    return c.json({ error: "Error generating URL" }, 500);
  }
});


// --- Group Members Management (Phase 1) ---

members.get('/groups/:groupId/members', requireAuth, async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const user = c.get('user');
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const groupDoc = await db.getDocument(`groups/${groupId}`);
    if (!groupDoc || db.firestoreToJson(groupDoc).ownerId !== user.targetUserId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    const query = {
      from: [{ collectionId: 'members' }],
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'ASCENDING' }]
    };
    const results = await db.runQuery(`groups/${groupId}`, query);
    const membersList = (results || []).filter((r: any) => r.document).map((r: any) => {
      const data = db.firestoreToJson(r.document);
      const nameParts = r.document.name.split('/');
      return { id: nameParts[nameParts.length - 1], ...data };
    });
    return c.json(membersList, 200);
  } catch (error) {
    return c.json({ error: 'Error fetching members' }, 500);
  }
});

members.post('/groups/:groupId/members', requireAuth, async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const user = c.get('user');
    const { name } = await c.req.json();
    const normalized = normalizeName(name);
    if (!normalized) return c.json({ error: 'Name is required' }, 400);

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const groupDoc = await db.getDocument(`groups/${groupId}`);
    if (!groupDoc || db.firestoreToJson(groupDoc).ownerId !== user.targetUserId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const membersRes = await db.runQuery(`groups/${groupId}`, { from: [{ collectionId: 'members' }] });
    const existing = (membersRes || []).filter((r: any) => r.document).map((r: any) => db.firestoreToJson(r.document));
    
    if (existing.some((m: any) => m.name === normalized)) {
      return c.json({ error: 'Member already exists' }, 409);
    }

    const newColor = getNextAvailableColor(existing.map((m: any) => m.color));
    const newMemberId = 'member_' + generateRandomHex(8);
    const newMemberData = {
      name: normalized,
      color: newColor,
      password: null,
      deleteToken: generateRandomHex(16),
      iconUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(normalized)}&background=random&color=fff`,
      createdAt: new Date().toISOString(),
      createdBy: 'admin',
      isActive: true,
    };

    await db.createDocument(`groups/${groupId}/members`, newMemberId, newMemberData);
    return c.json({ id: newMemberId, ...newMemberData }, 201);
  } catch (error) {
    return c.json({ error: 'Error adding member' }, 500);
  }
});

members.put('/groups/:groupId/members/:memberId', requireAuth, async (c) => {
  try {
    const { groupId, memberId } = c.req.param();
    const user = c.get('user');
    const { name, color } = await c.req.json();
    const normalized = normalizeName(name);

    if (!normalized) return c.json({ error: 'Name required' }, 400);

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const groupDoc = await db.getDocument(`groups/${groupId}`);
    if (!groupDoc || db.firestoreToJson(groupDoc).ownerId !== user.targetUserId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const updateData: any = { name: normalized };
    if (color) updateData.color = color;

    await db.patchDocument(`groups/${groupId}/members/${memberId}`, updateData);
    return c.json({ message: 'Member updated' }, 200);
  } catch (error) {
    return c.json({ error: 'Error updating member' }, 500);
  }
});

members.delete('/groups/:groupId/members/:memberId', requireAuth, async (c) => {
  try {
    const { groupId, memberId } = c.req.param();
    const user = c.get('user');

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const groupDoc = await db.getDocument(`groups/${groupId}`);
    if (!groupDoc || db.firestoreToJson(groupDoc).ownerId !== user.targetUserId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    await db.deleteDocument(`groups/${groupId}/members/${memberId}`);
    return c.json({ message: 'Member deleted' }, 200);
  } catch (error) {
    return c.json({ error: 'Error deleting member' }, 500);
  }
});

members.put('/groups/:groupId/members/:memberId/status', requireAuth, async (c) => {
  try {
    const { groupId, memberId } = c.req.param();
    const user = c.get('user');
    const { isActive } = await c.req.json();

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const groupDoc = await db.getDocument(`groups/${groupId}`);
    if (!groupDoc || db.firestoreToJson(groupDoc).ownerId !== user.targetUserId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    await db.patchDocument(`groups/${groupId}/members/${memberId}`, { isActive: !!isActive });
    return c.json({ message: 'Status updated' }, 200);
  } catch (error) {
    return c.json({ error: 'Error updating status' }, 500);
  }
});

members.get('/groups/:groupId/member-suggestions', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const q = c.req.query('q');

    if (!q) {
      return c.json([], 200);
    }

    const normalizedQuery = normalizeName(q);

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const query = {
      from: [{ collectionId: 'members' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'name' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: normalizedQuery } } },
            { fieldFilter: { field: { fieldPath: 'name' }, op: 'LESS_THAN_OR_EQUAL', value: { stringValue: normalizedQuery + '\uf8ff' } } }
          ]
        }
      },
      limit: 10
    };

    const results = await db.runQuery(`groups/${groupId}`, query);
    const membersList = (results || []).filter((r: any) => r.document).map((r: any) => {
      const data = db.firestoreToJson(r.document);
      const nameParts = r.document.name.split('/');
      const id = nameParts[nameParts.length - 1];
      return {
        id: id,
        name: data.name,
        hasPassword: !!data.password
      };
    });

    return c.json(membersList, 200);
  } catch (error) {
    return c.json({ error: 'Error fetching suggestions' }, 500);
  }
});

members.get('/groups/:groupId/unjoined-members', requireAuth, async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const user = c.get('user');
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const groupDoc = await db.getDocument(`groups/${groupId}`);
    if (!groupDoc || db.firestoreToJson(groupDoc).ownerId !== user.targetUserId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const membersRes = await db.runQuery(`groups/${groupId}`, { from: [{ collectionId: 'members' }] });
    const allMembers = (membersRes || []).filter((r: any) => r.document).map((r: any) => {
      const data = db.firestoreToJson(r.document);
      const nameParts = r.document.name.split('/');
      return { id: nameParts[nameParts.length - 1], ...data };
    });

    const activeMembers = allMembers.filter((m: any) => m.isActive);
    return c.json(activeMembers, 200);
  } catch (error) {
    return c.json({ error: 'Error fetching unjoined' }, 500);
  }
});

members.post('/groups/:groupId/members/analyze-bulk', requireAuth, async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const user = c.get('user');
    const { namesText } = await c.req.json();
    if (!namesText || typeof namesText !== 'string') return c.json({ error: 'Text is required' }, 400);

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const groupDoc = await db.getDocument(`groups/${groupId}`);
    if (!groupDoc || db.firestoreToJson(groupDoc).ownerId !== user.targetUserId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const inputNames = [...new Set(namesText.split(/\n|,/).map(normalizeName).filter(Boolean))];
    const membersRes = await db.runQuery(`groups/${groupId}`, { from: [{ collectionId: 'members' }] });
    const existingMembers = (membersRes || []).filter((r: any) => r.document).map((r: any) => {
      const data = db.firestoreToJson(r.document);
      const nameParts = r.document.name.split('/');
      return { id: nameParts[nameParts.length - 1], name: data.name };
    });

    const existingNames = new Set(existingMembers.map((m: any) => m.name));

    const analysisResults = inputNames.map(inputName => {
      if (existingNames.has(inputName)) {
        return { inputName, status: 'exact_match', matchedMember: existingMembers.find((m: any) => m.name === inputName) };
      }

      const suggestions = [];
      for (const member of existingMembers) {
        const dist = levenshteinDistance(inputName, member.name);
        const similarity = 1 - (dist / Math.max(inputName.length, member.name.length));
        if (similarity >= 0.6) {
          suggestions.push({ id: member.id, name: member.name, similarity });
        }
      }

      if (suggestions.length > 0) {
        suggestions.sort((a, b) => b.similarity - a.similarity);
        return { inputName, status: 'potential_match', suggestions };
      }

      return { inputName, status: 'new_registration' };
    });

    return c.json({ analysisResults }, 200);
  } catch (error) {
    return c.json({ error: 'Error analyzing bulk' }, 500);
  }
});

members.post('/groups/:groupId/members/finalize-bulk', requireAuth, async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const user = c.get('user');
    const { resolutions } = await c.req.json();
    if (!Array.isArray(resolutions)) return c.json({ error: 'Invalid request' }, 400);

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const groupDoc = await db.getDocument(`groups/${groupId}`);
    if (!groupDoc || db.firestoreToJson(groupDoc).ownerId !== user.targetUserId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const membersRes = await db.runQuery(`groups/${groupId}`, { from: [{ collectionId: 'members' }] });
    const existingColors = (membersRes || []).filter((r: any) => r.document).map((r: any) => db.firestoreToJson(r.document).color);

    let createdCount = 0;
    for (const resolution of resolutions) {
      if (resolution.action === 'create') {
        const normalized = normalizeName(resolution.inputName);
        if (!normalized) continue;

        const newColor = getNextAvailableColor(existingColors);
        existingColors.push(newColor);
        
        const newMemberId = 'member_' + generateRandomHex(8);
        const newMemberData = {
          name: normalized,
          color: newColor,
          password: null,
          deleteToken: generateRandomHex(16),
          iconUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(normalized)}&background=random&color=fff`,
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
          isActive: true,
        };

        await db.createDocument(`groups/${groupId}/members`, newMemberId, newMemberData);
        createdCount++;
      }
    }

    return c.json({
      message: '一括登録が完了しました。',
      createdCount,
      skippedCount: resolutions.length - createdCount,
    }, 200);
  } catch (error) {
    return c.json({ error: 'Error finalizing bulk' }, 500);
  }
});

export default members;
