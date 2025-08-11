const {firestore, bucket} = require('../utils/firestore');
const {getNextAvailableColor} = require('../utils/color');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const saltRounds = 10;

exports.getCurrentUser = async (req, res) => {
  if (!req.user) {
    return res.json(null);
  }

  const user = {...req.user};

  if (user.role === 'user') {
    const requestRef = firestore.collection('adminRequests').doc(user.id);
    const requestDoc = await requestRef.get();
    if (requestDoc.exists && requestDoc.data().status === 'pending') {
      user.adminRequestStatus = 'pending';
    }
  }

  res.json(user);
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const batch = firestore.batch();

    const groupsSnapshot = await firestore.collection('groups').where('ownerId', '==', userId).get();
    const groupIds = groupsSnapshot.docs.map((doc) => doc.id);

    if (groupIds.length > 0) {
      const allMemberPromises = groupIds.map(async (groupId) => {
        const membersSnapshot = await firestore.collection('groups').doc(groupId).collection('members').get();
        const deletePromises = membersSnapshot.docs.map((memberDoc) => {
          const memberId = memberDoc.id;
          const prefix = `profiles/${memberId}/`;
          return bucket.deleteFiles({prefix: prefix, force: true});
        });
        return Promise.all(deletePromises);
      });
      await Promise.all(allMemberPromises);

      const eventsSnapshot = await firestore.collection('events').where('groupId', 'in', groupIds).get();
      eventsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
    }

    groupsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    const userRef = firestore.collection('users').doc(userId);
    batch.delete(userRef);

    const requestRef = firestore.collection('adminRequests').doc(userId);
    batch.delete(requestRef);

    await batch.commit();

    req.logout((err) => {
      if (err) {
        return res.status(500).json({error: 'ログアウトに失敗しました。'});
      }
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({error: 'セッションの削除に失敗しました。'});
        }
        res.status(200).json({message: 'アカウントが正常に削除されました。'});
      });
    });
  } catch (error) {
    console.error('Error deleting user account:', error);
    res.status(500).json({error: 'アカウントの削除に失敗しました。'});
  }
};

exports.updateLastGroup = async (req, res) => {
  try {
    const {groupId} = req.body;
    if (!groupId) {
      return res.status(400).json({error: 'Group ID is required.'});
    }
    const userRef = firestore.collection('users').doc(req.user.id);
    await userRef.update({lastUsedGroupId: groupId});
    res.status(200).json({message: 'Last used group updated.'});
  } catch (error) {
    console.error('Error updating last used group:', error);
    res.status(500).json({error: 'Failed to update last used group.'});
  }
};

exports.getMemberDetails = async (req, res) => {
  try {
    const {memberId} = req.params;
    const {groupId} = req.query;

    if (!groupId) {
      return res.status(400).json({error: 'グループIDが必要です。'});
    }

    const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      return res.status(404).json({error: 'メンバーが見つかりません。'});
    }
    res.status(200).json(memberDoc.data());
  } catch (error) {
    console.error('Error fetching member details:', error);
    res.status(500).json({error: 'メンバー情報の取得に失敗しました。'});
  }
};

exports.deleteMemberAccount = async (req, res) => {
  try {
    const {memberId} = req.params;
    const token = req.headers['x-auth-token'];
    const {groupId} = req.body;

    if (!token || !groupId) {
      return res.status(400).json({error: '認証トークンとグループIDは必須です。'});
    }

    const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists || memberDoc.data().deleteToken !== token) {
      return res.status(403).json({error: '権限がないか、ユーザーが見つかりません。'});
    }

    const prefix = `profiles/${memberId}/`;
    await bucket.deleteFiles({prefix: prefix, force: true});

    await memberRef.delete();
    res.status(200).json({message: 'アカウントと関連ファイルを完全に削除しました。'});
  } catch (error) {
    console.error('Error deleting member account:', error);
    res.status(500).json({error: 'アカウントの削除に失敗しました。'});
  }
};

