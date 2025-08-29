const {firestore} = require('../../utils/firestore');
const crypto = require('crypto');
const {normalizeName} = require('../../utils/text');

exports.createGroup = async (req, res) => {
  try {
    const {groupName, participants} = req.body;
    if (!groupName || groupName.trim() === '') {
      return res.status(400).json({error: 'グループ名が必要です。'});
    }
    const newParticipants = (participants || []).map((p) => ({
      id: p.id || crypto.randomBytes(16).toString('hex'),
      name: normalizeName(p.name),
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

    const batch = firestore.batch();
    const eventsSnapshot = await firestore.collection('events').where('groupId', '==', groupId).get();
    eventsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    const membersSnapshot = await groupRef.collection('members').get();
    membersSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    const prizeMastersSnapshot = await groupRef.collection('prizeMasters').get();
    prizeMastersSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(groupRef);
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

exports.getGroupByCustomUrl = async (req, res) => {
  try {
    const {customUrl} = req.params;
    const snapshot = await firestore.collection('groups').where('customUrl', '==', customUrl).limit(1).get();

    if (snapshot.empty) {
      return res.status(404).json({error: 'グループが見つかりません。'});
    }
    const groupDoc = snapshot.docs[0];
    res.status(200).json({id: groupDoc.id, ...groupDoc.data()});
  } catch (error) {
    console.error('Error fetching group by custom URL:', error);
    res.status(500).json({error: 'グループの読み込みに失敗しました。'});
  }
};
