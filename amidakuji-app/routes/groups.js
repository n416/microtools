const express = require('express');
const groupController = require('../controllers/groupController');
const {ensureAuthenticated} = require('../middleware/auth');
const router = express.Router();

router.get('/groups', ensureAuthenticated, groupController.getGroups);
router.post('/groups', ensureAuthenticated, groupController.createGroup);
router.put('/groups/:groupId/participants', ensureAuthenticated, groupController.updateParticipants);
router.put('/groups/:groupId/participants/:participantId/color', ensureAuthenticated, groupController.updateParticipantColor);
router.put('/groups/:groupId/settings', ensureAuthenticated, groupController.updateGroupSettings);

// 【修正】古いcheck-passwordから新しいverify-passwordに変更
router.post('/groups/:groupId/verify-password', groupController.verifyPassword);
// 【新規】合言葉削除APIのルート
router.delete('/groups/:groupId/password', ensureAuthenticated, groupController.deleteGroupPassword);

router.get('/groups/:groupId/member-suggestions', groupController.getMemberSuggestions);
router.post('/groups/:groupId/login', groupController.loginMember);

// Prize Master Routes
router.get('/groups/:groupId/prize-masters', ensureAuthenticated, groupController.getPrizeMasters);
router.post('/groups/:groupId/prize-masters/generate-upload-url', ensureAuthenticated, groupController.generatePrizeMasterUploadUrl);
router.post('/groups/:groupId/prize-masters', ensureAuthenticated, groupController.addPrizeMaster);
router.delete('/prize-masters/:masterId', ensureAuthenticated, groupController.deletePrizeMaster);

module.exports = router;
