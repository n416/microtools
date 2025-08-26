const {firestore, bucket} = require('../utils/firestore');
const {generateLines, calculateResults} = require('../utils/amidakuji');
const {getNextAvailableColor} = require('../utils/color');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const saltRounds = 10;

// 【新規】シェアページ専用の認証不要APIコントローラ
exports.getPublicShareData = async (req, res) => {
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

    const safeEventName = eventData.eventName || '無題のイベント';
    const eventName = groupData.name ? `${groupData.name} - ${safeEventName}` : safeEventName;

    const publicData = {
      eventName: eventName,
      participants: eventData.participants,
      prizes: eventData.prizes,
      lines: eventData.lines,
      displayMode: eventData.displayMode,
      status: eventData.status,
      results: eventData.status === 'started' ? eventData.results : null,
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

    // 修正点：終了済みのイベントも全て取得するようにクエリを変更
    const eventsSnapshot = await firestore.collection('events').where('groupId', '==', groupId).orderBy('createdAt', 'desc').get();

    const events = eventsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching public events for group:', error);
    res.status(500).json({error: 'イベントの読み込みに失敗しました。'});
  }
};

exports.createEvent = async (req, res) => {
  try {
    const {prizes, groupId, displayMode, eventName} = req.body;
    const participantCount = prizes ? prizes.length : 0;

    if (!groupId) return res.status(400).json({error: 'グループIDは必須です。'});
    if (participantCount < 2) return res.status(400).json({error: '景品は2つ以上で設定してください。'});

    const groupDoc = await firestore.collection('groups').doc(groupId).get();

    const participants = Array.from({length: participantCount}, (_, i) => {
      return {
        slot: i,
        name: null,
        deleteToken: null,
        color: getNextAvailableColor([]),
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
      ownerId: req.user.id,
    };
    delete newEventData.results;
    delete newEventData.eventPassword;

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
    if (!doc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }
    const eventData = doc.data();
    const groupRef = firestore.collection('groups').doc(eventData.groupId);
    const groupDoc = await groupRef.get();
    if (!groupDoc.exists) {
      return res.status(404).json({error: '所属グループが見つかりません。'});
    }

    const groupData = groupDoc.data();
    const isOwner = req.user && groupData.ownerId === req.user.id;

    if (groupData.password) {
      if (!isOwner && (!req.session.verifiedGroups || !req.session.verifiedGroups.includes(eventData.groupId))) {
        return res.status(403).json({error: 'このグループへのアクセスには合言葉が必要です。', requiresPassword: true, groupId: eventData.groupId, groupName: groupData.name});
      }
    }

    res.status(200).json({id: doc.id, ...eventData});
  } catch (error) {
    console.error(`Error fetching event ${req.params.id}:`, error);
    res.status(500).json({error: 'イベントの読み込みに失敗しました。'});
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const {id: eventId} = req.params;
    const {prizes, displayMode, eventName} = req.body;
    const participantCount = prizes ? prizes.length : 0;

    if (participantCount < 2) return res.status(400).json({error: '景品は2つ以上で設定してください。'});

    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();

    if (!doc.exists) return res.status(404).json({error: 'イベントが見つかりません。'});

    const eventData = doc.data();
    if (eventData.ownerId !== req.user.id) return res.status(403).json({error: 'このイベントを編集する権限がありません。'});
    if (eventData.status === 'started') return res.status(400).json({error: '開始済みのイベントは編集できません。'});

    // ▼▼▼ 不要画像クリーンアップ処理を強化 ▼▼▼
    const oldImageUrls = new Set((eventData.prizes || []).map((p) => p.imageUrl).filter(Boolean));
    const newImageUrls = new Set(prizes.map((p) => p.imageUrl).filter(Boolean));

    // 古いリストにはあったが、新しいリストにはないURLを削除候補とする
    const urlsToDelete = [...oldImageUrls].filter((url) => !newImageUrls.has(url));

    for (const urlToDelete of urlsToDelete) {
      // 削除候補のURLが、他のどのイベントでも使われていないことを確認する
      const querySnapshot = await firestore
        .collection('events')
        .where(
          'prizes',
          'array-contains-any',
          prizes.filter((p) => p.imageUrl === urlToDelete).map((p) => ({name: p.name, imageUrl: p.imageUrl}))
        )
        .limit(1)
        .get();

      // 他のイベントで参照が見つからなければ、GCSからファイルを削除
      if (querySnapshot.empty) {
        try {
          const fileName = urlToDelete.split(`${bucket.name}/`)[1]?.split('?')[0];
          if (fileName && fileName.startsWith('shared_images/')) {
            await bucket.file(fileName).delete();
            console.log(`Deleted unused image: ${fileName}`);
          }
        } catch (gcsError) {
          console.error(`Failed to delete GCS file, but proceeding: ${gcsError.message}`);
        }
      }
    }
    // ▲▲▲ クリーンアップ処理ここまで ▲▲▲

    const updateData = {
      eventName: eventName || '無題のイベント',
      prizes: prizes.map((p) => ({name: p.name, imageUrl: p.imageUrl || null})),
      participantCount,
      displayMode,
    };

    if (participantCount !== eventData.participantCount) {
      const newParticipants = Array.from({length: participantCount}, (_, i) => ({
        slot: i,
        name: null,
        deleteToken: null,
      }));
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

exports.deleteEvent = async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();

    if (!doc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }

    const eventData = doc.data();
    if (eventData.ownerId !== req.user.id) {
      return res.status(403).json({error: 'このイベントを削除する権限がありません。'});
    }

    await eventRef.delete();
    res.status(200).json({message: 'イベントを削除しました。'});
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({error: 'イベントの削除に失敗しました。'});
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

    const publicPrizes = eventData.displayMode === 'private' && eventData.status !== 'started' ? eventData.prizes.map(() => ({name: '？？？', imageUrl: null})) : eventData.prizes;

    const otherEventsSnapshot = await firestore.collection('events').where('groupId', '==', eventData.groupId).where('status', '==', 'pending').get();

    const otherEvents = otherEventsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()})).filter((event) => event.id !== eventId);

    const publicData = {
      eventName: eventName,
      participants: eventData.participants,
      prizes: publicPrizes,
      lines: eventData.lines,
      hasPassword: !!groupData.password,
      displayMode: eventData.displayMode,
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

exports.joinEvent = async (req, res) => {
  try {
    const {eventId} = req.params;
    const {name, memberId} = req.body;

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

    let memberData;
    let token;
    let finalMemberId;

    if (memberDoc && memberDoc.exists) {
      memberData = memberDoc.data();
      if (memberData.password) {
        // パスワードが設定されている場合は、必ず401エラーを返す
        return res.status(401).json({
          error: '合言葉が必要です。',
          requiresPassword: true,
          memberId: memberDoc.id,
          name: memberData.name,
        });
      }
      token = memberData.deleteToken;
      finalMemberId = memberDoc.id;
    } else {
      finalMemberId = crypto.randomBytes(16).toString('hex');
      token = crypto.randomBytes(16).toString('hex');
      const newColor = getNextAvailableColor((await membersRef.get()).docs.map((d) => d.data().color));
      memberData = {
        id: finalMemberId,
        name: name.trim(),
        password: null,
        deleteToken: token,
        color: newColor,
        iconUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=random&color=fff`,
        createdAt: new Date(),
      };
      await membersRef.doc(finalMemberId).set(memberData);
    }

    // ▼▼▼ ログイン処理はここまで。ここから下はイベント参加処理 ▼▼▼

    if (eventData.status !== 'started') {
      const alreadyJoined = eventData.participants.some((p) => p.memberId === finalMemberId);
      if (alreadyJoined) {
        return res.status(200).json({
          message: '既にイベントに参加済みです。',
          token: token,
          memberId: finalMemberId,
          name: memberData.name,
        });
      }

      const availableSlotIndex = eventData.participants.findIndex((p) => p.name === null);
      if (availableSlotIndex === -1) {
        // イベントが満員の場合、エラーではなく成功ステータスで特別なフラグを返す
        return res.status(200).json({
          message: 'ログインには成功しましたが、イベントが満員のため参加できませんでした。',
          token: token,
          memberId: finalMemberId,
          name: memberData.name,
          status: 'event_full', // 満員であることを示すフラグ
        });
      }

      const newParticipants = [...eventData.participants];
      newParticipants[availableSlotIndex] = {
        ...newParticipants[availableSlotIndex],
        name: memberData.name,
        memberId: finalMemberId,
        iconUrl: memberData.iconUrl,
        color: memberData.color,
      };

      await eventRef.update({participants: newParticipants});
    }

    res.status(200).json({
      message: eventData.status === 'started' ? 'ログインしました。イベントは開始済みのため、結果を確認してください。' : 'イベントに参加しました。',
      token: token,
      memberId: finalMemberId,
      name: memberData.name,
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

    if (eventData.status === 'started') {
      return res.status(403).json({error: 'このイベントは既に開始されているため、参加できません。'});
    }

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

    if (slot !== undefined && slot !== null && eventData.status !== 'started') {
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

    // Content-Typeヘッダーを明示的に設定
    res.type('application/json');

    // ログイン成功レスポンスを返す
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

exports.generatePrizeUploadUrl = async (req, res) => {
  try {
    const {eventId} = req.params;
    const {fileType, fileHash} = req.body; // fileHashを受け取る
    const eventRef = firestore.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists || eventDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: 'このイベントの画像をアップロードする権限がありません。'});
    }

    const fileExt = fileType.split('/')[1];
    if (!['png', 'jpeg', 'jpg', 'gif', 'webp'].includes(fileExt)) {
      return res.status(400).json({error: '無効なファイルタイプです。'});
    }

    // ファイル名をハッシュに変更
    const fileName = `shared_images/${fileHash}.${fileExt}`;
    const file = bucket.file(fileName);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: fileType,
    });

    res.status(200).json({
      signedUrl: url,
      imageUrl: `https://storage.googleapis.com/${bucket.name}/${fileName}`,
    });
  } catch (error) {
    console.error('Error generating upload URL for event prize:', error);
    res.status(500).json({error: 'URLの生成に失敗しました。'});
  }
};

exports.regenerateLines = async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();

    if (!doc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }
    const eventData = doc.data();
    if (eventData.ownerId !== req.user.id) {
      return res.status(403).json({error: 'このイベントを操作する権限がありません。'});
    }
    if (eventData.status === 'started') {
      return res.status(400).json({error: '開始済みのイベントのあみだくじは変更できません。'});
    }

    // 新しい線を生成
    const newLines = generateLines(eventData.participantCount);
    // 新しい線に基づいて結果を再計算
    const newResults = calculateResults(eventData.participants, newLines, eventData.prizes);

    // 線と結果の両方を更新
    await eventRef.update({
      lines: newLines,
      results: newResults, // 結果も更新する
    });

    // クライアントにも両方の情報を返す
    res.status(200).json({
      message: 'あみだくじが再生成されました。',
      lines: newLines,
      results: newResults,
    });
  } catch (error) {
    console.error('Error regenerating Amidakuji lines:', error);
    res.status(500).json({error: 'あみだくじの再生成に失敗しました。'});
  }
};

exports.shufflePrizes = async (req, res) => {
  try {
    const {eventId} = req.params;
    const {shuffledPrizes} = req.body;

    if (!shuffledPrizes || !Array.isArray(shuffledPrizes)) {
      return res.status(400).json({error: '景品リストが無効です。'});
    }

    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();

    if (!doc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }
    const eventData = doc.data();
    if (eventData.ownerId !== req.user.id) {
      return res.status(403).json({error: 'このイベントを操作する権限がありません。'});
    }

    // 新しい景品リストで結果を再計算
    const newResults = calculateResults(eventData.participants, eventData.lines, shuffledPrizes);

    // 景品リストと結果の両方を更新
    await eventRef.update({prizes: shuffledPrizes, results: newResults});

    res.status(200).json({message: '景品がシャッフルされました。', prizes: shuffledPrizes, results: newResults});
  } catch (error) {
    console.error('Error shuffling prizes:', error);
    res.status(500).json({error: '景品のシャッフルに失敗しました。'});
  }
};

exports.acknowledgeResult = async (req, res) => {
  try {
    const {eventId} = req.params;
    const {memberId} = req.body;
    const token = req.headers['x-auth-token'];

    if (!token || !memberId) {
      return res.status(400).json({error: '認証情報が不足しています。'});
    }

    const eventRef = firestore.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }
    const eventData = eventDoc.data();
    const groupId = eventData.groupId;

    // メンバーの存在とトークンの正当性を確認
    const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists || memberDoc.data().deleteToken !== token) {
      return res.status(403).json({error: '認証に失敗しました。'});
    }

    // participants配列を更新
    const participantIndex = eventData.participants.findIndex((p) => p.memberId === memberId);
    if (participantIndex === -1) {
      return res.status(404).json({error: 'イベントに参加していません。'});
    }

    const updatedParticipants = [...eventData.participants];
    updatedParticipants[participantIndex].acknowledgedResult = true;

    await eventRef.update({participants: updatedParticipants});

    res.status(200).json({message: '結果を確認しました。'});
  } catch (error) {
    console.error('Error acknowledging result:', error);
    res.status(500).json({error: '結果の確認処理に失敗しました。'});
  }
};
