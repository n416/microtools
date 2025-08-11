const {firestore, bucket} = require('../utils/firestore');
const {FieldValue} = require('@google-cloud/firestore'); // FieldValueを追加
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const saltRounds = 10;

exports.createGroup = async (req, res) => {
  try {
    const {groupName, participants} = req.body;
    if (!groupName || groupName.trim() === '') {
      return res.status(400).json({error: 'グループ名が必要です。'});
    }
    const newParticipants = (participants || []).map((p) => ({
      id: p.id || crypto.randomBytes(16).toString('hex'),
      name: p.name,
      color: p.color || `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    }));

    const groupData = {
      name: groupName,
      ownerId: req.user.id,
      createdAt: new Date(),
      participants: newParticipants,
    };
    const docRef = await firestore.collection('groups').add(groupData);
    res.status(201).json({id: docRef.id, ...groupData});
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({error: 'グループの作成に失敗しました。'});
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const {groupId} = req.params;
    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: 'このグループを削除する権限がありません。'});
    }

    // Firestoreのバッチ処理を開始
    const batch = firestore.batch();

    // 関連するイベントを削除
    const eventsSnapshot = await firestore.collection('events').where('groupId', '==', groupId).get();
    eventsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 関連するメンバーを削除 (サブコレクション)
    const membersSnapshot = await groupRef.collection('members').get();
    membersSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 関連する賞品マスターを削除 (サブコレクション)
    const prizeMastersSnapshot = await groupRef.collection('prizeMasters').get();
    prizeMastersSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 最後にグループ自体を削除
    batch.delete(groupRef);

    // バッチ処理を実行
    await batch.commit();

    res.status(200).json({message: 'グループと関連データが正常に削除されました。'});
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({error: 'グループの削除に失敗しました。'});
  }
};

exports.getGroups = async (req, res) => {
  try {
    const groupsSnapshot = await firestore.collection('groups').where('ownerId', '==', req.user.id).orderBy('createdAt', 'desc').get();
    const groups = groupsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({error: 'グループの読み込みに失敗しました。'});
  }
};

exports.getGroup = async (req, res) => {
  try {
    const {groupId} = req.params;
    const groupDoc = await firestore.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) {
      return res.status(404).json({error: 'グループが見つかりません。'});
    }
    res.status(200).json({id: groupDoc.id, ...groupDoc.data()});
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({error: 'グループの読み込みに失敗しました。'});
  }
};

exports.updateParticipantColor = async (req, res) => {
  try {
    const {groupId, participantId} = req.params;
    const {color} = req.body;

    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const participants = groupDoc.data().participants || [];
    const participantIndex = participants.findIndex((p) => p.id === participantId);

    if (participantIndex === -1) {
      return res.status(404).json({error: '参加者が見つかりません。'});
    }

    participants[participantIndex].color = color;

    await groupRef.update({participants: participants});
    res.status(200).json({message: '色が更新されました。'});
  } catch (error) {
    console.error('Error updating participant color:', error);
    res.status(500).json({error: '色の更新に失敗しました。'});
  }
};

exports.updateParticipants = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {participants} = req.body;

    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const updatedParticipants = participants.map((p) => ({
      id: p.id.startsWith('temp_') ? crypto.randomBytes(16).toString('hex') : p.id,
      name: p.name,
      color: p.color,
    }));

    await groupRef.update({participants: updatedParticipants});
    res.status(200).json({message: '参加者リストが更新されました。'});
  } catch (error) {
    console.error('Error updating participants:', error);
    res.status(500).json({error: '参加者リストの更新に失敗しました。'});
  }
};

exports.updateGroupSettings = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {customUrl, password, noIndex, groupName} = req.body;
    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: 'このグループの設定を編集する権限がありません。'});
    }

    const updateData = {
      noIndex: !!noIndex,
    };

    if (groupName && groupName.trim()) {
      updateData.name = groupName.trim();
    }

    if (customUrl !== undefined) {
      const trimmedUrl = customUrl.trim();
      if (trimmedUrl) {
        const querySnapshot = await firestore.collection('groups').where('customUrl', '==', trimmedUrl).get();
        const isTaken = !querySnapshot.empty && querySnapshot.docs.some((doc) => doc.id !== groupId);
        if (isTaken) {
          return res.status(409).json({error: 'このカスタムURLは既に使用されています。'});
        }
      }
      updateData.customUrl = trimmedUrl;
    }
    // パスワードが空文字列で送信された場合は何もしない（削除は別APIで行う）
    if (typeof password === 'string' && password) {
      updateData.password = await bcrypt.hash(password, saltRounds);
    }

    await groupRef.update(updateData);
    res.status(200).json({message: 'グループ設定が正常に更新されました。'});
  } catch (error) {
    console.error('Error updating group settings:', error);
    res.status(500).json({error: 'グループ設定の更新中にエラーが発生しました。'});
  }
};

/**
 * 【新規】グループの合言葉を削除するAPI
 */
exports.deleteGroupPassword = async (req, res) => {
  try {
    const {groupId} = req.params;
    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    await groupRef.update({
      password: FieldValue.delete(),
    });

    res.status(200).json({message: '合言葉を削除しました。'});
  } catch (error) {
    console.error('Error deleting group password:', error);
    res.status(500).json({error: '合言葉の削除に失敗しました。'});
  }
};

/**
 * 【修正】グループの合言葉を検証し、セッションに認証済みフラグを立てる
 */
exports.verifyPassword = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {password} = req.body;

    if (!password) {
      return res.status(400).json({error: '合言葉が必要です。'});
    }

    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return res.status(404).json({error: 'グループが見つかりません。'});
    }

    const groupData = groupDoc.data();
    const match = groupData.password ? await bcrypt.compare(password, groupData.password) : true;

    if (match) {
      if (!req.session.verifiedGroups) {
        req.session.verifiedGroups = [];
      }
      if (!req.session.verifiedGroups.includes(groupId)) {
        req.session.verifiedGroups.push(groupId);
      }

      // ★★★ 修正箇所 ★★★
      // セッションの保存が完了してからレスポンスを返すように変更
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({success: false, error: 'セッションの保存に失敗しました。'});
        }
        res.status(200).json({success: true, message: '認証に成功しました。'});
      });
      // ★★★ 修正箇所ここまで ★★★
    } else {
      res.status(401).json({success: false, error: '合言葉が違います。'});
    }
  } catch (error) {
    console.error('Error checking group password:', error);
    res.status(500).json({error: '合言葉の確認中にエラーが発生しました。'});
  }
};

exports.getMemberSuggestions = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {q} = req.query;

    if (!q) {
      return res.json([]);
    }

    const membersRef = firestore.collection('groups').doc(groupId).collection('members');
    const snapshot = await membersRef
      .where('name', '>=', q)
      .where('name', '<=', q + '\uf8ff')
      .limit(10)
      .get();

    const suggestions = snapshot.docs.map((doc) => ({id: doc.id, name: doc.data().name, hasPassword: !!doc.data().password}));
    res.status(200).json(suggestions);
  } catch (error) {
    console.error('Error fetching member suggestions:', error);
    res.status(500).json({error: 'メンバー候補の取得に失敗しました。'});
  }
};

exports.loginMember = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {memberId, password} = req.body;

    if (!memberId || !password) {
      return res.status(400).json({error: 'IDと合言葉は必須です。'});
    }

    const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      return res.status(404).json({error: 'ユーザーが見つかりません。'});
    }

    const memberData = memberDoc.data();

    if (!memberData.password) {
      const tempToken = crypto.randomBytes(16).toString('hex');
      return res.status(200).json({
        message: '新しい合言葉を設定してください。',
        token: tempToken,
        requiresPasswordReset: true,
        memberId: memberDoc.id,
        name: memberData.name,
      });
    }

    const match = await bcrypt.compare(password, memberData.password);

    if (match) {
      res.status(200).json({
        message: 'ログイン成功',
        token: memberData.deleteToken,
        memberId: memberDoc.id,
        name: memberData.name,
      });
    } else {
      res.status(401).json({error: '合言葉が違います。'});
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({error: 'ログイン処理中にエラーが発生しました。'});
  }
};

exports.getPrizeMasters = async (req, res) => {
  try {
    const {groupId} = req.params;
    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const mastersSnapshot = await groupRef.collection('prizeMasters').orderBy('createdAt', 'desc').get();
    const prizeMasters = mastersSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(prizeMasters);
  } catch (error) {
    console.error('Error fetching prize masters:', error);
    res.status(500).json({error: '賞品マスターの読み込みに失敗しました。'});
  }
};

exports.generatePrizeMasterUploadUrl = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {fileType} = req.body;
    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const fileExt = fileType.split('/')[1];
    if (!['png', 'jpeg', 'jpg', 'gif', 'webp'].includes(fileExt)) {
      return res.status(400).json({error: '無効なファイルタイプです。'});
    }

    const fileName = `prize-masters/${groupId}/${Date.now()}.${fileExt}`;
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
    console.error('Error generating upload URL for prize master:', error);
    res.status(500).json({error: 'URLの生成に失敗しました。'});
  }
};

exports.addPrizeMaster = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {name, imageUrl} = req.body;

    if (!name || !imageUrl) {
      return res.status(400).json({error: '賞品名と画像URLは必須です。'});
    }

    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const newMaster = {
      name,
      imageUrl,
      createdAt: new Date(),
    };

    const docRef = await groupRef.collection('prizeMasters').add(newMaster);
    res.status(201).json({id: docRef.id, ...newMaster});
  } catch (error) {
    console.error('Error adding prize master:', error);
    res.status(500).json({error: '賞品マスターの追加に失敗しました。'});
  }
};

exports.deletePrizeMaster = async (req, res) => {
  try {
    const {masterId} = req.params;
    const {groupId} = req.body;

    if (!groupId) {
      return res.status(400).json({error: 'グループIDが必要です。'});
    }

    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const masterRef = groupRef.collection('prizeMasters').doc(masterId);
    const masterDoc = await masterRef.get();

    if (!masterDoc.exists) {
      return res.status(404).json({error: '削除対象の賞品マスターが見つかりません。'});
    }

    const {imageUrl} = masterDoc.data();

    if (imageUrl && imageUrl.startsWith(`https://storage.googleapis.com/${bucket.name}/`)) {
      try {
        const fileName = imageUrl.split(`${bucket.name}/`)[1];
        await bucket.file(fileName).delete();
      } catch (gcsError) {
        console.error(`GCS file deletion failed, but proceeding: ${gcsError.message}`);
      }
    }

    await masterRef.delete();

    res.status(200).json({message: '賞品マスターを削除しました。'});
  } catch (error) {
    console.error('Error deleting prize master:', error);
    res.status(500).json({error: '賞品マスターの削除に失敗しました。'});
  }
};
