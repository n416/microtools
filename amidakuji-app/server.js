require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const saltRounds = 10; // bcryptのコストファクター
const fetch = require('node-fetch');

process.on('unhandledRejection', (reason, promise) => {
  console.error('致命的なエラー (unhandledRejection):', promise, '理由:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('致命的なエラー (uncaughtException):', err);
});

const express = require('express');
const path = require('path');
const {Firestore} = require('@google-cloud/firestore');
const {Storage} = require('@google-cloud/storage');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const ejs = require('ejs');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const firestore = new Firestore({
  keyFilename: './serviceAccountKey.json',
  databaseId: 'amida',
});
const storage = new Storage({
  keyFilename: './serviceAccountKey.json',
});
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {secure: process.env.NODE_ENV === 'production'},
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const userRef = firestore.collection('users').doc(profile.id);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          const newUser = {
            email: profile.emails[0].value,
            name: profile.displayName,
            role: 'user',
          };
          await userRef.set(newUser);

          const groupsRef = firestore.collection('groups');
          const defaultGroup = {
            name: '新規グループ',
            ownerId: profile.id,
            createdAt: new Date(),
            participants: [],
          };
          await groupsRef.add(defaultGroup);

          return done(null, {id: profile.id, ...newUser});
        } else {
          return done(null, {id: userDoc.id, ...userDoc.data()});
        }
      } catch (error) {
        console.error('Error during Google authentication strategy:', error);
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  if (user.isImpersonating) {
    done(null, {originalAdminId: user.originalUser.id, targetUserId: user.id});
  } else {
    done(null, {targetUserId: user.id});
  }
});

passport.deserializeUser(async (sessionData, done) => {
  try {
    const targetUserId = typeof sessionData === 'object' && sessionData.targetUserId ? sessionData.targetUserId : sessionData;
    const originalAdminId = typeof sessionData === 'object' && sessionData.originalAdminId ? sessionData.originalAdminId : null;

    if (!targetUserId) {
      return done(null, false);
    }

    if (originalAdminId) {
      const originalAdminRef = firestore.collection('users').doc(originalAdminId);
      const originalAdminDoc = await originalAdminRef.get();
      if (!originalAdminDoc.exists) return done(null, false);

      const targetUserRef = firestore.collection('users').doc(targetUserId);
      const targetUserDoc = await targetUserRef.get();
      if (!targetUserDoc.exists) return done(null, false);

      const user = {
        id: targetUserDoc.id,
        ...targetUserDoc.data(),
        originalUser: {id: originalAdminDoc.id, ...originalAdminDoc.data()},
        isImpersonating: true,
      };
      return done(null, user);
    } else {
      const userRef = firestore.collection('users').doc(targetUserId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        return done(null, false);
      }
      return done(null, {id: userDoc.id, ...userDoc.data()});
    }
  } catch (err) {
    return done(err);
  }
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({error: 'ログインが必要です。'});
}

async function isSystemAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({error: 'ログインが必要です。'});
  }
  const userId = req.user.isImpersonating ? req.user.originalUser.id : req.user.id;
  const userRef = firestore.collection('users').doc(userId);
  const doc = await userRef.get();
  if (doc.exists && doc.data().role === 'system_admin') {
    return next();
  }
  return res.status(403).json({error: 'アクセス権がありません。'});
}

app.get('/auth/google', passport.authenticate('google', {scope: ['profile', 'email']}));

app.get('/auth/google/callback', passport.authenticate('google', {failureRedirect: '/?login_error=1'}), (req, res) => {
  res.redirect('/');
});

