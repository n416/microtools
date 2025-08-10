const express = require('express');
const eventController = require('../controllers/eventController');
const {ensureAuthenticated} = require('../middleware/auth');
const router = express.Router();

// ★修正: 元のURL '/api/groups/...' に合わせる
router.get('/groups/:groupId/events', ensureAuthenticated, eventController.getEventsForGroup);
router.get('/groups/url/:customUrl/events', eventController.getEventsByCustomUrl);

// ★修正: 元のURL '/api/events/...' に合わせる
router.get('/events/:id', ensureAuthenticated, eventController.getEvent);
router.post('/events', ensureAuthenticated, eventController.createEvent);
router.put('/events/:id', ensureAuthenticated, eventController.updateEvent);
router.post('/events/:eventId/copy', ensureAuthenticated, eventController.copyEvent);
router.post('/events/:eventId/start', ensureAuthenticated, eventController.startEvent);
router.get('/events/:eventId/public', eventController.getPublicEventData);
router.post('/events/:eventId/join', eventController.joinEvent);
router.post('/events/:eventId/join-slot', eventController.joinSlot);
router.post('/events/:eventId/verify-password', eventController.verifyPasswordAndJoin);
router.delete('/events/:eventId/participants', eventController.deleteParticipant);

module.exports = router;