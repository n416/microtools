const {firestore, bucket} = require('../../utils/firestore');

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