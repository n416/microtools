import { Hono } from 'hono';
import { FirestoreClient } from '../utils/firestore-rest';
import { requireAuth } from '../middleware/auth';
import { generateLines, calculateResults } from '../utils/amidakuji';
import { generateV4UploadSignedUrl } from '../utils/gcs-signer';
import { getCookie } from 'hono/cookie';
const events = new Hono();
// --- Public Routes ---
events.get('/groups/:groupId/events', requireAuth, async (c) => {
    try {
        const groupId = c.req.param('groupId');
        const user = c.get('user');
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const groupDoc = await db.getDocument(`groups/${groupId}`);
        if (!groupDoc || !groupDoc.name) {
            return c.json({ error: 'Group not found' }, 404);
        }
        const groupData = db.firestoreToJson(groupDoc);
        if (groupData.ownerId !== user.targetUserId) {
            return c.json({ error: 'Permission denied' }, 403);
        }
        const query = {
            from: [{ collectionId: 'events' }],
            where: {
                fieldFilter: { field: { fieldPath: 'groupId' }, op: 'EQUAL', value: { stringValue: groupId } }
            },
            orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }]
        };
        const results = await db.runQuery('', query);
        const eventList = (results || [])
            .filter((r) => r.document)
            .map((r) => {
            const data = db.firestoreToJson(r.document);
            const nameParts = r.document.name.split('/');
            return { id: nameParts[nameParts.length - 1], ...data };
        });
        return c.json(eventList, 200);
    }
    catch (error) {
        console.error('Error fetching events:', error);
        return c.json({ error: 'Failed to fetch events' }, 500);
    }
});
events.post('/events', requireAuth, async (c) => {
    try {
        const user = c.get('user');
        const body = await c.req.json();
        const { prizes, eventName, displayPrizeName, displayPrizeCount, allowDoodleMode, groupId } = body;
        const participantCount = prizes ? prizes.length : 0;
        if (!groupId)
            return c.json({ error: 'Group ID is required' }, 400);
        if (participantCount < 2)
            return c.json({ error: 'Prizes must be 2 or more' }, 400);
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const groupDoc = await db.getDocument(`groups/${groupId}`);
        if (!groupDoc || !groupDoc.name) {
            return c.json({ error: 'Group not found' }, 404);
        }
        const groupData = db.firestoreToJson(groupDoc);
        if (groupData.ownerId !== user.targetUserId) {
            return c.json({ error: 'Permission denied' }, 403);
        }
        const eventId = 'event_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const participants = Array.from({ length: participantCount }, (_, i) => ({
            slot: i,
            name: null,
            deleteToken: null
        }));
        const newEvent = {
            eventName: eventName || '無題のイベント',
            prizes: prizes.map((p) => (typeof p === 'string' ? { name: p, imageUrl: null, rank: 'uncommon' } : { ...p, rank: p.rank || 'uncommon' })),
            lines: generateLines(participantCount, []),
            groupId,
            participantCount,
            participants,
            displayPrizeName: !!displayPrizeName,
            displayPrizeCount: !!displayPrizeCount,
            allowDoodleMode: typeof allowDoodleMode === 'boolean' ? allowDoodleMode : false,
            createdAt: new Date().toISOString(),
            lastModifiedAt: new Date().toISOString(),
            ownerId: user.targetUserId,
            status: 'pending',
            doodles: [],
            displayMode: 'public',
            eventPassword: '',
            results: []
        };
        await db.createDocument('events', eventId, newEvent);
        return c.json({ id: eventId, ...newEvent }, 201);
    }
    catch (error) {
        console.error('Error creating event:', error);
        return c.json({ error: 'Failed to create event' }, 500);
    }
});
events.get('/events/:eventId', async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const doc = await db.getDocument(`events/${eventId}`);
        if (!doc || !doc.name)
            return c.json({ error: 'Event not found' }, 404);
        const eventData = db.firestoreToJson(doc);
        return c.json({ id: eventId, ...eventData }, 200);
    }
    catch (error) {
        console.error('Error fetching event:', error);
        return c.json({ error: 'Failed to fetch event' }, 500);
    }
});
events.get('/events/:eventId/public', async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const doc = await db.getDocument(`events/${eventId}`);
        if (!doc || !doc.name)
            return c.json({ error: 'Event not found' }, 404);
        const eventData = db.firestoreToJson(doc);
        // Group password check
        if (eventData.groupId) {
            const groupDoc = await db.getDocument(`groups/${eventData.groupId}`);
            if (groupDoc) {
                const groupData = db.firestoreToJson(groupDoc);
                if (groupData.password) {
                    let hasAccess = false;
                    const verifiedStr = getCookie(c, 'verifiedGroups') || '';
                    console.log(`[DEBUG] /events/:eventId/public: Checking password for eventId ${eventId}, groupId ${eventData.groupId}. Cookie verifiedGroups = "${verifiedStr}"`);
                    if (verifiedStr.split(',').includes(eventData.groupId)) {
                        console.log(`[DEBUG] /events/:eventId/public: Access GRANTED via verifiedGroups cookie`);
                        hasAccess = true;
                    }
                    else {
                        const authToken = c.req.header('x-auth-token');
                        const memberId = c.req.header('x-member-id');
                        if (authToken && memberId) {
                            const memberDoc = await db.getDocument(`groups/${eventData.groupId}/members/${memberId}`);
                            if (memberDoc && db.firestoreToJson(memberDoc).deleteToken === authToken) {
                                console.log(`[DEBUG] /events/:eventId/public: Access GRANTED via participant token`);
                                hasAccess = true;
                            }
                        }
                    }
                    if (!hasAccess) {
                        console.log(`[DEBUG] /events/:eventId/public: Access DENIED. requiresPassword = true`);
                        return c.json({ error: 'Password required', requiresPassword: true, groupId: eventData.groupId, groupName: groupData.name }, 401);
                    }
                }
            }
        }
        let publicParticipants = eventData.participants || [];
        let publicLines = [];
        let publicPrizes = eventData.prizes || [];
        const memberId = c.req.header('x-member-id');
        const myParticipant = memberId ? publicParticipants.find((p) => p.memberId === memberId) : null;
        let prizeSummaryArray = null;
        if (eventData.status !== 'started') {
            const displayPrizeName = eventData.hasOwnProperty('displayPrizeName') ? Boolean(eventData.displayPrizeName) : true;
            const displayPrizeCount = eventData.hasOwnProperty('displayPrizeCount') ? Boolean(eventData.displayPrizeCount) : true;
            const prizeSummary = publicPrizes.reduce((acc, prize) => {
                const name = prize.name || '（名称未設定）';
                acc[name] = (acc[name] || 0) + 1;
                return acc;
            }, {});
            if (displayPrizeName && displayPrizeCount) {
                prizeSummaryArray = Object.entries(prizeSummary).map(([name, count]) => ({ name, count }));
            }
            else if (!displayPrizeName && displayPrizeCount) {
                prizeSummaryArray = Object.entries(prizeSummary).map(([name, count]) => ({ name: '？？？', count }));
            }
            else if (displayPrizeName && !displayPrizeCount) {
                prizeSummaryArray = Object.keys(prizeSummary).map((name) => ({ name }));
            }
            else {
                const totalCount = eventData.prizes ? eventData.prizes.length : 0;
                prizeSummaryArray = [{ name: '合計景品数', count: totalCount }];
            }
            // キャンバス描画用には全スロット分の「？？？」配列を維持する
            publicPrizes = publicPrizes.map((p) => ({ ...p, name: '？？？', imageUrl: null, rank: 'common' }));
            if (myParticipant) {
                publicLines = eventData.lines || [];
                publicParticipants = publicParticipants.map((p) => {
                    if (p.memberId === myParticipant.memberId) {
                        return p;
                    }
                    return { ...p, name: null, iconUrl: null };
                });
            }
            else {
                publicParticipants = publicParticipants.map((p) => ({ ...p, name: null, iconUrl: null }));
            }
        }
        else {
            publicLines = eventData.lines || [];
        }
        const publicData = {
            id: eventId,
            eventName: eventData.eventName || '無題のイベント',
            participants: publicParticipants,
            prizes: publicPrizes,
            prizeSummary: prizeSummaryArray,
            lines: publicLines,
            status: eventData.status,
            results: eventData.status === 'started' ? eventData.results : null,
            groupId: eventData.groupId,
            displayMode: eventData.displayMode || 'public',
            displayPrizeName: eventData.displayPrizeName || false,
            displayPrizeCount: eventData.displayPrizeCount || false,
            allowDoodleMode: eventData.allowDoodleMode || false,
            doodles: eventData.doodles || [],
            hasPassword: !!eventData.eventPassword
        };
        if (publicData.displayMode === 'private' && publicData.status !== 'started') {
            publicData.results = [];
        }
        return c.json(publicData, 200);
    }
    catch (error) {
        console.error('Error fetching public event:', error);
        return c.json({ error: 'Failed to fetch event' }, 500);
    }
});
events.put('/events/:eventId', requireAuth, async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const user = c.get('user');
        const { prizes, eventName, displayPrizeName, displayPrizeCount, allowDoodleMode } = await c.req.json();
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const participantCount = prizes ? prizes.length : 0;
        if (participantCount < 2)
            return c.json({ error: 'Prizes must be 2 or more' }, 400);
        const doc = await db.getDocument(`events/${eventId}`);
        if (!doc || !doc.name)
            return c.json({ error: 'Event not found' }, 404);
        const eventData = db.firestoreToJson(doc);
        if (eventData.ownerId !== user.targetUserId)
            return c.json({ error: 'Permission denied' }, 403);
        if (eventData.status === 'started')
            return c.json({ error: 'Cannot edit started event' }, 400);
        let updateData = {
            eventName: eventName || '無題のイベント',
            prizes: prizes.map((p) => ({ name: p.name, imageUrl: p.imageUrl || null, rank: p.rank || 'uncommon' })),
            participantCount,
            displayPrizeName: !!displayPrizeName,
            displayPrizeCount: !!displayPrizeCount,
            allowDoodleMode: typeof allowDoodleMode === 'boolean' ? allowDoodleMode : eventData.allowDoodleMode || false,
            lastModifiedAt: new Date().toISOString()
        };
        if (participantCount !== eventData.participantCount) {
            const newParticipants = Array.from({ length: participantCount }, (_, i) => ({
                slot: i,
                name: null,
                deleteToken: null,
            }));
            updateData.participants = newParticipants;
            updateData.lines = generateLines(participantCount, eventData.doodles || []);
        }
        await db.patchDocument(`events/${eventId}`, updateData);
        return c.json({ id: eventId, message: 'Event updated' }, 200);
    }
    catch (error) {
        console.error('Error updating event:', error);
        return c.json({ error: 'Failed to update event' }, 500);
    }
});
events.post('/events/:eventId/start', requireAuth, async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const user = c.get('user');
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const doc = await db.getDocument(`events/${eventId}`);
        if (!doc || !doc.name)
            return c.json({ error: 'Event not found' }, 404);
        const eventData = db.firestoreToJson(doc);
        if (eventData.ownerId !== user.targetUserId)
            return c.json({ error: 'Permission denied' }, 403);
        if (eventData.status === 'started')
            return c.json({ error: 'Event already started' }, 400);
        const results = calculateResults(eventData.participants || [], eventData.lines || [], eventData.prizes || [], eventData.doodles || []);
        await db.patchDocument(`events/${eventId}`, {
            status: 'started',
            results: results,
            lastModifiedAt: new Date().toISOString()
        });
        const updatedDoc = await db.getDocument(`events/${eventId}`);
        const updatedEventData = db.firestoreToJson(updatedDoc);
        return c.json({ message: 'Event started', event: { id: eventId, ...updatedEventData } }, 200);
    }
    catch (error) {
        console.error('Error starting event:', error);
        return c.json({ error: 'Failed to start event' }, 500);
    }
});
events.post('/events/:eventId/regenerate-lines', requireAuth, async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const user = c.get('user');
        const { deleteDoodles } = await c.req.json();
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const doc = await db.getDocument(`events/${eventId}`);
        if (!doc || !doc.name)
            return c.json({ error: 'Event not found' }, 404);
        const eventData = db.firestoreToJson(doc);
        if (eventData.ownerId !== user.targetUserId)
            return c.json({ error: 'Permission denied' }, 403);
        if (eventData.status === 'started')
            return c.json({ error: 'Cannot edit started event' }, 400);
        const currentDoodles = deleteDoodles ? [] : (eventData.doodles || []);
        const participantCount = eventData.prizes ? eventData.prizes.length : 0;
        const newLines = generateLines(participantCount, currentDoodles);
        const newResults = calculateResults(eventData.participants || [], newLines, eventData.prizes || [], currentDoodles);
        let updateData = {
            lines: newLines,
            results: newResults,
            updatedAt: new Date().toISOString()
        };
        if (deleteDoodles) {
            updateData.doodles = [];
        }
        await db.patchDocument(`events/${eventId}`, updateData);
        return c.json({ message: 'Lines regenerated', lines: newLines, results: newResults }, 200);
    }
    catch (error) {
        console.error('Error regenerating lines:', error);
        return c.json({ error: 'Failed to regenerate lines' }, 500);
    }
});
events.post('/events/:eventId/shuffle-prizes', requireAuth, async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const user = c.get('user');
        const { shuffledPrizes } = await c.req.json();
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        if (!shuffledPrizes || !Array.isArray(shuffledPrizes)) {
            return c.json({ error: 'Invalid prizes list' }, 400);
        }
        const doc = await db.getDocument(`events/${eventId}`);
        if (!doc || !doc.name)
            return c.json({ error: 'Event not found' }, 404);
        const eventData = db.firestoreToJson(doc);
        if (eventData.ownerId !== user.targetUserId)
            return c.json({ error: 'Permission denied' }, 403);
        const newResults = calculateResults(eventData.participants || [], eventData.lines || [], shuffledPrizes, eventData.doodles || []);
        await db.patchDocument(`events/${eventId}`, {
            prizes: shuffledPrizes,
            results: newResults,
            updatedAt: new Date().toISOString()
        });
        return c.json({ message: 'Prizes shuffled', prizes: shuffledPrizes, results: newResults }, 200);
    }
    catch (error) {
        console.error('Error shuffling prizes:', error);
        return c.json({ error: 'Failed to shuffle prizes' }, 500);
    }
});
events.delete('/events/:eventId', requireAuth, async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const user = c.get('user');
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const doc = await db.getDocument(`events/${eventId}`);
        if (!doc || !doc.name)
            return c.json({ error: 'Event not found' }, 404);
        const eventData = db.firestoreToJson(doc);
        if (eventData.ownerId !== user.targetUserId)
            return c.json({ error: 'Permission denied' }, 403);
        await db.deleteDocument(`events/${eventId}`);
        return c.json({ message: 'Event deleted' }, 200);
    }
    catch (error) {
        console.error('Error deleting event:', error);
        return c.json({ error: 'Failed to delete event' }, 500);
    }
});
events.post('/events/:eventId/copy', requireAuth, async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const user = c.get('user');
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        const doc = await db.getDocument(`events/${eventId}`);
        if (!doc || !doc.name)
            return c.json({ error: 'Event not found' }, 404);
        const eventData = db.firestoreToJson(doc);
        if (eventData.ownerId !== user.targetUserId)
            return c.json({ error: 'Permission denied' }, 403);
        const newEventId = 'event_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const newParticipants = Array.from({ length: eventData.participantCount }, (_, i) => ({
            slot: i,
            name: null,
            deleteToken: null,
        }));
        const newEvent = {
            ...eventData,
            eventName: (eventData.eventName || '無題のイベント') + '（コピー）',
            createdAt: new Date().toISOString(),
            lastModifiedAt: new Date().toISOString(),
            status: 'pending',
            participants: newParticipants,
            doodles: [],
            results: [],
            eventPassword: '',
            lines: generateLines(eventData.participantCount, [])
        };
        delete newEvent.id;
        delete newEvent.name; // Hono版で紛れ込んでいた name を除去
        await db.createDocument('events', newEventId, newEvent);
        return c.json({ id: newEventId, ...newEvent }, 201);
    }
    catch (error) {
        console.error('Error copying event:', error);
        return c.json({ error: 'Failed to copy event' }, 500);
    }
});
events.post('/events/:eventId/generate-upload-url', requireAuth, async (c) => {
    try {
        const eventId = c.req.param('eventId');
        const { fileType, fileHash, groupId } = await c.req.json();
        const user = c.get('user');
        if (!groupId)
            return c.json({ error: 'groupId is required' }, 400);
        const db = new FirestoreClient(c.env.FIREBASE_SERVICE_ACCOUNT);
        // イベントは作成直後で取得できない可能性があるため、親グループのオーナー権限でチェックする
        const groupDoc = await db.getDocument(`groups/${groupId}`);
        if (!groupDoc || !groupDoc.name)
            return c.json({ error: 'Group not found' }, 404);
        const groupData = db.firestoreToJson(groupDoc);
        if (groupData.ownerId !== user.targetUserId)
            return c.json({ error: 'Permission denied' }, 403);
        const fileExt = fileType.split('/')[1];
        if (!['png', 'jpeg', 'jpg', 'gif', 'webp'].includes(fileExt)) {
            return c.json({ error: 'Invalid file type' }, 400);
        }
        const fileName = `shared_images/${fileHash}.${fileExt}`;
        const bucketName = c.env.GCS_BUCKET_NAME || 'amidakuji-app-native-bucket';
        const signedUrl = await generateV4UploadSignedUrl(c.env.FIREBASE_SERVICE_ACCOUNT, bucketName, fileName, fileType, 15 * 60);
        return c.json({
            signedUrl: signedUrl,
            imageUrl: `https://storage.googleapis.com/${bucketName}/${fileName}`
        });
    }
    catch (error) {
        console.error('generate-upload-url error:', error);
        return c.json({ error: 'Failed to generate upload URL' }, 500);
    }
});
export default events;
