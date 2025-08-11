const express = require('express');
const eventController = require('../controllers/eventController');
const {ensureAuthenticated} = require('../middleware/auth');
const router = express.Router();

// ★★★ 修正箇所: ensureAuthenticated を削除 ★★★
router.get('/groups/:groupId/events', eventController.getEventsForGroup);
router.get('/groups/url/:customUrl/events', eventController.getEventsByCustomUrl);

// 【新規】シェアページ専用の認証不要APIルートを追加
router.get('/share/:eventId', eventController.getPublicShareData);

router.get('/events/:id', ensureAuthenticated, eventController.getEvent);
router.post('/events', ensureAuthenticated, eventController.createEvent);
router.put('/events/:id', ensureAuthenticated, eventController.updateEvent);
router.post('/events/:eventId/copy', ensureAuthenticated, eventController.copyEvent);
router.post('/events/:eventId/start', ensureAuthenticated, eventController.startEvent);
router.delete('/events/:eventId', ensureAuthenticated, eventController.deleteEvent); // <<< この行を追加

// ★★★ 修正箇所: ensureAuthenticated を削除 ★★★
router.get('/events/:eventId/public', eventController.getPublicEventData);

router.post('/events/:eventId/join', eventController.joinEvent);
router.post('/events/:eventId/join-slot', eventController.joinSlot);
router.post('/events/:eventId/verify-password', eventController.verifyPasswordAndJoin);
router.delete('/events/:eventId/participants', eventController.deleteParticipant);

module.exports = router;