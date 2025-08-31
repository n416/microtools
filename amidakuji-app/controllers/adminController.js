const {firestore, bucket} = require('../utils/firestore');
const {Firestore} = require('@google-cloud/firestore');

exports.requestAdminAccess = async (req, res) => {
  try {
    const {id, name, email} = req.user;
    const requestRef = firestore.collection('adminRequests').doc(id);
    const doc = await requestRef.get();

    if (doc.exists) {
      return res.status(409).json({error: '既に申請済みです。'});
    }

    await requestRef.set({
      userId: id,
      name: name,
      email: email,
      status: 'pending',
      requestedAt: new Date(),
    });
    res.status(201).json({message: '管理者権限を申請しました。承認をお待ちください。'});
  } catch (error) {
    console.error('Error requesting admin rights:', error);
    res.status(500).json({error: '申請処理中にエラーが発生しました。'});
  }
};

exports.getAdminRequests = async (req, res) => {
  try {
    const snapshot = await firestore.collection('adminRequests').where('status', '==', 'pending').get();
    const requests = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching admin requests:', error);
    res.status(500).json({error: '申請一覧の取得に失敗しました。'});
  }
};

exports.approveAdminRequest = async (req, res) => {
  try {
    const {requestId} = req.body;
    if (!requestId) {
      return res.status(400).json({error: '申請IDが必要です。'});
    }
    const requestRef = firestore.collection('adminRequests').doc(requestId);
    const userRef = firestore.collection('users').doc(requestId);

    const batch = firestore.batch();
    batch.update(requestRef, {status: 'approved'});
    batch.update(userRef, {role: 'system_admin'});
    await batch.commit();

    res.status(200).json({message: '申請を承認しました。'});
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({error: '承認処理中にエラーが発生しました。'});
  }
};
exports.getGroupAdmins = async (req, res) => {
  try {
    const {lastVisible, searchEmail} = req.query;
    const PAGE_SIZE = 10;

    let query = firestore.collection('users');

    if (searchEmail) {
      query = query.where('email', '>=', searchEmail).where('email', '<=', searchEmail + '\uf8ff');
    }

    query = query.orderBy('email').limit(PAGE_SIZE + 1);

    if (lastVisible) {
      const lastDoc = await firestore.collection('users').doc(lastVisible).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    const hasNextPage = snapshot.docs.length > PAGE_SIZE;
    const admins = snapshot.docs.slice(0, PAGE_SIZE).map((doc) => ({id: doc.id, ...doc.data()}));

    const newLastVisible = hasNextPage ? snapshot.docs[PAGE_SIZE - 1].id : null;

    res.status(200).json({admins, lastVisible: newLastVisible, hasNextPage});
  } catch (error) {
    console.error('Error fetching users (formerly group admins):', error);
    res.status(500).json({error: 'ユーザーの取得に失敗しました。'});
  }
};

exports.getSystemAdmins = async (req, res) => {
  try {
    const {lastVisible, searchEmail} = req.query;
    const PAGE_SIZE = 10;

    let query = firestore.collection('users').where('role', '==', 'system_admin');

    if (searchEmail) {
      query = query.where('email', '>=', searchEmail).where('email', '<=', searchEmail + '\uf8ff');
    }

    query = query.orderBy('email').limit(PAGE_SIZE + 1);

    if (lastVisible) {
      const lastDoc = await firestore.collection('users').doc(lastVisible).get();
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    const hasNextPage = snapshot.docs.length > PAGE_SIZE;
    const admins = snapshot.docs.slice(0, PAGE_SIZE).map((doc) => ({id: doc.id, ...doc.data()}));

    const newLastVisible = hasNextPage ? snapshot.docs[PAGE_SIZE - 1].id : null;

    res.status(200).json({admins, lastVisible: newLastVisible, hasNextPage});
  } catch (error) {
    console.error('Error fetching system admins:', error);
    res.status(500).json({error: 'システム管理者の取得に失敗しました。'});
  }
};

exports.demoteAdmin = async (req, res) => {
  try {
    const {userId} = req.body;
    const currentAdminId = req.user.isImpersonating ? req.user.originalUser.id : req.user.id;

    if (userId === currentAdminId) {
      return res.status(400).json({error: '自分自身を降格させることはできません。'});
    }

    const userRef = firestore.collection('users').doc(userId);
    const requestRef = firestore.collection('adminRequests').doc(userId);

    const batch = firestore.batch();
    batch.update(userRef, {role: 'user'});
    batch.delete(requestRef);
    await batch.commit();

    res.status(200).json({message: 'ユーザーを降格させました。'});
  } catch (error) {
    console.error('Error demoting user:', error);
    res.status(500).json({error: 'ユーザーの降格に失敗しました。'});
  }
};

exports.impersonateUser = (req, res) => {
  const {targetUserId} = req.body;
  req.session.passport.user = {
    originalAdminId: req.user.isImpersonating ? req.user.originalUser.id : req.user.id,
    targetUserId: targetUserId,
  };
  req.session.save((err) => {
    if (err) {
      return res.status(500).json({error: '成り代わりのセッション設定に失敗しました。'});
    }
    res.status(200).json({message: '成り代わりを開始します。'});
  });
};

exports.stopImpersonating = (req, res) => {
  if (req.user.isImpersonating) {
    req.session.passport.user = {targetUserId: req.user.originalUser.id};
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({error: '成り代わり解除に失敗しました。'});
      }
      res.status(200).json({message: '成り代わりを解除しました。'});
    });
  } else {
    res.status(400).json({error: '現在成り代わり中ではありません。'});
  }
};

exports.getPasswordRequests = async (req, res) => {
  try {
    const {groupId} = req.params;
    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const requestsSnapshot = await firestore.collection('passwordResetRequests').where('groupId', '==', groupId).orderBy('requestedAt', 'desc').get();

    const requests = requestsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching password requests:', error);
    res.status(500).json({error: '依頼一覧の取得に失敗しました。'});
  }
};

exports.approvePasswordReset = async (req, res) => {
  try {
    const {memberId} = req.params;
    const {groupId, requestId} = req.body;

    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return res.status(404).json({error: 'グループが見つかりません。'});
    }

    // --- ▼▼▼ ここから修正 ▼▼▼ ---
    const isOwner = groupDoc.data().ownerId === req.user.id;
    const isSysAdmin = req.user.role === 'system_admin';

    if (!isOwner && !isSysAdmin) {
      return res.status(403).json({error: '権限がありません。'});
    }
    // --- ▲▲▲ ここまで修正 ▲▲▲ ---

    const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
    const requestRef = firestore.collection('passwordResetRequests').doc(requestId);

    const memberDoc = await memberRef.get();
    const requestDoc = await requestRef.get();
    if (!memberDoc.exists || !requestDoc.exists) {
      return res.status(404).json({error: '対象のメンバーまたはリセット依頼が見つかりません。'});
    }

    const batch = firestore.batch();
    batch.update(memberRef, {password: null});
    batch.delete(requestRef);
    await batch.commit();

    res.status(200).json({message: '合言葉を削除しました。ユーザーは新しい合言葉を再設定できます。'});
  } catch (error) {
    console.error('Error deleting password by admin:', error);
    res.status(500).json({error: '合言葉の削除に失敗しました。'});
  }
};
