const {firestore} = require('../../utils/firestore');
const crypto = require('crypto');
const {getNextAvailableColor} = require('../../utils/color');
const {normalizeName} = require('../../utils/text');

exports.getMembers = async (req, res) => {
  try {
    const {groupId} = req.params;
    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const membersSnapshot = await groupRef.collection('members').orderBy('createdAt', 'asc').get();
    const members = membersSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(members);
  } catch (error) {
    console.error('Error getting members:', error);
    res.status(500).json({error: 'メンバーの取得に失敗しました。'});
  }
};

exports.addMember = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {name} = req.body;
    const normalized = normalizeName(name);

    if (!normalized) {
      return res.status(400).json({error: 'メンバー名は必須です。'});
    }

    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();
    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const membersRef = groupRef.collection('members');
    const existingMember = await membersRef.where('name', '==', normalized).get();
    if (!existingMember.empty) {
      return res.status(409).json({error: '同じ名前のメンバーが既に存在します。'});
    }

    const allMembersSnapshot = await membersRef.get();
    const existingColors = allMembersSnapshot.docs.map((d) => d.data().color);
    const newColor = getNextAvailableColor(existingColors);

    const newMemberData = {
      name: normalized,
      color: newColor,
      password: null,
      deleteToken: crypto.randomBytes(16).toString('hex'),
      iconUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(normalized)}&background=random&color=fff`,
      createdAt: new Date(),
      createdBy: 'admin',
      isActive: true,
    };

    const newMemberRef = await membersRef.add(newMemberData);
    res.status(201).json({id: newMemberRef.id, ...newMemberData});
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({error: 'メンバーの追加に失敗しました。'});
  }
};

exports.updateMember = async (req, res) => {
  try {
    const {groupId, memberId} = req.params;
    const {name, color} = req.body;
    const normalized = normalizeName(name);

    if (!normalized) {
      return res.status(400).json({error: 'メンバー名は必須です。'});
    }

    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();
    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const memberRef = groupRef.collection('members').doc(memberId);
    const memberDoc = await memberRef.get();
    if (!memberDoc.exists) {
      return res.status(404).json({error: 'メンバーが見つかりません。'});
    }

    const updateData = {
      name: normalized,
      color: color || memberDoc.data().color,
    };

    await memberRef.update(updateData);
    res.status(200).json({message: 'メンバー情報を更新しました。'});
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({error: 'メンバー情報の更新に失敗しました。'});
  }
};

exports.deleteMember = async (req, res) => {
  try {
    const {groupId, memberId} = req.params;
    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();
    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const memberRef = groupRef.collection('members').doc(memberId);
    await memberRef.delete();

    res.status(200).json({message: 'メンバーを削除しました。'});
  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({error: 'メンバーの削除に失敗しました。'});
  }
};

exports.getMemberSuggestions = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {q} = req.query;

    if (!q) {
      return res.json([]);
    }

    const normalizedQuery = normalizeName(q);
    const membersRef = firestore.collection('groups').doc(groupId).collection('members');
    const snapshot = await membersRef
      .where('name', '>=', normalizedQuery)
      .where('name', '<=', normalizedQuery + '\uf8ff')
      .limit(10)
      .get();

    const suggestions = snapshot.docs.map((doc) => ({id: doc.id, name: doc.data().name, hasPassword: !!doc.data().password}));
    res.status(200).json(suggestions);
  } catch (error) {
    console.error('Error fetching member suggestions:', error);
    res.status(500).json({error: 'メンバー候補の取得に失敗しました。'});
  }
};

exports.loginOrRegisterMember = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {name} = req.body;
    const normalized = normalizeName(name);

    if (!normalized) {
      return res.status(400).json({error: '名前は必須です。'});
    }

    const membersRef = firestore.collection('groups').doc(groupId).collection('members');
    const memberQuery = await membersRef.where('name', '==', normalized).limit(1).get();

    if (!memberQuery.empty) {
      const memberDoc = memberQuery.docs[0];
      const memberData = memberDoc.data();
      if (memberData.password) {
        return res.status(401).json({error: '合言葉が必要です。', requiresPassword: true, memberId: memberDoc.id, name: memberData.name});
      } else {
        return res.status(200).json({message: 'ログインしました。', token: memberData.deleteToken, memberId: memberDoc.id, name: memberData.name});
      }
    } else {
      const finalMemberId = crypto.randomBytes(16).toString('hex');
      const token = crypto.randomBytes(16).toString('hex');
      const allMembersSnapshot = await membersRef.get();
      const existingColors = allMembersSnapshot.docs.map((d) => d.data().color);
      const newColor = getNextAvailableColor(existingColors);
      const memberData = {
        id: finalMemberId,
        name: normalized,
        password: null,
        deleteToken: token,
        color: newColor,
        iconUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(normalized)}&background=random&color=fff`,
        createdAt: new Date(),
        createdBy: 'user',
        isActive: true,
      };
      await membersRef.doc(finalMemberId).set(memberData);

      return res.status(200).json({message: 'ログインしました。', token: token, memberId: finalMemberId, name: memberData.name});
    }
  } catch (error) {
    console.error('Error in loginOrRegisterMember:', error);
    res.status(500).json({error: 'ログイン処理中にエラーが発生しました。'});
  }
};

exports.updateMemberStatus = async (req, res) => {
  try {
    const {groupId, memberId} = req.params;
    const {isActive} = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({error: 'アクティブ状態が必要です。'});
    }

    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();
    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const memberRef = groupRef.collection('members').doc(memberId);
    await memberRef.update({isActive});

    res.status(200).json({message: 'メンバーの状態を更新しました。'});
  } catch (error) {
    console.error('Error updating member status:', error);
    res.status(500).json({error: 'メンバー状態の更新に失敗しました。'});
  }
};

exports.getUnjoinedMembers = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {eventId} = req.query;

    if (!eventId) {
      return res.status(400).json({error: 'イベントIDが必要です。'});
    }

    const eventDoc = await firestore.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }
    const joinedMemberIds = new Set(eventDoc.data().participants.map((p) => p.memberId));

    const membersSnapshot = await firestore.collection('groups').doc(groupId).collection('members').get();

    const unjoinedMembers = membersSnapshot.docs
      .map((doc) => ({id: doc.id, ...doc.data()}))
      .filter((member) => {
        const isActive = typeof member.isActive === 'boolean' ? member.isActive : true;
        return isActive && !joinedMemberIds.has(member.id);
      });

    res.status(200).json(unjoinedMembers);
  } catch (error) {
    console.error('Error getting unjoined members:', error);
    res.status(500).json({error: '未参加メンバーの取得に失敗しました。'});
  }
};
