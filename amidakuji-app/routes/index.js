const express = require('express');
const {firestore} = require('../utils/firestore');
const {ensureAuthenticated, isSystemAdmin} = require('../middleware/auth');
const router = express.Router();
const fetch = require('node-fetch');

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

// OGP and page rendering routes
router.get('/g/:customUrl', async (req, res) => {
  try {
    const {customUrl} = req.params;
    const snapshot = await firestore.collection('groups').where('customUrl', '==', customUrl).limit(1).get();

    if (snapshot.empty) {
      return res.status(404).render('index', {
        user: req.user,
        ogpData: {},
        noIndex: false,
        groupData: null,
      });
    }

    const groupDoc = snapshot.docs[0];
    const groupData = {id: groupDoc.id, ...groupDoc.data()};
    const noIndex = groupData.noIndex || false;

    res.render('index', {
      user: req.user,
      ogpData: {},
      noIndex,
      groupData: JSON.stringify(groupData),
    });
  } catch (error) {
    console.error('Custom URL routing error:', error);
    res.status(500).render('index', {user: req.user, ogpData: {}, noIndex: false, groupData: null});
  }
});

// ▼▼▼▼▼ ここからが今回の修正箇所です ▼▼▼▼▼
// events/:eventId ルートを追加
router.get('/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const eventDoc = await firestore.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return res.status(404).render('index', { user: req.user, ogpData: {}, noIndex: false, groupData: null });
    }

    const eventData = eventDoc.data();
    const groupDoc = await firestore.collection('groups').doc(eventData.groupId).get();
    const noIndex = groupDoc.exists && groupDoc.data().noIndex;

    res.render('index', {
      user: req.user,
      ogpData: {
        title: eventData.eventName || 'ダイナミックあみだくじ',
        description: 'イベントに参加しよう！'
      },
      noIndex,
      groupData: null, // カスタムURL経由ではないのでグループデータは渡さない
    });
  } catch (error) {
    console.error('Direct event URL routing error:', error);
    res.status(500).render('index', { user: req.user, ogpData: {}, noIndex: false, groupData: null });
  }
});
// ▲▲▲▲▲ 修正はここまで ▲▲▲▲▲

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

    res.render('index', {user: req.user, ogpData, noIndex, eventData: JSON.stringify(eventData), groupData: null});
  } catch (error) {
    console.error('Share page error:', error);
    res.status(500).send('ページの表示中にエラーが発生しました。');
  }
});

router.get('/admin', ensureAuthenticated, isSystemAdmin, (req, res) => {
  res.render('index', {user: req.user, ogpData: {}, noIndex: true});
});

router.get('/admin-request', ensureAuthenticated, (req, res) => {
  res.render('index', {user: req.user, ogpData: {}, noIndex: true});
});

// Catch-all route (must be the very last route)
router.get('*', (req, res) => {
  const ogpData = {
    title: 'ダイナミックあみだくじ',
    description: 'インタラクティブなあみだくじアプリ',
    imageUrl: '/default-image.png',
  };
  res.render('index', {user: req.user, ogpData, noIndex: false, groupData: null});
});

module.exports = router;