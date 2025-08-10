const {firestore} = require('../utils/firestore');
const {generateLines, calculateResults} = require('../utils/amidakuji');
const {getNextAvailableColor} = require('../utils/color');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const saltRounds = 10;

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

exports.createEvent = async (req, res) => {
  try {
    const {prizes, groupId, participantCount, displayMode, eventPassword, eventName} = req.body;

    if (!groupId) return res.status(400).json({error: 'グループIDは必須です。'});
    if (!participantCount || participantCount < 2) return res.status(400).json({error: '参加人数は2人以上で設定してください。'});
    if (!prizes || !Array.isArray(prizes) || prizes.length !== participantCount) return res.status(400).json({error: '参加人数と景品の数が一致していません。'});

    let hashedPassword = null;
    if (eventPassword && eventPassword.trim() !== '') {
      hashedPassword = await bcrypt.hash(eventPassword, saltRounds);
    }

    const groupDoc = await firestore.collection('groups').doc(groupId).get();
    const groupParticipants = groupDoc.data().participants || [];

    const participants = Array.from({length: participantCount}, (_, i) => {
      const groupParticipant = groupParticipants[i];
      return {
        slot: i,
        name: null,
        deleteToken: null,
        color: groupParticipant ? groupParticipant.color : `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        id: groupParticipant ? groupParticipant.id : crypto.randomBytes(16).toString('hex'),
      };
    });

    const lines = generateLines(participantCount);

    const eventData = {
      eventName: eventName || '無題のイベント',
      prizes: prizes.map((p) => (typeof p === 'string' ? {name: p, imageUrl: null} : p)),
      lines,
      groupId,
      participantCount,
      participants,
      displayMode,
      eventPassword: hashedPassword,
      createdAt: new Date(),
      ownerId: req.user.id,
      status: 'pending',
    };

    const docRef = await firestore.collection('events').add(eventData);
    res.status(201).json({id: docRef.id});
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({error: 'イベントの作成に失敗しました。'});
  }
};

exports.copyEvent = async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventRef = firestore.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({error: 'コピー元のイベントが見つかりません。'});
    }

    const originalEvent = eventDoc.data();
    if (originalEvent.ownerId !== req.user.id) {
      return res.status(403).json({error: 'このイベントをコピーする権限がありません。'});
    }

    const initialParticipants = Array.from({length: originalEvent.participantCount}, (_, i) => ({
      slot: i,
      name: null,
      memberId: null,
      iconUrl: null,
      color: `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, '0')}`,
    }));

    const newEventData = {
      ...originalEvent,
      createdAt: new Date(),
      status: 'pending',
      participants: initialParticipants,
    };
    delete newEventData.results;

    const newDocRef = await firestore.collection('events').add(newEventData);
    res.status(201).json({newId: newDocRef.id});
  } catch (error) {
    console.error('Error copying event:', error);
    res.status(500).json({error: 'イベントのコピーに失敗しました。'});
  }
};

exports.getEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const doc = await firestore.collection('events').doc(eventId).get();
    if (!doc.exists || doc.data().ownerId !== req.user.id) {
      return res.status(404).json({error: 'イベントが見つからないか、アクセス権がありません。'});
    }
    res.status(200).json({id: doc.id, ...doc.data()});
  } catch (error) {
    console.error(`Error fetching event ${req.params.id}:`, error);
    res.status(500).json({error: 'イベントの読み込みに失敗しました。'});
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const {id: eventId} = req.params;
    const {prizes, participantCount, displayMode, eventPassword, eventName} = req.body;

    if (!participantCount || participantCount < 2) return res.status(400).json({error: '参加人数は2人以上で設定してください。'});
    if (!prizes || !Array.isArray(prizes) || prizes.length !== participantCount) return res.status(400).json({error: '参加人数と景品の数が一致していません。'});

    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();

    if (!doc.exists) return res.status(404).json({error: 'イベントが見つかりません。'});

    const eventData = doc.data();
    if (eventData.ownerId !== req.user.id) return res.status(403).json({error: 'このイベントを編集する権限がありません。'});
    if (eventData.status === 'started') return res.status(400).json({error: '開始済みのイベントは編集できません。'});

    const updateData = {
      eventName: eventName || '無題のイベント',
      prizes: prizes.map((p) => (typeof p === 'string' ? {name: p, imageUrl: null} : p)),
      participantCount,
      displayMode,
    };

    if (eventPassword && eventPassword.trim() !== '') {
      updateData.eventPassword = await bcrypt.hash(eventPassword, saltRounds);
    }

    if (participantCount !== eventData.participantCount) {
      const groupDoc = await firestore.collection('groups').doc(eventData.groupId).get();
      const groupParticipants = groupDoc.exists ? groupDoc.data().participants || [] : [];
      const newParticipants = Array.from({length: participantCount}, (_, i) => {
        const existingParticipant = eventData.participants[i];
        const groupParticipant = groupParticipants[i];
        if (existingParticipant) return existingParticipant;
        return {
          slot: i,
          name: null,
          deleteToken: null,
          color: groupParticipant ? groupParticipant.color : `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          id: groupParticipant ? groupParticipant.id : crypto.randomBytes(16).toString('hex'),
        };
      });
      updateData.participants = newParticipants;
      updateData.lines = generateLines(participantCount);
    }

    await eventRef.update(updateData);
    res.status(200).json({id: eventId, message: 'イベントが正常に更新されました。'});
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({error: 'イベントの更新に失敗しました。'});
  }
};

