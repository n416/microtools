const express = require('express');
const groupController = require('../controllers/groupController');
const {ensureAuthenticated} = require('../middleware/auth');
const router = express.Router();

// ★修正: 元のURL '/api/groups/...' に合わせる
router.get('/groups', ensureAuthenticated, groupController.getGroups);
router.post('/groups', ensureAuthenticated, groupController.createGroup);
router.put('/groups/:groupId/participants', ensureAuthenticated, groupController.updateParticipants);
router.put('/groups/:groupId/participants/:participantId/color', ensureAuthenticated, groupController.updateParticipantColor);
router.put('/groups/:groupId/settings', ensureAuthenticated, groupController.updateGroupSettings);
router.post('/groups/:groupId/check-password', groupController.checkGroupPassword);
router.get('/groups/:groupId/member-suggestions', groupController.getMemberSuggestions);
router.post('/groups/:groupId/login', groupController.loginMember);

// Prize Master Routes
router.get('/groups/:groupId/prize-masters', ensureAuthenticated, groupController.getPrizeMasters);
router.post('/groups/:groupId/prize-masters/generate-upload-url', ensureAuthenticated, groupController.generatePrizeMasterUploadUrl);
router.post('/groups/:groupId/prize-masters', ensureAuthenticated, groupController.addPrizeMaster);

// ★修正: 元のURL '/api/prize-masters/...' に合わせる
router.delete('/prize-masters/:masterId', ensureAuthenticated, groupController.deletePrizeMaster);

module.exports = router;