exports.requestPasswordDeletion = async (req, res) => {
  try {
    const {memberId} = req.params;
    const {groupId} = req.body;

    if (!groupId) {
      return res.status(400).json({error: 'グループIDが必要です。'});
    }

    const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      return res.status(404).json({error: 'ユーザーが見つかりません。'});
    }

    const memberName = memberDoc.data().name;

    const existingRequest = await firestore.collection('passwordResetRequests').where('groupId', '==', groupId).where('memberId', '==', memberId).get();

    if (!existingRequest.empty) {
      return res.status(409).json({error: '既に削除依頼が送信されています。'});
    }

    await firestore.collection('passwordResetRequests').add({
      groupId,
      memberId,
      memberName,
      requestedAt: new Date(),
    });

    res.status(200).json({message: '管理者に合言葉の削除を依頼しました。'});
  } catch (error) {
    console.error('Error requesting password deletion:', error);
    res.status(500).json({error: '依頼の送信に失敗しました。'});
  }
};

exports.generateUploadUrl = async (req, res) => {
  try {
    const {memberId} = req.params;
    const {fileType, groupId} = req.body;
    const token = req.headers['x-auth-token'];

    if (!token) return res.status(401).json({error: '認証トークンが必要です。'});
    if (!groupId) return res.status(400).json({error: 'グループIDが必要です。'});

    const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      return res.status(404).json({error: 'メンバーが見つかりません。'});
    }

    if (memberDoc.data().deleteToken !== token) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const fileExt = fileType.split('/')[1];
    if (!fileExt) {
      return res.status(400).json({error: '無効なファイルタイプです。'});
    }

    const fileName = `profiles/${memberId}/${Date.now()}.${fileExt}`;
    const file = bucket.file(fileName);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: fileType,
    });

    res.status(200).json({signedUrl: url, iconUrl: `https://storage.googleapis.com/${bucket.name}/${fileName}`});
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({error: 'URLの生成に失敗しました。'});
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const {memberId} = req.params;
    const {color, iconUrl, groupId} = req.body;
    const token = req.headers['x-auth-token'];

    if (!token) {
      return res.status(401).json({error: '認証トークンが必要です。'});
    }
    if (!groupId) {
      return res.status(400).json({error: 'グループIDが見つかりません。'});
    }

    const memberDocRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
    const memberDoc = await memberDocRef.get();

    if (!memberDoc.exists) {
      return res.status(404).json({error: 'メンバーが見つかりません。'});
    }

    const memberData = memberDoc.data();
    if (memberData.deleteToken !== token) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const oldIconUrl = memberData.iconUrl;

    const updateData = {};
    if (color) updateData.color = color;
    if (iconUrl) updateData.iconUrl = iconUrl;

    if (Object.keys(updateData).length > 0) {
      await memberDocRef.update(updateData);
    }

    if (iconUrl && oldIconUrl && oldIconUrl.includes('storage.googleapis.com')) {
      try {
        const urlParts = oldIconUrl.split(`${bucket.name}/`);
        if (urlParts.length < 2) {
          throw new Error('URLの形式が正しくありません。');
        }
        const oldFileName = urlParts[1].split('?')[0];
        await bucket.file(oldFileName).delete();
      } catch (deleteError) {
        console.error(`GCS file deletion failed, but proceeding: ${deleteError.message}`);
      }
    }

    res.status(200).json({message: 'プロフィールを更新しました。'});
  } catch (error) {
    console.error(`❌ プロフィール更新APIで致命的なエラー: ${error.message}`);
    res.status(500).json({error: 'プロフィールの更新に失敗しました。'});
  }
};

// ▼▼▼▼▼ ここからが今回の修正箇所です ▼▼▼▼▼
exports.setPassword = async (req, res) => {
  try {
    const {memberId} = req.params;
    const {password, groupId} = req.body;
    const token = req.headers['x-auth-token'];

    if (!token) return res.status(401).json({error: '認証トークンが必要です。'});
    if (!groupId) return res.status(400).json({error: 'グループIDが必要です。'});

    const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      return res.status(404).json({error: 'ユーザーが見つかりません。'});
    }

    if (memberDoc.data().deleteToken !== token) {
      return res.status(403).json({error: '権限がありません。'});
    }

    // パスワードがnullでない場合（設定・変更の場合）のみ検証
    if (password !== null) {
      if (!password || password.length < 4) {
        return res.status(400).json({error: '合言葉は4文字以上で設定してください。'});
      }
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      await memberRef.update({password: hashedPassword});
      res.status(200).json({message: '合言葉を設定しました。'});
    } else {
      // パスワードがnullの場合（削除の場合）
      await memberRef.update({password: null});
      res.status(200).json({message: '合言葉を削除しました。'});
    }
  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).json({error: '合言葉の処理に失敗しました。'});
  }
};
// ▲▲▲▲▲ 修正はここまで ▲▲▲▲▲