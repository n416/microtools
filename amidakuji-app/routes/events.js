const express = require('express');
const eventController = require('../controllers/eventController');
const {ensureAuthenticated} = require('../middleware/auth');
const router = express.Router();

router.get('/groups/:groupId/events', ensureAuthenticated, eventController.getEventsForGroup);
router.get('/groups/url/:customUrl/events', eventController.getEventsByCustomUrl);

// 【新規】シェアページ専用の認証不要APIルートを追加
router.get('/share/:eventId', eventController.getPublicShareData);

// 誰でもアクセスできるグループのイベント一覧API
router.get('/events/by-group/:groupId', eventController.getPublicEventsForGroup);
router.post('/events/:eventId/generate-upload-url', ensureAuthenticated, eventController.generatePrizeUploadUrl);

// 【新規】シェアページ専用の認証不要APIルートを追加
router.get('/share/:eventId', eventController.getPublicShareData);

router.get('/events/:id', ensureAuthenticated, eventController.getEvent);
router.post('/events', ensureAuthenticated, eventController.createEvent);
router.put('/events/:id', ensureAuthenticated, eventController.updateEvent);
router.get('/events/:eventId/public', eventController.getPublicEventData);
router.post('/events/:eventId/copy', ensureAuthenticated, eventController.copyEvent);
router.post('/events/:eventId/start', ensureAuthenticated, eventController.startEvent);
router.delete('/events/:eventId', ensureAuthenticated, eventController.deleteEvent);

router.get('/events/:eventId/public', eventController.getPublicEventData);

router.post('/events/:eventId/join', eventController.joinEvent);
router.post('/events/:eventId/join-slot', eventController.joinSlot);
router.post('/events/:eventId/verify-password', eventController.verifyPasswordAndJoin);
router.delete('/events/:eventId/participants', eventController.deleteParticipant);

router.post('/events/:eventId/regenerate-lines', ensureAuthenticated, eventController.regenerateLines);
router.post('/events/:eventId/shuffle-prizes', ensureAuthenticated, eventController.shufflePrizes);
router.post('/events/:eventId/acknowledge-result', eventController.acknowledgeResult);

module.exports = router;