app.get('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

app.get('/api/user/me', async (req, res) => {
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
});

app.delete('/api/user/me', ensureAuthenticated, async (req, res) => {
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
});

function generateLines(numParticipants) {
  const lines = [];
  const horizontalLines = Math.floor(numParticipants * 2.5);
  const canvasHeight = 400;

  for (let i = 0; i < horizontalLines; i++) {
    const startNode = Math.floor(Math.random() * (numParticipants - 1));
    const endNode = startNode + 1;
    const y = Math.floor(Math.random() * (canvasHeight - 80)) + 40;

    const isTooClose = lines.some((line) => line.fromIndex === startNode && Math.abs(line.y - y) < 20);

    if (!isTooClose) {
      lines.push({fromIndex: startNode, toIndex: endNode, y: y});
    }
  }
  return lines;
}

function calculateResults(participants, lines, prizes) {
  const results = {};
  for (let i = 0; i < participants.length; i++) {
    let currentPath = i;
    const sortedLines = [...lines].sort((a, b) => a.y - b.y);

    sortedLines.forEach((line) => {
      if (line.fromIndex === currentPath) {
        currentPath = line.toIndex;
      } else if (line.toIndex === currentPath) {
        currentPath = line.fromIndex;
      }
    });
    const participant = participants.find((p) => p.slot === i);
    if (participant && participant.name) {
      results[participant.name] = {prize: prizes[currentPath], color: participant.color};
    }
  }
  return results;
}

app.put('/api/groups/:groupId/participants/:participantId/color', ensureAuthenticated, async (req, res) => {
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
});

app.put('/api/groups/:groupId/participants', ensureAuthenticated, async (req, res) => {
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
});

app.post('/api/groups', ensureAuthenticated, async (req, res) => {
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
});

app.get('/api/groups', ensureAuthenticated, async (req, res) => {
  try {
    const groupsSnapshot = await firestore.collection('groups').where('ownerId', '==', req.user.id).orderBy('createdAt', 'desc').get();
    const groups = groupsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({error: 'グループの読み込みに失敗しました。'});
  }
});

app.put('/api/groups/:groupId/settings', ensureAuthenticated, async (req, res) => {
  try {
    const {groupId} = req.params;
    const {customUrl, password, noIndex} = req.body;
    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: 'このグループの設定を編集する権限がありません。'});
    }

    const updateData = {
      noIndex: !!noIndex,
    };

    if (customUrl) {
      const querySnapshot = await firestore.collection('groups').where('customUrl', '==', customUrl).get();
      const isTaken = !querySnapshot.empty && querySnapshot.docs.some((doc) => doc.id !== groupId);
      if (isTaken) {
        return res.status(409).json({error: 'このカスタムURLは既に使用されています。'});
      }
      updateData.customUrl = customUrl;
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, saltRounds);
    }

    await groupRef.update(updateData);
    res.status(200).json({message: 'グループ設定が正常に更新されました。'});
  } catch (error) {
    console.error('Error updating group settings:', error);
    res.status(500).json({error: 'グループ設定の更新中にエラーが発生しました。'});
  }
});

app.post('/api/groups/:groupId/check-password', async (req, res) => {
  try {
    const {groupId} = req.params;
    const {password} = req.body;

    if (!password) {
      return res.status(400).json({error: 'パスワードが必要です。'});
    }

    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return res.status(404).json({error: 'グループが見つかりません。'});
    }

    const groupData = groupDoc.data();
    if (!groupData.password) {
      return res.status(200).json({success: true});
    }

    const match = await bcrypt.compare(password, groupData.password);
    res.status(200).json({success: match});
  } catch (error) {
    console.error('Error checking group password:', error);
    res.status(500).json({error: 'パスワードの確認中にエラーが発生しました。'});
  }
});

// ===== メンバー登録・認証・管理API (新規・修正) =====

// メンバー名候補の取得
app.get('/api/groups/:groupId/member-suggestions', async (req, res) => {
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
});

// ユーザーログイン
app.post('/api/groups/:groupId/login', async (req, res) => {
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
});

// ユーザー自身によるアカウント削除
app.delete('/api/members/:memberId', async (req, res) => {
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
});

// 合言葉の削除依頼
app.post('/api/members/:memberId/request-password-deletion', async (req, res) => {
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
});

// ===== 管理者向けAPI (合言葉リセット) =====

app.get('/api/admin/groups/:groupId/password-requests', ensureAuthenticated, async (req, res) => {
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
});

