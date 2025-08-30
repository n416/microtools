const express = require('express');
const {ensureAuthenticated} = require('../middleware/auth');
const router = express.Router();

// 分割したコントローラを読み込む
const eventController = require('../controllers/event/event.js');
const amidakujiController = require('../controllers/event/amidakuji.js');
const participantController = require('../controllers/event/participant.js');
const publicController = require('../controllers/event/public.js');

// --- Public Routes ---
router.get('/groups/:groupId/events', ensureAuthenticated, publicController.getEventsForGroup);
router.get('/groups/url/:customUrl/events', publicController.getEventsByCustomUrl);
router.get('/events/by-group/:groupId', publicController.getPublicEventsForGroup);
router.get('/share/:eventId', publicController.getPublicShareData);
router.get('/share/:eventId/:participantName', publicController.getPublicShareData);
router.get('/events/:eventId/public', publicController.getPublicEventData);

// --- Event Management Routes (Authenticated) ---
router.get('/events/:id', ensureAuthenticated, eventController.getEvent);
router.post('/events', ensureAuthenticated, eventController.createEvent);
router.put('/events/:id', ensureAuthenticated, eventController.updateEvent);
router.delete('/events/:eventId', ensureAuthenticated, eventController.deleteEvent);
router.post('/events/:eventId/copy', ensureAuthenticated, eventController.copyEvent);
router.post('/events/:eventId/generate-upload-url', ensureAuthenticated, eventController.generatePrizeUploadUrl);

// --- Amidakuji Logic Routes (Authenticated) ---
router.post('/events/:eventId/start', ensureAuthenticated, amidakujiController.startEvent);
router.post('/events/:eventId/regenerate-lines', ensureAuthenticated, amidakujiController.regenerateLines);
router.post('/events/:eventId/shuffle-prizes', ensureAuthenticated, amidakujiController.shufflePrizes);

// --- Participant Action Routes ---
router.post('/events/:eventId/join', participantController.joinEvent);
router.post('/events/:eventId/join-slot', participantController.joinSlot);
router.post('/events/:eventId/verify-password', participantController.verifyPasswordAndJoin);
router.delete('/events/:eventId/participants', participantController.deleteParticipant);
router.post('/events/:eventId/acknowledge-result', participantController.acknowledgeResult);
router.post('/events/:eventId/fill-slots', ensureAuthenticated, participantController.fillSlots);
// ▼▼▼ ここから修正 ▼▼▼
router.post('/events/:eventId/doodle', participantController.addDoodle);
// ▲▲▲ ここまで修正 ▲▲▲

module.exports = router;
