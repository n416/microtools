// amidakuji-app/controllers/event/public.js
const {firestore} = require('../../utils/firestore');

//  （getPublicShareData, getEventsForGroup, getPublicEventsForGroup は変更なし）
exports.getPublicShareData = async (req, res) => {
  try {
    const {eventId, participantName} = req.params;
    const decodedParticipantName = decodeURIComponent(participantName);

    const eventRef = firestore.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }
    const eventData = eventDoc.data();
    const groupDoc = await firestore.collection('groups').doc(eventData.groupId).get();
    const groupData = groupDoc.exists ? groupDoc.data() : {};

    const safeEventName = eventData.eventName || '無題のイベント';
    const eventName = groupData.name ? `${groupData.name} - ${safeEventName}` : safeEventName;

    const singleResult = eventData.results ? {[decodedParticipantName]: eventData.results[decodedParticipantName]} : null;
    if (!singleResult || !singleResult[decodedParticipantName]) {
      return res.status(404).json({error: '指定された参加者の結果が見つかりません。'});
    }

    // 他の参加者の名前を空白にマスキング
    const sanitizedParticipants = eventData.participants.map((p) => {
      if (p.name === decodedParticipantName) {
        return p;
      }
      return {...p, name: '', iconUrl: null}; // 名前を空白に
    });

    // 獲得した賞品以外を空白にマスキング
    const targetPrizeIndex = singleResult[decodedParticipantName].prizeIndex;
    const sanitizedPrizes = eventData.prizes.map((prize, index) => {
      if (index === targetPrizeIndex) {
        return prize;
      }
      return {name: '', imageUrl: null}; // 名前を空白に
    });

    const publicData = {
      eventName: eventName,
      participants: sanitizedParticipants,
      prizes: sanitizedPrizes,
      lines: eventData.lines,
      status: eventData.status,
      results: singleResult,
      groupId: eventData.groupId,
    };

    res.status(200).json(publicData);
  } catch (error) {
    console.error('Error fetching public share data:', error);
    res.status(500).json({error: 'イベント情報の取得に失敗しました。'});
  }
};

exports.getEventsForGroup = async (req, res) => {
  try {
    const {groupId} = req.params;
    const groupDoc = await firestore.collection('groups').doc(groupId).get();
    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(404).json({error: '指定されたグループが見つからないか、アクセス権がありません。'});
    }
    const eventsSnapshot = await firestore.collection('events').where('groupId', '==', groupId).orderBy('createdAt', 'desc').get();
    const events = eventsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching events for group:', error);
    res.status(500).json({error: 'イベントの読み込みに失敗しました。'});
  }
};

exports.getPublicEventsForGroup = async (req, res) => {
  try {
    const {groupId} = req.params;
    const groupDoc = await firestore.collection('groups').doc(groupId).get();

    if (!groupDoc.exists) {
      return res.status(404).json({error: '指定されたグループが見つかりません。'});
    }

    const groupData = groupDoc.data();

    if (groupData.password) {
      if (!req.session.verifiedGroups || !req.session.verifiedGroups.includes(groupId)) {
        return res.status(403).json({error: 'このグループへのアクセスには合言葉が必要です。', requiresPassword: true, groupId: groupId, groupName: groupData.name});
      }
    }

    const eventsSnapshot = await firestore.collection('events').where('groupId', '==', groupId).orderBy('createdAt', 'desc').get();

    const events = eventsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching public events for group:', error);
    res.status(500).json({error: 'イベントの読み込みに失敗しました。'});
  }
};

exports.getPublicEventData = async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventRef = firestore.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }
    const eventData = eventDoc.data();
    const groupDoc = await firestore.collection('groups').doc(eventData.groupId).get();
    const groupData = groupDoc.exists ? groupDoc.data() : {};

    if (groupData.password) {
      if (!req.session.verifiedGroups || !req.session.verifiedGroups.includes(eventData.groupId)) {
        return res.status(403).json({error: 'このグループへのアクセスには合言葉が必要です。', requiresPassword: true, groupId: eventData.groupId, groupName: groupData.name});
      }
    }

    const safeEventName = eventData.eventName || '無題のイベント';
    const eventName = groupData.name ? `${groupData.name} - ${safeEventName}` : safeEventName;

    const publicPrizes = eventData.status !== 'started' ? eventData.prizes.map(() => ({name: '？？？', imageUrl: null})) : eventData.prizes;

    const otherEventsSnapshot = await firestore.collection('events').where('groupId', '==', eventData.groupId).where('status', '==', 'pending').get();

    const otherEvents = otherEventsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()})).filter((event) => event.id !== eventId);

    const publicData = {
      eventName: eventName,
      participants: eventData.participants,
      prizes: publicPrizes,
      lines: eventData.lines,
      hasPassword: !!groupData.password,
      status: eventData.status,
      results: eventData.status === 'started' ? eventData.results : null,
      groupId: eventData.groupId,
      otherEvents: otherEvents,
    };
    res.status(200).json(publicData);
  } catch (error) {
    console.error('Error fetching public event data:', error);
    res.status(500).json({error: 'イベント情報の取得に失敗しました。'});
  }
};

// (getEventsByCustomUrl は変更なし)
exports.getEventsByCustomUrl = async (req, res) => {
  try {
    const {customUrl} = req.params;
    const groupSnapshot = await firestore.collection('groups').where('customUrl', '==', customUrl).limit(1).get();

    if (groupSnapshot.empty) {
      return res.status(404).json({error: '指定されたURLのグループが見つかりません。'});
    }
    const groupDoc = groupSnapshot.docs[0];
    const groupId = groupDoc.id;
    const groupData = groupDoc.data();

    if (groupData.password) {
      if (!req.session.verifiedGroups || !req.session.verifiedGroups.includes(groupId)) {
        return res.status(403).json({error: 'このグループへのアクセスには合言葉が必要です。', requiresPassword: true, groupId: groupId, groupName: groupData.name});
      }
    }
    const eventsSnapshot = await firestore.collection('events').where('groupId', '==', groupId).orderBy('createdAt', 'desc').get();

    const events = eventsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching events by custom URL:', error);
    res.status(500).json({error: 'イベントの読み込みに失敗しました。'});
  }
};