app.post('/api/admin/members/:memberId/delete-password', ensureAuthenticated, async (req, res) => {
  try {
    const {memberId} = req.params;
    const {groupId, requestId} = req.body;

    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
    const requestRef = firestore.collection('passwordResetRequests').doc(requestId);

    const batch = firestore.batch();
    batch.update(memberRef, {password: null});
    batch.delete(requestRef);
    await batch.commit();

    res.status(200).json({message: '合言葉を削除しました。ユーザーは新しい合言葉を再設定できます。'});
  } catch (error) {
    console.error('Error deleting password by admin:', error);
    res.status(500).json({error: '合言葉の削除に失敗しました。'});
  }
});

// ===== ここから既存のAPIエンドポイント =====

app.get('/api/groups/:groupId/events', ensureAuthenticated, async (req, res) => {
  try {
    const {groupId} = req.params;
    const groupDoc = await firestore.collection('groups').doc(groupId).get();
    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(404).json({error: '指定されたグループが見つからないか、アクセス権がありません。'});
    }
    const eventsSnapshot = await firestore.collection('events').where('groupId', '==', groupId).orderBy('createdAt', 'desc').get();
    const events = eventsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching events for group:', error);
    res.status(500).json({error: 'イベントの読み込みに失敗しました。'});
  }
});