exports.startEvent = async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();
    if (!doc.exists || doc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: 'このイベントを開始する権限がありません。'});
    }

    const eventData = doc.data();
    if (eventData.status === 'started') {
      return res.status(400).json({error: 'イベントは既に開始されています。'});
    }

    const results = calculateResults(eventData.participants, eventData.lines, eventData.prizes);

    await eventRef.update({status: 'started', results: results});
    res.status(200).json({message: 'イベントが開始されました。', results});
  } catch (error) {
    console.error('Error starting event:', error);
    res.status(500).json({error: 'イベントの開始に失敗しました。'});
  }
};

exports.getPublicEventData = async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();
    if (!doc.exists) return res.status(404).json({error: 'イベントが見つかりません。'});
    const data = doc.data();

    const groupDoc = await firestore.collection('groups').doc(data.groupId).get();
    const eventName = groupDoc.exists ? groupDoc.data().name : `イベント`;

    const publicPrizes = data.displayMode === 'private' ? data.prizes.map(() => '？？？') : data.prizes;
    const publicData = {
      eventName: eventName,
      participants: data.participants,
      prizes: publicPrizes,
      lines: data.lines,
      hasPassword: !!data.eventPassword,
      displayMode: data.displayMode,
      status: data.status,
      results: data.status === 'started' ? data.results : null,
      groupId: data.groupId,
    };
    res.status(200).json(publicData);
  } catch (error) {
    console.error('Error fetching public event data:', error);
    res.status(500).json({error: 'イベント情報の取得に失敗しました。'});
  }
};

