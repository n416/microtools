import { Hono } from 'hono';
import { FirestoreClient } from '../utils/firestore-rest';
import { calculateResults } from '../utils/amidakuji';
import { getCookie } from 'hono/cookie';

const publicRouter = new Hono<{ Bindings: any, Variables: any }>();

async function checkGroupAccess(c: any, db: FirestoreClient, groupId: string, groupData: any) {
  if (!groupData.password) return true;
  
  const verifiedStr = getCookie(c, 'verifiedGroups') || '';
  if (verifiedStr.split(',').includes(groupId)) {
    return true;
  }

  const authToken = c.req.header('x-auth-token');
  const memberId = c.req.header('x-member-id');
  if (authToken && memberId) {
    const memberDoc = await db.getDocument(`groups/${groupId}/members/${memberId}`);
    if (memberDoc && db.firestoreToJson(memberDoc).deleteToken === authToken) {
      return true;
    }
  }
  
  return false;
}

publicRouter.get('/share/:eventId/:participantName?', async (c) => {
  try {
    const eventId = c.req.param('eventId');
    const participantName = c.req.param('participantName');
    const decodedParticipantName = participantName ? decodeURIComponent(participantName) : null;

    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
    const eventDoc = await db.getDocument(`events/${eventId}`);
    
    if (!eventDoc || !eventDoc.name) {
      return c.json({ error: 'イベントが見つかりません。' }, 404);
    }
    const eventData = db.firestoreToJson(eventDoc);
    
    const groupDoc = await db.getDocument(`groups/${eventData.groupId}`);
    const groupData = (groupDoc && groupDoc.name) ? db.firestoreToJson(groupDoc) : {};

    if (groupData.password) {
      const hasAccess = await checkGroupAccess(c, db, eventData.groupId, groupData);
      if (!hasAccess) {
        return c.json({ error: 'Password required', requiresPassword: true, groupId: eventData.groupId, groupName: groupData.name }, 401);
      }
    }

    const safeEventName = eventData.eventName || '無題のイベント';
    const eventName = groupData.name ? `${groupData.name} - ${safeEventName}` : safeEventName;

    let sanitizedPrizes: any[] = [];
    let singleResult: any = null;
    let sanitizedParticipants = eventData.participants || [];

    if (eventData.status !== 'started') {
      sanitizedPrizes = (eventData.prizes || []).map(() => ({ name: '？？？', imageUrl: null }));
    } else {
      const fullResults = calculateResults(eventData.participants || [], eventData.lines || [], eventData.prizes || [], eventData.doodles || []);
      
      if (decodedParticipantName) {
        singleResult = fullResults ? { [decodedParticipantName]: fullResults[decodedParticipantName] } : null;
        
        if (!singleResult || !singleResult[decodedParticipantName]) {
          return c.json({ error: '指定された参加者の結果が見つかりません。' }, 404);
        }

        const targetPrizeIndex = singleResult[decodedParticipantName].prizeIndex;
        sanitizedPrizes = (eventData.prizes || []).map((prize: any, index: number) => {
          if (index === targetPrizeIndex) return prize;
          return { name: '', imageUrl: null };
        });

        sanitizedParticipants = (eventData.participants || []).map((p: any) => {
          if (p.name === decodedParticipantName) return p;
          return { ...p, name: '', iconUrl: null };
        });
      } else {
        // 全体のシェアデータ（特定参加者なし）
        sanitizedPrizes = eventData.prizes || [];
      }
    }

    const publicData = {
      eventName: eventName,
      participants: sanitizedParticipants,
      prizes: sanitizedPrizes,
      lines: eventData.lines || [],
      doodles: eventData.doodles || [],
      status: eventData.status,
      results: singleResult,
      groupId: eventData.groupId,
    };

    return c.json(publicData, 200);
  } catch (error) {
    console.error('Error fetching public share data:', error);
    return c.json({ error: 'イベント情報の取得に失敗しました。' }, 500);
  }
});

publicRouter.get('/events/by-group/:groupId', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);

    const groupDoc = await db.getDocument(`groups/${groupId}`);
    if (!groupDoc || !groupDoc.name) {
      return c.json({ error: '指定されたグループが見つかりません。' }, 404);
    }
    const groupData = db.firestoreToJson(groupDoc);
    
    if (groupData.password) {
      const hasAccess = await checkGroupAccess(c, db, groupId, groupData);
      if (!hasAccess) {
        return c.json({ error: 'Password required', requiresPassword: true, groupId: groupId, groupName: groupData.name }, 401);
      }
    }

    const query = {
      from: [{ collectionId: 'events' }],
      where: { fieldFilter: { field: { fieldPath: 'groupId' }, op: 'EQUAL', value: { stringValue: groupId } } },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }]
    };
    const results = await db.runQuery('', query);
    
    const events = (results || [])
      .filter((r: any) => r.document)
      .map((r: any) => {
        const data = db.firestoreToJson(r.document);
        const nameParts = r.document.name.split('/');
        return { id: nameParts[nameParts.length - 1], ...data };
      });
      
    return c.json(events, 200);
  } catch (error) {
    console.error('Error fetching public events for group:', error);
    return c.json({ error: 'イベントの読み込みに失敗しました。' }, 500);
  }
});

publicRouter.get('/groups/url/:customUrl/events', async (c) => {
  try {
    const customUrl = c.req.param('customUrl');
    const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);

    const query = {
      from: [{ collectionId: 'groups' }],
      where: { fieldFilter: { field: { fieldPath: 'customUrl' }, op: 'EQUAL', value: { stringValue: customUrl } } },
      limit: 1
    };
    
    const groupResults = await db.runQuery('', query);
    if (!groupResults || groupResults.length === 0 || !groupResults[0].document) {
      return c.json({ error: '指定されたURLのグループが見つかりません。' }, 404);
    }

    const groupDoc = groupResults[0].document;
    const nameParts = groupDoc.name.split('/');
    const groupId = nameParts[nameParts.length - 1];
    const groupData = db.firestoreToJson(groupDoc);
    
    if (groupData.password) {
      const hasAccess = await checkGroupAccess(c, db, groupId, groupData);
      if (!hasAccess) {
        return c.json({ error: 'Password required', requiresPassword: true, groupId: groupId, groupName: groupData.name }, 401);
      }
    }
    
    const eventsQuery = {
      from: [{ collectionId: 'events' }],
      where: { fieldFilter: { field: { fieldPath: 'groupId' }, op: 'EQUAL', value: { stringValue: groupId } } },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }]
    };
    
    const eventsRes = await db.runQuery('', eventsQuery);
    const events = (eventsRes || [])
      .filter((r: any) => r.document)
      .map((r: any) => {
        const data = db.firestoreToJson(r.document);
        const eNameParts = r.document.name.split('/');
        return { id: eNameParts[eNameParts.length - 1], ...data };
      });

    return c.json(events, 200);
  } catch (error) {
    console.error('Error fetching events by custom URL:', error);
    return c.json({ error: 'イベントの読み込みに失敗しました。' }, 500);
  }
});

export default publicRouter;