app.post('/api/events', ensureAuthenticated, async (req, res) => {
  try {
    const {prizes, groupId, participantCount, displayMode, eventPassword} = req.body;
    if (!groupId) return res.status(400).json({error: 'グループIDは必須です。'});
    if (!participantCount || participantCount < 2) return res.status(400).json({error: '参加人数は2人以上で設定してください。'});
    if (!prizes || !Array.isArray(prizes) || prizes.length !== participantCount) return res.status(400).json({error: '参加人数と景品の数が一致していません。'});

    let hashedPassword = null;
    if (eventPassword && eventPassword.trim() !== '') {
      hashedPassword = await bcrypt.hash(eventPassword, saltRounds);
    }

    const groupDoc = await firestore.collection('groups').doc(groupId).get();
    const groupParticipants = groupDoc.data().participants || [];

    const participants = Array.from({length: participantCount}, (_, i) => {
      const groupParticipant = groupParticipants[i];
      return {
        slot: i,
        name: null,
        deleteToken: null,
        color: groupParticipant ? groupParticipant.color : `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        id: groupParticipant ? groupParticipant.id : crypto.randomBytes(16).toString('hex'),
      };
    });

    const lines = generateLines(participantCount);

    const formattedPrizes = prizes.map((p) => {
      if (typeof p === 'string') {
        return {name: p, imageUrl: null};
      }
      return p;
    });

    const eventData = {
      prizes: formattedPrizes,
      lines,
      groupId,
      participantCount,
      participants,
      displayMode,
      eventPassword: hashedPassword,
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
});

app.post('/api/events/:eventId/copy', ensureAuthenticated, async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventRef = firestore.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({error: 'コピー元のイベントが見つかりません。'});
    }

    const originalEvent = eventDoc.data();
    if (originalEvent.ownerId !== req.user.id) {
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
    };
    delete newEventData.results;

    const newDocRef = await firestore.collection('events').add(newEventData);
    res.status(201).json({newId: newDocRef.id});
  } catch (error) {
    console.error('Error copying event:', error);
    res.status(500).json({error: 'イベントのコピーに失敗しました。'});
  }
});

app.get('/api/events/:id', ensureAuthenticated, async (req, res) => {
  try {
    const eventId = req.params.id;
    const doc = await firestore.collection('events').doc(eventId).get();
    if (!doc.exists || doc.data().ownerId !== req.user.id) {
      return res.status(404).json({error: 'イベントが見つからないか、アクセス権がありません。'});
    }
    res.status(200).json({id: doc.id, ...doc.data()});
  } catch (error) {
    console.error(`Error fetching event ${req.params.id}:`, error);
    res.status(500).json({error: 'イベントの読み込みに失敗しました。'});
  }
});

app.post('/api/events/:eventId/start', ensureAuthenticated, async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();
    if (!doc.exists || doc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: 'このイベントを開始する権限がありません。'});
    }

    const eventData = doc.data();
    if (eventData.status === 'started') {
      return res.status(400).json({error: 'イベントは既に開始されています。'});
    }

    const results = calculateResults(eventData.participants, eventData.lines, eventData.prizes);

    await eventRef.update({status: 'started', results: results});
    res.status(200).json({message: 'イベントが開始されました。', results});
  } catch (error) {
    console.error('Error starting event:', error);
    res.status(500).json({error: 'イベントの開始に失敗しました。'});
  }
});

app.get('/api/events/:eventId/public', async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();
    if (!doc.exists) return res.status(404).json({error: 'イベントが見つかりません。'});
    const data = doc.data();

    const groupDoc = await firestore.collection('groups').doc(data.groupId).get();
    const eventName = groupDoc.exists ? groupDoc.data().name : `イベント`;

    const publicPrizes = data.displayMode === 'private' ? data.prizes.map(() => '？？？') : data.prizes;
    const publicData = {
      eventName: eventName,
      participants: data.participants,
      prizes: publicPrizes,
      lines: data.lines,
      hasPassword: !!data.eventPassword,
      displayMode: data.displayMode,
      status: data.status,
      results: data.status === 'started' ? data.results : null,
      groupId: data.groupId,
    };
    res.status(200).json(publicData);
  } catch (error) {
    console.error('Error fetching public event data:', error);
    res.status(500).json({error: 'イベント情報の取得に失敗しました。'});
  }
});

// ===== 賞品マスターAPI (新規追加) =====

app.get('/api/groups/:groupId/prize-masters', ensureAuthenticated, async (req, res) => {
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
});

app.post('/api/groups/:groupId/prize-masters/generate-upload-url', ensureAuthenticated, async (req, res) => {
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
});

app.post('/api/groups/:groupId/prize-masters', ensureAuthenticated, async (req, res) => {
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
});

app.delete('/api/prize-masters/:masterId', ensureAuthenticated, async (req, res) => {
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
});

app.post('/api/members/:memberId/generate-upload-url', async (req, res) => {
  try {
    const {memberId} = req.params;
    const {fileType, groupId} = req.body; // groupIdを追加
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
});

app.put('/api/members/:memberId/profile', async (req, res) => {
  console.log('--- プロフィール更新APIが呼び出されました ---');
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
      console.log(`メンバーが見つかりません: ${memberId}`);
      return res.status(404).json({error: 'メンバーが見つかりません。'});
    }

    const memberData = memberDoc.data();
    if (memberData.deleteToken !== token) {
      console.log('認証トークンが一致しません。');
      return res.status(403).json({error: '権限がありません。'});
    }

    const oldIconUrl = memberData.iconUrl;
    console.log(`古いアイコンURL: ${oldIconUrl}`);
    console.log(`新しいアイコンURL: ${iconUrl}`);

    const updateData = {};
    if (color) updateData.color = color;
    if (iconUrl) updateData.iconUrl = iconUrl;

    if (Object.keys(updateData).length > 0) {
      await memberDocRef.update(updateData);
      console.log('Firestoreのドキュメントを更新しました。');
    }

    if (iconUrl && oldIconUrl && oldIconUrl.includes('storage.googleapis.com')) {
      console.log('古いファイルの削除処理を開始します。');
      try {
        const urlParts = oldIconUrl.split(`${bucket.name}/`);
        if (urlParts.length < 2) {
          throw new Error('URLの形式が正しくありません。');
        }
        const oldFileName = urlParts[1].split('?')[0];
        console.log(`削除対象のファイル名: ${oldFileName}`);

        await bucket.file(oldFileName).delete();
        console.log(`✅ ファイルの削除に成功しました: ${oldFileName}`);
      } catch (deleteError) {
        console.error(`❌ ファイルの削除に失敗しました: ${deleteError.message}`);
      }
    } else {
      console.log('古いファイルの削除処理はスキップされました。');
    }

    res.status(200).json({message: 'プロフィールを更新しました。'});
  } catch (error) {
    console.error(`❌ プロフィール更新APIで致命的なエラー: ${error.message}`);
    res.status(500).json({error: 'プロフィールの更新に失敗しました。'});
  }
});
app.post('/api/members/:memberId/set-password', async (req, res) => {
  try {
    const {memberId} = req.params;
    const {password, groupId} = req.body;
    const token = req.headers['x-auth-token'];

    if (!token) return res.status(401).json({error: '認証トークンが必要です。'});
    if (!password || password.length < 4) return res.status(400).json({error: '合言葉は4文字以上で設定してください。'});
    if (!groupId) return res.status(400).json({error: 'グループIDが必要です。'});

    const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      return res.status(404).json({error: 'ユーザーが見つかりません。'});
    }

    if (memberDoc.data().deleteToken !== token) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await memberRef.update({password: hashedPassword});

    res.status(200).json({message: '合言葉を設定しました。'});
  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).json({error: '合言葉の設定に失敗しました。'});
  }
});

// ★★★★★ ここからが修正箇所 ★★★★★
/**
 * ログイン済みのユーザーがスロットに参加するためのAPI
 */
/**
 * ログイン済みのユーザーがスロットに参加するためのAPI
 */
app.post('/api/events/:eventId/join-slot', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { memberId, slot } = req.body;
        const token = req.headers['x-auth-token'];

        if (!token) {
            return res.status(401).json({ error: '認証トークンが必要です。' });
        }
        if (slot === undefined || slot === null) {
            return res.status(400).json({ error: '参加枠が指定されていません。' });
        }

        const eventRef = firestore.collection('events').doc(eventId);
        const eventDoc = await eventRef.get();
        if (!eventDoc.exists) {
            return res.status(404).json({ error: 'イベントが見つかりません。' });
        }

        const eventData = eventDoc.data();
        const groupId = eventData.groupId;
        
        // ★★★★★ 修正：この行を追加 ★★★★★
        const memberRef = firestore.collection('groups').doc(groupId).collection('members').doc(memberId);
        const memberDoc = await memberRef.get();

        if (!memberDoc.exists || memberDoc.data().deleteToken !== token) {
            return res.status(403).json({ error: '認証情報が無効です。' });
        }
        const memberData = memberDoc.data();

        const newParticipants = [...eventData.participants];
        if (slot < 0 || slot >= newParticipants.length || newParticipants[slot].name !== null) {
            return res.status(409).json({ error: 'この参加枠は既に埋まっているか、無効です。' });
        }
        newParticipants[slot].name = memberData.name;
        newParticipants[slot].memberId = memberDoc.id;
        newParticipants[slot].iconUrl = memberData.iconUrl;
        newParticipants[slot].color = memberData.color;

        await eventRef.update({ participants: newParticipants });

        res.status(200).json({ message: 'イベントに参加しました。' });

    } catch (error) {
        console.error('Error joining slot:', error);
        res.status(500).json({ error: '参加処理中にエラーが発生しました。' });
    }
});

app.post('/api/events/:eventId/join', async (req, res) => {
  try {
    const {eventId} = req.params;
    const {name, slot, memberId} = req.body;

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

    if (memberDoc && memberDoc.exists) {
      const memberData = memberDoc.data();
      if (memberData.password) {
        return res.status(401).json({
          error: '合言葉が必要です。',
          requiresPassword: true,
          memberId: memberDoc.id,
          name: memberData.name,
        });
      }
      if (slot !== undefined && slot !== null) {
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
      return res.status(200).json({
        message: 'ログインしました。',
        token: memberData.deleteToken,
        memberId: memberDoc.id,
        name: memberData.name,
      });
    }

    const newMemberId = crypto.randomBytes(16).toString('hex');
    const deleteToken = crypto.randomBytes(16).toString('hex');
    const newColor = getNextAvailableColor((await membersRef.get()).docs.map((d) => d.data().color));
    const newMemberData = {
      id: newMemberId,
      name: name.trim(),
      password: null,
      deleteToken,
      color: newColor,
      iconUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=random&color=fff`,
      createdAt: new Date(),
    };

    await membersRef.doc(newMemberId).set(newMemberData);

    if (slot !== undefined && slot !== null) {
      const newParticipants = [...eventData.participants];
      if (slot < 0 || slot >= newParticipants.length || newParticipants[slot].name !== null) {
        return res.status(409).json({error: 'この参加枠は既に埋まっているか、無効です。'});
      }
      newParticipants[slot].name = newMemberData.name;
      newParticipants[slot].memberId = newMemberId;
      newParticipants[slot].iconUrl = newMemberData.iconUrl;
      newParticipants[slot].color = newMemberData.color;
      await eventRef.update({participants: newParticipants});
    }

    res.status(201).json({
      message: '登録して参加しました。',
      token: deleteToken,
      memberId: newMemberId,
      name: newMemberData.name,
    });
  } catch (error) {
    console.error('Error joining event:', error);
    res.status(500).json({error: '参加処理中にエラーが発生しました。'});
  }
});

app.post('/api/events/:eventId/verify-password', async (req, res) => {
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

    if (slot !== undefined && slot !== null) {
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
});

app.delete('/api/events/:eventId/participants', async (req, res) => {
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
});

// --- System Admin Routes ---
app.post('/api/admin/request', ensureAuthenticated, async (req, res) => {
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
});

app.get('/api/admin/requests', isSystemAdmin, async (req, res) => {
  try {
    const snapshot = await firestore.collection('adminRequests').where('status', '==', 'pending').get();
    const requests = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching admin requests:', error);
    res.status(500).json({error: '申請一覧の取得に失敗しました。'});
  }
});

app.post('/api/admin/approve', isSystemAdmin, async (req, res) => {
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
});

app.get('/api/admin/group-admins', isSystemAdmin, async (req, res) => {
  try {
    const groupsSnapshot = await firestore.collection('groups').get();
    const ownerIds = [...new Set(groupsSnapshot.docs.map((doc) => doc.data().ownerId))];

    if (ownerIds.length === 0) {
      return res.status(200).json([]);
    }

    const usersRef = firestore.collection('users');
    const usersSnapshot = await usersRef.where(Firestore.FieldPath.documentId(), 'in', ownerIds).get();
    const users = usersSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));

    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching group admins:', error);
    res.status(500).json({error: 'ユーザーの取得に失敗しました。'});
  }
});

app.get('/api/admin/system-admins', isSystemAdmin, async (req, res) => {
  try {
    const usersRef = firestore.collection('users');
    const snapshot = await usersRef.where('role', '==', 'system_admin').get();
    const admins = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(admins);
  } catch (error) {
    console.error('Error fetching system admins:', error);
    res.status(500).json({error: 'システム管理者の取得に失敗しました。'});
  }
});

app.post('/api/admin/demote', isSystemAdmin, async (req, res) => {
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
});

app.post('/api/admin/impersonate', isSystemAdmin, (req, res) => {
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
});

app.post('/api/admin/stop-impersonating', isSystemAdmin, (req, res) => {
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
});

app.get('/g/:customUrl', async (req, res) => {
  try {
    const {customUrl} = req.params;
    const snapshot = await firestore.collection('groups').where('customUrl', '==', customUrl).limit(1).get();
    if (snapshot.empty) {
      return res.status(404).render('index', {user: req.user, ogpData: {}, noIndex: false});
    }
    const groupDoc = snapshot.docs[0];
    const groupData = groupDoc.data();
    const noIndex = groupData.noIndex || false;

    res.render('index', {user: req.user, ogpData: {}, noIndex});
  } catch (error) {
    console.error('Custom URL routing error:', error);
    res.status(500).render('index', {user: req.user, ogpData: {}, noIndex: false});
  }
});

app.get('/share/:eventId/:participantName', async (req, res) => {
  try {
    const {eventId, participantName} = req.params;
    const eventDoc = await firestore.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).send('イベントが見つかりません');
    }
    const eventData = eventDoc.data();
    const result = eventData.results ? eventData.results[decodeURIComponent(participantName)] : null;

    let imageUrl = 'https://storage.googleapis.com/amida-468218-amidakuji-assets/default-ogp.png';
    if (result && result.prize && result.prize.imageUrl) {
      imageUrl = result.prize.imageUrl;
    }

    const ogpData = {
      title: `${decodeURIComponent(participantName)}さんの結果は...！`,
      description: `${eventData.eventName || 'あみだくじイベント'}の結果をチェックしよう！`,
      imageUrl: imageUrl,
    };

    const groupDoc = await firestore.collection('groups').doc(eventData.groupId).get();
    const noIndex = groupDoc.exists && groupDoc.data().noIndex;

    res.render('index', {user: req.user, ogpData, noIndex});
  } catch (error) {
    console.error('Share page error:', error);
    res.status(500).send('ページの表示中にエラーが発生しました。');
  }
});

