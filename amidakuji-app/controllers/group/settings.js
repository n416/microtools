const {firestore} = require('../../utils/firestore');
const {FieldValue} = require('@google-cloud/firestore');
const bcrypt = require('bcrypt');
const saltRounds = 10;

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

      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({success: false, error: 'セッションの保存に失敗しました。'});
        }
        res.status(200).json({success: true, message: '認証に成功しました。'});
      });
    } else {
      res.status(401).json({success: false, error: '合言葉が違います。'});
    }
  } catch (error) {
    console.error('Error checking group password:', error);
    res.status(500).json({error: '合言葉の確認中にエラーが発生しました。'});
  }
};
