// routes/index.js
const express = require('express');
const {firestore} = require('../utils/firestore');
const {ensureAuthenticated, isSystemAdmin} = require('../middleware/auth');
const router = express.Router();
const fetch = require('node-fetch');
const ogpController = require('../controllers/ogpController'); // ★ 新規追加

// Avatar proxy (APIルートなので先頭に配置)
router.get('/api/avatar-proxy', async (req, res) => {
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
    response.body.pipe(res);
  } catch (error) {
    console.error('Avatar proxy error:', error);
    res.status(500).send('Error fetching avatar');
  }
});

// ★ OGP画像配信用エンドポイントを新規追加
router.get('/api/share/:eventId/:participantName/ogp.png', ogpController.generateOgpImage);

// OGP and page rendering routes
router.get('/g/:customUrl', async (req, res) => {
  try {
    const {customUrl} = req.params;
    const snapshot = await firestore.collection('groups').where('customUrl', '==', customUrl).limit(1).get();

    if (snapshot.empty) {
      return res.status(404).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null});
    }

    const groupDoc = snapshot.docs[0];
    const groupData = {id: groupDoc.id, ...groupDoc.data()};
    const noIndex = groupData.noIndex || false;

    res.render('index', {user: req.user, ogpData: {}, noIndex, groupData: JSON.stringify(groupData)});
  } catch (error) {
    console.error('Custom URL routing error:', error);
    res.status(500).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null});
  }
});

router.get('/g/:customUrl/dashboard', async (req, res) => {
  try {
    const {customUrl} = req.params;
    const snapshot = await firestore.collection('groups').where('customUrl', '==', customUrl).limit(1).get();

    if (snapshot.empty) {
      return res.status(404).render('index', {user: req.user, ogpData: {}, noIndex: true, groupData: null});
    }

    const groupDoc = snapshot.docs[0];
    const groupData = {id: groupDoc.id, ...groupDoc.data()};
    const noIndex = groupData.noIndex || false;

    res.render('index', {user: req.user, ogpData: {}, noIndex, groupData: JSON.stringify(groupData), eventData: null});
  } catch (error) {
    console.error('Participant dashboard routing error:', error);
    res.status(500).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null, eventData: null});
  }
});

// ▼▼▼ ここからが今回の修正点です ▼▼▼
router.get('/groups/:groupId/dashboard', async (req, res) => {
  try {
    const {groupId} = req.params;
    const groupDoc = await firestore.collection('groups').doc(groupId).get();

    if (!groupDoc.exists) {
      return res.status(404).render('index', {user: req.user, ogpData: {}, noIndex: true, groupData: null});
    }

    const groupData = {id: groupDoc.id, ...groupDoc.data()};
    const noIndex = groupData.noIndex || false;

    res.render('index', {user: req.user, ogpData: {}, noIndex, groupData: JSON.stringify(groupData), eventData: null});
  } catch (error) {
    console.error('Participant dashboard routing error:', error);
    res.status(500).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null, eventData: null});
  }
});
// ▲▲▲ ここまでが修正点です ▲▲▲

router.get('/admin/groups/:groupId', ensureAuthenticated, async (req, res) => {
  try {
    const {groupId} = req.params;
    const groupDoc = await firestore.collection('groups').doc(groupId).get();

    if (!groupDoc.exists) {
      return res.status(404).render('index', {user: req.user, ogpData: {}, noIndex: true, groupData: null});
    }
    const groupData = {id: groupDoc.id, ...groupDoc.data()};

    if (groupData.ownerId !== req.user.id) {
      return res.status(403).render('index', {user: req.user, ogpData: {}, noIndex: true, groupData: null, message: 'アクセス権がありません'});
    }

    res.render('index', {user: req.user, ogpData: {}, noIndex: true, groupData: JSON.stringify(groupData)});
  } catch (error) {
    console.error('Admin Group ID routing error:', error);
    res.status(500).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null});
  }
});

router.get('/groups/:groupId', async (req, res) => {
  try {
    const {groupId} = req.params;
    const groupDoc = await firestore.collection('groups').doc(groupId).get();

    if (!groupDoc.exists) {
      return res.status(404).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null});
    }
    const groupData = {id: groupDoc.id, ...groupDoc.data()};
    const noIndex = groupData.noIndex || false;

    res.render('index', {user: req.user, ogpData: {}, noIndex, groupData: JSON.stringify(groupData)});
  } catch (error) {
    console.error('Group ID routing error:', error);
    res.status(500).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null});
  }
});

