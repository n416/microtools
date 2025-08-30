const {firestore, bucket} = require('../../utils/firestore');
const {generateLines} = require('../../utils/amidakuji');
const {getNextAvailableColor} = require('../../utils/color');

exports.createEvent = async (req, res) => {
  try {
    const {prizes, groupId, eventName, displayPrizeName, displayPrizeCount} = req.body;
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
      displayPrizeName: !!displayPrizeName,
      displayPrizeCount: !!displayPrizeCount,
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

exports.getEvent = async (req, res) => {
  try {
    // --- ▼▼▼ ログ追加 ▼▼▼ ---
    console.log('--- getEvent Start ---');
    const eventId = req.params.id;
    console.log(`[LOG] Fetching event with ID: ${eventId}`);
    // --- ▲▲▲ ログ追加 ▲▲▲ ---

    const doc = await firestore.collection('events').doc(eventId).get();
    if (!doc.exists) {
      // --- ▼▼▼ ログ追加 ▼▼▼ ---
      console.log('[LOG] Event not found in database.');
      // --- ▲▲▲ ログ追加 ▲▲▲ ---
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }
    const eventData = doc.data();
    // --- ▼▼▼ ログ追加 ▼▼▼ ---
    console.log('[LOG] Event data retrieved:', eventData);
    // --- ▲▲▲ ログ追加 ▲▲▲ ---

    const groupRef = firestore.collection('groups').doc(eventData.groupId);
    const groupDoc = await groupRef.get();
    if (!groupDoc.exists) {
      // --- ▼▼▼ ログ追加 ▼▼▼ ---
      console.log(`[LOG] Group with ID ${eventData.groupId} not found.`);
      // --- ▲▲▲ ログ追加 ▲▲▲ ---
      return res.status(404).json({error: '所属グループが見つかりません。'});
    }

    const groupData = groupDoc.data();
    // --- ▼▼▼ ログ追加 ▼▼▼ ---
    console.log('[LOG] Group data retrieved:', groupData);
    console.log('[LOG] Current user:', req.user);
    // --- ▲▲▲ ログ追加 ▲▲▲ ---

    const isOwner = req.user && groupData.ownerId === req.user.id;
    const isSysAdmin = req.user && req.user.role === 'system_admin' && !req.user.isImpersonating;
    // --- ▼▼▼ ログ追加 ▼▼▼ ---
    console.log(`[LOG] Permission Check: IsOwner=${isOwner}, IsSysAdmin=${isSysAdmin}`);
    // --- ▲▲▲ ログ追加 ▲▲▲ ---

    if (isOwner || isSysAdmin) {
      console.log('[LOG] Access Granted: User is owner or system admin.');
    } else {
      console.log('[LOG] User is not authorized.');
      return res.status(403).json({error: 'このイベントを閲覧する権限がありません。'});
    }

    // --- ▼▼▼ ログ追加 ▼▼▼ ---
    console.log('--- getEvent Success ---');
    // --- ▲▲▲ ログ追加 ▲▲▲ ---
    res.status(200).json({id: doc.id, ...eventData});
  } catch (error) {
    // --- ▼▼▼ ログ追加 ▼▼▼ ---
    console.error(`[ERROR] Fatal error in getEvent for event ID ${req.params.id}:`, error);
    // --- ▲▲▲ ログ追加 ▲▲▲ ---
    res.status(500).json({error: 'イベントの読み込みに失敗しました。'});
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const {id: eventId} = req.params;
    const {prizes, eventName, displayPrizeName, displayPrizeCount} = req.body;
    const participantCount = prizes ? prizes.length : 0;

    if (participantCount < 2) return res.status(400).json({error: '景品は2つ以上で設定してください。'});

    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();

    if (!doc.exists) return res.status(404).json({error: 'イベントが見つかりません。'});

    const eventData = doc.data();
    const isOwner = req.user && eventData.ownerId === req.user.id;
    const isSysAdmin = req.user && req.user.role === 'system_admin' && !req.user.isImpersonating;

    if (!isOwner && !isSysAdmin) {
      return res.status(403).json({error: 'このイベントを編集する権限がありません。'});
    }
    if (eventData.status === 'started') return res.status(400).json({error: '開始済みのイベントは編集できません。'});

    const oldImageUrls = new Set((eventData.prizes || []).map((p) => p.imageUrl).filter(Boolean));
    const newImageUrls = new Set(prizes.map((p) => p.imageUrl).filter(Boolean));
    const urlsToDelete = [...oldImageUrls].filter((url) => !newImageUrls.has(url));

    for (const urlToDelete of urlsToDelete) {
      const querySnapshot = await firestore
        .collection('events')
        .where(
          'prizes',
          'array-contains-any',
          prizes.filter((p) => p.imageUrl === urlToDelete).map((p) => ({name: p.name, imageUrl: p.imageUrl}))
        )
        .limit(1)
        .get();

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

    const updateData = {
      eventName: eventName || '無題のイベント',
      prizes: prizes.map((p) => ({name: p.name, imageUrl: p.imageUrl || null})),
      participantCount,
      displayPrizeName: !!displayPrizeName,
      displayPrizeCount: !!displayPrizeCount,
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

exports.updateEvent = async (req, res) => {
  try {
    const {id: eventId} = req.params;
    const {prizes, eventName} = req.body; // displayModeを削除
    const participantCount = prizes ? prizes.length : 0;

    if (participantCount < 2) return res.status(400).json({error: '景品は2つ以上で設定してください。'});

    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();

    if (!doc.exists) return res.status(404).json({error: 'イベントが見つかりません。'});

    const eventData = doc.data();
    const isOwner = req.user && eventData.ownerId === req.user.id;
    const isSysAdmin = req.user && req.user.role === 'system_admin' && !req.user.isImpersonating;

    if (!isOwner && !isSysAdmin) {
      return res.status(403).json({error: 'このイベントを編集する権限がありません。'});
    }
    if (eventData.status === 'started') return res.status(400).json({error: '開始済みのイベントは編集できません。'});

    const oldImageUrls = new Set((eventData.prizes || []).map((p) => p.imageUrl).filter(Boolean));
    const newImageUrls = new Set(prizes.map((p) => p.imageUrl).filter(Boolean));
    const urlsToDelete = [...oldImageUrls].filter((url) => !newImageUrls.has(url));

    for (const urlToDelete of urlsToDelete) {
      const querySnapshot = await firestore
        .collection('events')
        .where(
          'prizes',
          'array-contains-any',
          prizes.filter((p) => p.imageUrl === urlToDelete).map((p) => ({name: p.name, imageUrl: p.imageUrl}))
        )
        .limit(1)
        .get();

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

    const updateData = {
      eventName: eventName || '無題のイベント',
      prizes: prizes.map((p) => ({name: p.name, imageUrl: p.imageUrl || null})),
      participantCount,
      // displayMode, を削除
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

// (他の関数は変更なし)
exports.deleteEvent = async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();

    if (!doc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }

    const eventData = doc.data();
    const isOwner = req.user && eventData.ownerId === req.user.id;
    const isSysAdmin = req.user && req.user.role === 'system_admin' && !req.user.isImpersonating;

    if (!isOwner && !isSysAdmin) {
      return res.status(403).json({error: 'このイベントを削除する権限がありません。'});
    }

    await eventRef.delete();
    res.status(200).json({message: 'イベントを削除しました。'});
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({error: 'イベントの削除に失敗しました。'});
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
    const isOwner = req.user && originalEvent.ownerId === req.user.id;
    const isSysAdmin = req.user && req.user.role === 'system_admin' && !req.user.isImpersonating;

    if (!isOwner && !isSysAdmin) {
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
exports.copyEvent = async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventRef = firestore.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({error: 'コピー元のイベントが見つかりません。'});
    }

    const originalEvent = eventDoc.data();
    const isOwner = req.user && originalEvent.ownerId === req.user.id;
    const isSysAdmin = req.user && req.user.role === 'system_admin' && !req.user.isImpersonating;

    if (!isOwner && !isSysAdmin) {
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
