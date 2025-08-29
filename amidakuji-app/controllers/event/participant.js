const {firestore} = require('../../utils/firestore');
const {getNextAvailableColor} = require('../../utils/color');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const saltRounds = 10;

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
        isActive: true, // ★ この行を追加
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

exports.fillSlots = async (req, res) => {
  try {
    const {eventId} = req.params;
    const {assignments} = req.body;

    if (!assignments || !Array.isArray(assignments)) {
      return res.status(400).json({error: '割り当てるメンバーのリストが必要です。'});
    }

    const eventRef = firestore.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }
    const eventData = eventDoc.data();
    const updatedParticipants = [...eventData.participants];

    // ▼▼▼ ここからが修正点 ▼▼▼

    // 1. 空いている参加枠のインデックス（位置）をすべて取得します
    const emptySlotIndices = updatedParticipants.map((participant, index) => (participant.name === null ? index : -1)).filter((index) => index !== -1);

    // 2. 取得した空き枠のインデックスをシャッフル（ランダムに並び替え）します
    for (let i = emptySlotIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [emptySlotIndices[i], emptySlotIndices[j]] = [emptySlotIndices[j], emptySlotIndices[i]];
    }

    // 3. 割り当てるメンバーを、シャッフルされた空き枠の位置にセットしていきます
    for (let i = 0; i < assignments.length && i < emptySlotIndices.length; i++) {
      const memberToAssign = assignments[i];
      const slotIndex = emptySlotIndices[i];

      const memberDoc = await firestore.collection('groups').doc(eventData.groupId).collection('members').doc(memberToAssign.id).get();
      if (memberDoc.exists) {
        const memberData = memberDoc.data();
        updatedParticipants[slotIndex] = {
          ...updatedParticipants[slotIndex],
          memberId: memberToAssign.id,
          name: memberData.name,
          color: memberData.color,
          iconUrl: memberData.iconUrl,
        };
      }
    }
    // ▲▲▲ 修正点ここまで ▲▲▲

    await eventRef.update({participants: updatedParticipants});

    res.status(200).json({message: '参加枠を更新しました。', participants: updatedParticipants});
  } catch (error) {
    console.error('Error filling slots:', error);
    res.status(500).json({error: '参加枠の更新に失敗しました。'});
  }
};