router.get('/events/:eventId', async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventDoc = await firestore.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return res.status(404).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null});
    }

    const eventData = eventDoc.data();
    const groupDoc = await firestore.collection('groups').doc(eventData.groupId).get();
    const noIndex = groupDoc.exists && groupDoc.data().noIndex;

    res.render('index', {
      user: req.user,
      ogpData: {
        title: eventData.eventName || 'ダイナミックあみだくじ',
        description: 'イベントに参加しよう！',
      },
      noIndex,
      groupData: null,
    });
  } catch (error) {
    console.error('Direct event URL routing error:', error);
    res.status(500).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null});
  }
});

router.get('/g/:customUrl/:eventId', async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventDoc = await firestore.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return res.status(404).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null});
    }

    const eventData = eventDoc.data();
    const groupDoc = await firestore.collection('groups').doc(eventData.groupId).get();
    const groupData = groupDoc.exists ? {id: groupDoc.id, ...groupDoc.data()} : null;
    const noIndex = groupDoc.exists && groupDoc.data().noIndex;

    res.render('index', {
      user: req.user,
      ogpData: {},
      noIndex,
      groupData: groupData ? JSON.stringify(groupData) : null,
    });
  } catch (error) {
    console.error('Event URL routing error:', error);
    res.status(500).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null});
  }
});

router.get('/share/:eventId/:participantName', async (req, res) => {
  try {
    const {eventId, participantName} = req.params;
    const eventDoc = await firestore.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).send('イベントが見つかりません');
    }
    const eventData = eventDoc.data();

    // ★★★ ここからが修正点 ★★★
    // OGP画像のURLを、動的生成用エンドポイントに変更
    const imageUrl = `${req.protocol}://${req.get('host')}/api/share/${eventId}/${participantName}/ogp.png`;
    // ★★★ ここまでが修正点 ★★★

    const ogpData = {
      title: `${decodeURIComponent(participantName)}さんの結果は...！`,
      description: `${eventData.eventName || 'あみだくじイベント'}の結果をチェックしよう！`,
      imageUrl: imageUrl, // ★ 修正
    };

    const groupDoc = await firestore.collection('groups').doc(eventData.groupId).get();
    const noIndex = groupDoc.exists && groupDoc.data().noIndex;

    res.render('index', {user: req.user, ogpData, noIndex, eventData: JSON.stringify(eventData), groupData: null});
  } catch (error) {
    console.error('Share page error:', error);
    res.status(500).send('ページの表示中にエラーが発生しました。');
  }
});

router.get('/admin/dashboard', ensureAuthenticated, isSystemAdmin, (req, res) => {
  res.render('index', {user: req.user, ogpData: {}, noIndex: true, groupData: null, eventData: null});
});

router.get('/admin/group/:groupId/event/new', ensureAuthenticated, (req, res) => {
  res.render('index', {user: req.user, ogpData: {}, noIndex: true, groupData: null, eventData: null});
});

router.get('/admin/event/:eventId/edit', ensureAuthenticated, async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventDoc = await firestore.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).render('index', {user: req.user, ogpData: {}, noIndex: true, groupData: null});
    }
    res.render('index', {user: req.user, ogpData: {}, noIndex: true, groupData: null, eventData: null});
  } catch (error) {
    console.error('Admin Event Edit routing error:', error);
    res.status(500).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null});
  }
});

router.get('/admin/event/:eventId/broadcast', ensureAuthenticated, async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventDoc = await firestore.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).render('index', {user: req.user, ogpData: {}, noIndex: true, groupData: null});
    }
    res.render('index', {user: req.user, ogpData: {}, noIndex: true, groupData: null, eventData: null});
  } catch (error) {
    console.error('Admin Event Broadcast routing error:', error);
    res.status(500).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null});
  }
});

router.get('/admin', ensureAuthenticated, isSystemAdmin, (req, res) => {
  res.render('index', {user: req.user, ogpData: {}, noIndex: true});
});
router.get('/admin-request', ensureAuthenticated, (req, res) => {
  res.render('index', {user: req.user, ogpData: {}, noIndex: true});
});

router.get('*', (req, res) => {
  res.render('index', {
    user: req.user,
    ogpData: {},
    noIndex: true,
    groupData: null,
    eventData: null,
  });
});

module.exports = router;
