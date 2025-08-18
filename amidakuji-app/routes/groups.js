const express = require('express');
const groupController = require('../controllers/groupController');
const {ensureAuthenticated} = require('../middleware/auth');
const router = express.Router();

router.get('/groups', ensureAuthenticated, groupController.getGroups);
router.get('/groups/:groupId', groupController.getGroup);
// ▼▼▼▼▼ ここからが今回の修正箇所です ▼▼▼▼▼
router.get('/groups/url/:customUrl', groupController.getGroupByCustomUrl);
// ▲▲▲▲▲ 修正はここまで ▲▲▲▲▲
router.post('/groups', ensureAuthenticated, groupController.createGroup);
router.delete('/groups/:groupId', ensureAuthenticated, groupController.deleteGroup);
router.put('/groups/:groupId/participants', ensureAuthenticated, groupController.updateParticipants);
router.put('/groups/:groupId/participants/:participantId/color', ensureAuthenticated, groupController.updateParticipantColor);
router.put('/groups/:groupId/settings', ensureAuthenticated, groupController.updateGroupSettings);

router.post('/groups/:groupId/verify-password', groupController.verifyPassword);
router.delete('/groups/:groupId/password', ensureAuthenticated, groupController.deleteGroupPassword);

router.get('/groups/:groupId/member-suggestions', groupController.getMemberSuggestions);
router.post('/groups/:groupId/login', groupController.loginMember);
router.post('/groups/:groupId/login-or-register', groupController.loginOrRegisterMember);

// Prize Master Routes
router.get('/groups/:groupId/prize-masters', ensureAuthenticated, groupController.getPrizeMasters);
router.post('/groups/:groupId/prize-masters/generate-upload-url', ensureAuthenticated, groupController.generatePrizeMasterUploadUrl);
router.post('/groups/:groupId/prize-masters', ensureAuthenticated, groupController.addPrizeMaster);
router.delete('/prize-masters/:masterId', ensureAuthenticated, groupController.deletePrizeMaster);

module.exports = router;