exports.joinEvent = async (req, res) => {
  try {
    const {eventId} = req.params;
    const {name, slot, memberId} = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({error: '名前は必須です。'});
    }

    const eventRef = firestore.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) return res.status(404).json({error: 'イベントが見つかりません。'});

    const eventData = eventDoc.data();
    const groupId = eventData.groupId;
    const membersRef = firestore.collection('groups').doc(groupId).collection('members');

    let memberDoc;
    if (memberId) {
      const doc = await membersRef.doc(memberId).get();
      if (doc.exists) memberDoc = doc;
    } else {
      const memberQuery = await membersRef.where('name', '==', name.trim()).limit(1).get();
      if (!memberQuery.empty) {
        memberDoc = memberQuery.docs[0];
      }
    }

    if (memberDoc && memberDoc.exists) {
      const memberData = memberDoc.data();
      if (memberData.password) {
        return res.status(401).json({
          error: '合言葉が必要です。',
          requiresPassword: true,
          memberId: memberDoc.id,
          name: memberData.name,
        });
      }
      if (slot !== undefined && slot !== null) {
        const newParticipants = [...eventData.participants];
        if (slot < 0 || slot >= newParticipants.length || newParticipants[slot].name !== null) {
          return res.status(409).json({error: 'この参加枠は既に埋まっているか、無効です。'});
        }
        newParticipants[slot].name = memberData.name;
        newParticipants[slot].memberId = memberDoc.id;
        newParticipants[slot].iconUrl = memberData.iconUrl;
        newParticipants[slot].color = memberData.color;

        await eventRef.update({participants: newParticipants});
      }
      return res.status(200).json({
        message: 'ログインしました。',
        token: memberData.deleteToken,
        memberId: memberDoc.id,
        name: memberData.name,
      });
    }

    const newMemberId = crypto.randomBytes(16).toString('hex');
    const deleteToken = crypto.randomBytes(16).toString('hex');
    const newColor = getNextAvailableColor((await membersRef.get()).docs.map((d) => d.data().color));
    const newMemberData = {
      id: newMemberId,
      name: name.trim(),
      password: null,
      deleteToken,
      color: newColor,
      iconUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=random&color=fff`,
      createdAt: new Date(),
    };

    await membersRef.doc(newMemberId).set(newMemberData);

    if (slot !== undefined && slot !== null) {
      const newParticipants = [...eventData.participants];
      if (slot < 0 || slot >= newParticipants.length || newParticipants[slot].name !== null) {
        return res.status(409).json({error: 'この参加枠は既に埋まっているか、無効です。'});
      }
      newParticipants[slot].name = newMemberData.name;
      newParticipants[slot].memberId = newMemberId;
      newParticipants[slot].iconUrl = newMemberData.iconUrl;
      newParticipants[slot].color = newMemberData.color;
      await eventRef.update({participants: newParticipants});
    }

    res.status(201).json({
      message: '登録して参加しました。',
      token: deleteToken,
      memberId: newMemberId,
      name: newMemberData.name,
    });
  } catch (error) {
    console.error('Error joining event:', error);
    res.status(500).json({error: '参加処理中にエラーが発生しました。'});
  }
};

exports.joinSlot = async (req, res) => {
  try {
    const {eventId} = req.params;
    const {memberId, slot} = req.body;
    const token = req.headers['x-auth-token'];

    if (!token) {
      return res.status(401).json({error: '認証トークンが必要です。'});
    }
    if (slot === undefined || slot === null) {
      return res.status(400).json({error: '参加枠が指定されていません。'});
    }

    const eventRef = firestore.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }

    const eventData = eventDoc.data();
    const groupId = eventData.groupId;

    const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists || memberDoc.data().deleteToken !== token) {
      return res.status(403).json({error: '認証情報が無効です。'});
    }
    const memberData = memberDoc.data();

    const newParticipants = [...eventData.participants];
    if (slot < 0 || slot >= newParticipants.length || newParticipants[slot].name !== null) {
      return res.status(409).json({error: 'この参加枠は既に埋まっているか、無効です。'});
    }
    newParticipants[slot].name = memberData.name;
    newParticipants[slot].memberId = memberDoc.id;
    newParticipants[slot].iconUrl = memberData.iconUrl;
    newParticipants[slot].color = memberData.color;

    await eventRef.update({participants: newParticipants});

    res.status(200).json({message: 'イベントに参加しました。'});
  } catch (error) {
    console.error('Error joining slot:', error);
    res.status(500).json({error: '参加処理中にエラーが発生しました。'});
  }
};

exports.verifyPasswordAndJoin = async (req, res) => {
  try {
    const {eventId} = req.params;
    const {memberId, password, slot} = req.body;

    if (!memberId || !password) {
      return res.status(400).json({error: 'IDと合言葉は必須です。'});
    }

    const eventRef = firestore.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) return res.status(404).json({error: 'イベントが見つかりません。'});

    const eventData = eventDoc.data();
    const groupId = eventData.groupId;

    const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists || !memberDoc.data().password) {
      return res.status(401).json({error: 'ユーザーが見つからないか、合言葉が設定されていません。'});
    }

    const memberData = memberDoc.data();
    const match = await bcrypt.compare(password, memberData.password);

    if (!match) {
      return res.status(401).json({error: '合言葉が違います。'});
    }

    if (slot !== undefined && slot !== null) {
      const newParticipants = [...eventData.participants];
      if (slot < 0 || slot >= newParticipants.length || newParticipants[slot].name !== null) {
        return res.status(409).json({error: 'この参加枠は既に埋まっているか、無効です。'});
      }
      newParticipants[slot].name = memberData.name;
      newParticipants[slot].memberId = memberDoc.id;
      newParticipants[slot].iconUrl = memberData.iconUrl;
      newParticipants[slot].color = memberData.color;

      await eventRef.update({participants: newParticipants});
    }

    res.status(200).json({
      message: 'ログインしました。',
      token: memberData.deleteToken,
      memberId: memberDoc.id,
      name: memberData.name,
    });
  } catch (error) {
    console.error('Error verifying password:', error);
    res.status(500).json({error: '認証中にエラーが発生しました。'});
  }
};

exports.deleteParticipant = async (req, res) => {
  try {
    const {eventId} = req.params;
    const {deleteToken} = req.body;

    if (!deleteToken) {
      return res.status(400).json({error: '削除トークンが必要です。'});
    }

    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();

    if (!doc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }

    const eventData = doc.data();
    if (eventData.status === 'started') {
      return res.status(403).json({error: 'イベント開始後は参加情報を削除できません。'});
    }

    const newParticipants = [...eventData.participants];
    const participantIndex = newParticipants.findIndex((p) => p.deleteToken === deleteToken);

    if (participantIndex === -1) {
      const membersSnapshot = await firestore.collection('groups').doc(eventData.groupId).collection('members').where('deleteToken', '==', deleteToken).get();
      if (membersSnapshot.empty) {
        return res.status(404).json({error: '指定された参加者情報が見つかりません。'});
      }
      const memberIdToDelete = membersSnapshot.docs[0].id;
      const participantIdx = newParticipants.findIndex((p) => p.memberId === memberIdToDelete);

      if (participantIdx === -1) {
        return res.status(404).json({error: 'イベントに参加していません。'});
      }

      newParticipants[participantIdx].name = null;
      newParticipants[participantIdx].memberId = null;
      newParticipants[participantIdx].iconUrl = null;
      await eventRef.update({participants: newParticipants});
      return res.status(200).json({message: 'イベントへの参加を取り消しました。'});
    }

    newParticipants[participantIndex].name = null;
    newParticipants[participantIndex].deleteToken = null;
    newParticipants[participantIndex].memberId = null;
    newParticipants[participantIndex].iconUrl = null;

    const batch = firestore.batch();
    batch.update(eventRef, {participants: newParticipants});

    await batch.commit();

    res.status(200).json({message: '参加情報が削除されました。'});
  } catch (error) {
    console.error('Error deleting participant data:', error);
    res.status(500).json({error: '参加情報の削除中にエラーが発生しました。'});
  }
};

exports.getEventsByCustomUrl = async (req, res) => {
  try {
    const {customUrl} = req.params;
    const groupSnapshot = await firestore.collection('groups').where('customUrl', '==', customUrl).limit(1).get();

    if (groupSnapshot.empty) {
      return res.status(404).json({error: '指定されたURLのグループが見つかりません。'});
    }
    const groupId = groupSnapshot.docs[0].id;

    const eventsSnapshot = await firestore.collection('events').where('groupId', '==', groupId).where('status', '!=', 'started').orderBy('status').orderBy('createdAt', 'desc').get();

    const events = eventsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching events by custom URL:', error);
    res.status(500).json({error: 'イベントの読み込みに失敗しました。'});
  }
};