app.get('/api/members/:memberId', async (req, res) => {
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
});

app.get('/admin', ensureAuthenticated, isSystemAdmin, (req, res) => {
  res.render('index', {user: req.user, ogpData: {}, noIndex: true});
});

app.get('/admin-request', ensureAuthenticated, (req, res) => {
  res.render('index', {user: req.user, ogpData: {}, noIndex: true});
});

app.get('*', (req, res) => {
  const ogpData = {
    title: 'ダイナミックあみだくじ',
    description: 'インタラクティブなあみだくじアプリ',
    imageUrl: '/default-image.png',
  };
  res.render('index', {user: req.user, ogpData, noIndex: false});
});

function getNextAvailableColor(existingColors = []) {
  const baseHueStep = 45;
  const baseSaturation = 70;
  const baseLightness = 50;
  const lightnessSteps = [0, -10, 10, -20, 20, -30, 30, -40, 40];

  const existingHues = existingColors
    .map((hex) => {
      if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return null;
      const {h} = hexToHsl(hex);
      return h;
    })
    .filter((h) => h !== null);

  for (const lStep of lightnessSteps) {
    const currentLightness = baseLightness + lStep;
    for (let i = 0; i < 8; i++) {
      const targetHue = i * baseHueStep;
      const isTaken = existingHues.some((h) => Math.abs(h - targetHue) < baseHueStep / 2 || Math.abs(h - targetHue) > 360 - baseHueStep / 2);
      if (!isTaken) {
        return hslToHex(targetHue, baseSaturation, currentLightness);
      }
    }
  }
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, '0')}`;
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  let c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2,
    r = 0,
    g = 0,
    b = 0;
  if (0 <= h && h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (60 <= h && h < 180) {
    [r, g, b] = [x, c, 0];
  } else if (120 <= h && h < 180) {
    [r, g, b] = [0, c, x];
  } else if (180 <= h && h < 240) {
    [r, g, b] = [0, x, c];
  } else if (240 <= h && h < 300) {
    [r, g, b] = [x, 0, c];
  } else if (300 <= h && h < 360) {
    [r, g, b] = [c, 0, x];
  }
  r = Math.round((r + m) * 255)
    .toString(16)
    .padStart(2, '0');
  g = Math.round((g + m) * 255)
    .toString(16)
    .padStart(2, '0');
  b = Math.round((b + m) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${r}${g}${b}`;
}
function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255,
    g = parseInt(hex.slice(3, 5), 16) / 255,
    b = parseInt(hex.slice(5, 7), 16) / 255;
  let max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;
  if (max == min) {
    h = s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {h: h * 360, s: s * 100, l: l * 100};
}

// ----- アバター画像プロキシAPI -----
app.get('/api/avatar-proxy', async (req, res) => {
  const {name} = req.query;
  if (!name) {
    return res.status(400).send('Name query parameter is required');
  }
  try {
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
    const response = await fetch(avatarUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch avatar: ${response.statusText}`);
    }
    // 画像をクライアントにストリーミング
    response.body.pipe(res);
  } catch (error) {
    console.error('Avatar proxy error:', error);
    res.status(500).send('Error fetching avatar');
  }
});

app.listen(port, () => {
  console.log(`✅ サーバーが起動しました: http://localhost:${port}`);
});
