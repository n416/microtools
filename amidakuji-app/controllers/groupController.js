const {firestore, bucket} = require('../utils/firestore');
const {FieldValue} = require('@google-cloud/firestore');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const {getNextAvailableColor} = require('../utils/color');
const {normalizeName} = require('../utils/text');
const saltRounds = 10;
const kuromoji = require('kuromoji');
const Levenshtein = require('levenshtein');

// Kuromojiの初期化をPromiseでラップし、完了を保証する
const tokenizerPromise = new Promise((resolve, reject) => {
  console.log('Kuromojiの辞書を読み込んでいます...');
  kuromoji.builder({dicPath: 'node_modules/kuromoji/dict'}).build((err, tokenizer) => {
    if (err) {
      console.error('❌ Kuromojiの初期化に失敗しました:', err);
      return reject(err);
    }
    console.log('✅ Kuromojiの辞書準備が完了しました。');
    resolve(tokenizer);
  });
});

/**
 * 文字列のカタカナ読みを取得するヘルパー関数
 */
const getReading = async (text) => {
  try {
    const tokenizer = await tokenizerPromise;
    if (!tokenizer) throw new Error('Tokenizer is not available.');

    const tokens = tokenizer.tokenize(text);
    const reading = tokens.map((token) => token.reading || token.surface_form).join('');
    return reading;
  } catch (error) {
    console.error(`読み仮名への変換中にエラーが発生しました (${text}):`, error);
    return text;
  }
};

/**
 * API ①: メンバー一括登録の分析・プレビューAPI
 */
exports.analyzeBulkMembers = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {namesText} = req.body;

    if (!namesText || typeof namesText !== 'string') {
      return res.status(400).json({error: '登録する名前のテキストが必要です。'});
    }

    // スペースでは区切らず、改行とカンマのみで区切るように修正
    const inputNames = [...new Set(namesText.split(/\n|,/).map(normalizeName).filter(Boolean))];

    const membersRef = firestore.collection('groups').doc(groupId).collection('members');
    const membersSnapshot = await membersRef.get();
    const existingMembers = await Promise.all(
      membersSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          reading: await getReading(data.name),
        };
      })
    );
    const existingNames = new Set(existingMembers.map((m) => m.name));

    const analysisResults = await Promise.all(
      inputNames.map(async (inputName) => {
        if (existingNames.has(inputName)) {
          return {inputName, status: 'exact_match', matchedMember: existingMembers.find((m) => m.name === inputName)};
        }

        const inputReading = await getReading(inputName);
        const suggestions = [];

        for (const member of existingMembers) {
          const nameDistance = new Levenshtein(inputName, member.name).distance;
          const readingDistance = new Levenshtein(inputReading, member.reading).distance;

          // 文字列長を考慮した類似度を計算 (1.0に近いほど類似)
          const nameSimilarity = 1 - nameDistance / Math.max(inputName.length, member.name.length);
          const readingSimilarity = 1 - readingDistance / Math.max(inputReading.length, member.reading.length);

          // しきい値の設計: 名前の類似度が60%以上、または読みの類似度が80%以上の場合に候補とする
          if (nameSimilarity >= 0.6 || readingSimilarity >= 0.8) {
            suggestions.push({
              id: member.id,
              name: member.name,
              similarity: Math.max(nameSimilarity, readingSimilarity),
            });
          }
        }

        if (suggestions.length > 0) {
          suggestions.sort((a, b) => b.similarity - a.similarity);
          return {inputName, status: 'potential_match', suggestions};
        }

        return {inputName, status: 'new_registration'};
      })
    );

    res.status(200).json({analysisResults});
  } catch (error) {
    console.error('メンバーの一括分析中にエラー:', error);
    res.status(500).json({error: '分析処理に失敗しました。'});
  }
};

/**
 * API ②: メンバー一括登録の確定処理API
 */
exports.finalizeBulkMembers = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {resolutions} = req.body;

    if (!Array.isArray(resolutions)) {
      return res.status(400).json({error: '不正なリクエストです。'});
    }

    const groupRef = firestore.collection('groups').doc(groupId);
    const membersRef = groupRef.collection('members');

    const batch = firestore.batch();
    let createdCount = 0;

    const allMembersSnapshot = await membersRef.get();
    const existingColors = allMembersSnapshot.docs.map((d) => d.data().color);

    for (const resolution of resolutions) {
      if (resolution.action === 'create') {
        const normalized = normalizeName(resolution.inputName);
        if (!normalized) continue;

        const newColor = getNextAvailableColor(existingColors);
        existingColors.push(newColor);

        const newMemberData = {
          name: normalized,
          color: newColor,
          password: null,
          deleteToken: crypto.randomBytes(16).toString('hex'),
          iconUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(normalized)}&background=random&color=fff`,
          createdAt: new Date(),
          createdBy: 'admin-bulk',
          isActive: true, // ★ この行を追加
        };

        const newMemberRef = membersRef.doc();
        batch.set(newMemberRef, newMemberData);
        createdCount++;
      }
    }

    await batch.commit();

    res.status(200).json({
      message: '一括登録が完了しました。',
      createdCount,
      skippedCount: resolutions.length - createdCount,
    });
  } catch (error) {
    console.error('メンバーの一括登録確定処理中にエラー:', error);
    res.status(500).json({error: '登録処理に失敗しました。'});
  }
};

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
        createdBy: 'user', // 出自を'user'として記録
        isActive: true, // ★ この行を追加
      };
      await membersRef.doc(finalMemberId).set(memberData);

      return res.status(200).json({message: 'ログインしました。', token: token, memberId: finalMemberId, name: memberData.name});
    }
  } catch (error) {
    console.error('Error in loginOrRegisterMember:', error);
    res.status(500).json({error: 'ログイン処理中にエラーが発生しました。'});
  }
};

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
      createdBy: 'admin', // 出自を'admin'として記録
      isActive: true, // ★ この行を追加
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

    // イベントの参加者IDリストを取得
    const eventDoc = await firestore.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }
    const joinedMemberIds = new Set(eventDoc.data().participants.map((p) => p.memberId));

    // ▼▼▼ ここからが修正点 ▼▼▼
    // グループの全メンバーを取得（isActiveでの絞り込みを一旦解除）
    const membersSnapshot = await firestore.collection('groups').doc(groupId).collection('members').get();

    // イベントに未参加で、かつアクティブな（isActive:true または isActive:undefined）メンバーのみを抽出
    const unjoinedMembers = membersSnapshot.docs
      .map((doc) => ({id: doc.id, ...doc.data()}))
      .filter((member) => {
        const isActive = typeof member.isActive === 'boolean' ? member.isActive : true;
        return isActive && !joinedMemberIds.has(member.id);
      });
    // ▲▲▲ 修正点ここまで ▲▲▲

    res.status(200).json(unjoinedMembers);
  } catch (error) {
    console.error('Error getting unjoined members:', error);
    res.status(500).json({error: '未参加メンバーの取得に失敗しました。'});
  }
};
