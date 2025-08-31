// amidakuji-app/controllers/event/public.js
const {firestore} = require('../../utils/firestore');

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

    let sanitizedPrizes;
    let singleResult = null;
    let sanitizedParticipants = eventData.participants;

    if (eventData.status !== 'started') {
      // イベントが開始されていない場合は、全ての景品をマスキング
      sanitizedPrizes = eventData.prizes.map(() => ({name: '？？？', imageUrl: null}));
    } else {
      // イベント開始済みの場合は、従来通り1件だけ表示
      singleResult = eventData.results ? {[decodedParticipantName]: eventData.results[decodedParticipantName]} : null;
      if (!singleResult || !singleResult[decodedParticipantName]) {
        return res.status(404).json({error: '指定された参加者の結果が見つかりません。'});
      }

      const targetPrizeIndex = singleResult[decodedParticipantName].prizeIndex;
      sanitizedPrizes = eventData.prizes.map((prize, index) => {
        if (index === targetPrizeIndex) {
          return prize;
        }
        return {name: '', imageUrl: null};
      });

      sanitizedParticipants = eventData.participants.map((p) => {
        if (p.name === decodedParticipantName) {
          return p;
        }
        return {...p, name: '', iconUrl: null};
      });
    }

    const publicData = {
      eventName: eventName,
      participants: sanitizedParticipants,
      prizes: sanitizedPrizes,
      lines: eventData.lines,
      status: eventData.status,
      results: singleResult, // 開始前はnullになる
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

    let publicPrizes = eventData.prizes;
    let publicParticipants = eventData.participants;
    let publicLines = []; // デフォルトでは線を送らない

    const memberId = req.headers['x-member-id'];

    const myParticipant = memberId ? eventData.participants.find((p) => p.memberId === memberId) : null;
    if (myParticipant) {
    } else {
    }

    if (eventData.status !== 'started') {
      const displayPrizeName = eventData.hasOwnProperty('displayPrizeName') ? Boolean(eventData.displayPrizeName) : true;
      const displayPrizeCount = eventData.hasOwnProperty('displayPrizeCount') ? Boolean(eventData.displayPrizeCount) : true;

      const prizeSummary = eventData.prizes.reduce((acc, prize) => {
        const name = prize.name || '（名称未設定）';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});

      if (displayPrizeName && displayPrizeCount) {
        publicPrizes = Object.entries(prizeSummary).map(([name, count]) => ({name, count}));
      } else if (!displayPrizeName && displayPrizeCount) {
        publicPrizes = Object.entries(prizeSummary).map(([name, count]) => ({name: '？？？', count}));
      } else if (displayPrizeName && !displayPrizeCount) {
        publicPrizes = Object.keys(prizeSummary).map((name) => ({name}));
      } else {
        // !displayPrizeName && !displayPrizeCount
        const totalCount = eventData.prizes.length;
        publicPrizes = [{name: '合計景品数', count: totalCount}];
      }

      if (myParticipant) {
        publicLines = eventData.lines;
        publicParticipants = eventData.participants.map((p) => {
          if (p.memberId === myParticipant.memberId) {
            return p;
          }
          return {...p, name: null, iconUrl: null};
        });
      } else {
        publicParticipants = eventData.participants.map((p) => ({...p, name: null, iconUrl: null}));
      }
    } else {
      publicLines = eventData.lines;
    }

    const publicData = {
      eventName: eventName,
      participants: publicParticipants,
      prizes: publicPrizes,
      lines: publicLines,
      hasPassword: !!groupData.password,
      status: eventData.status,
      results: eventData.status === 'started' ? eventData.results : null,
      groupId: eventData.groupId,
      allowDoodleMode: eventData.allowDoodleMode || false,
      doodles: eventData.doodles || [],
    };

    res.status(200).json(publicData);
  } catch (error) {
    console.error('Error fetching public event data:', error);
    res.status(500).json({error: 'イベント情報の取得に失敗しました。'});
  }
};

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
