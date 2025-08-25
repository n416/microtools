const express = require('express');
const groupController = require('../controllers/groupController');
const {ensureAuthenticated} = require('../middleware/auth');
const router = express.Router();

router.get('/groups', ensureAuthenticated, groupController.getGroups);
router.get('/groups/:groupId', groupController.getGroup);
router.get('/groups/url/:customUrl', groupController.getGroupByCustomUrl);
router.post('/groups', ensureAuthenticated, groupController.createGroup);
router.delete('/groups/:groupId', ensureAuthenticated, groupController.deleteGroup);
router.put('/groups/:groupId/settings', ensureAuthenticated, groupController.updateGroupSettings);

router.post('/groups/:groupId/verify-password', groupController.verifyPassword);
router.delete('/groups/:groupId/password', ensureAuthenticated, groupController.deleteGroupPassword);

router.get('/groups/:groupId/member-suggestions', groupController.getMemberSuggestions);
router.post('/groups/:groupId/login-or-register', groupController.loginOrRegisterMember);

// Member Management Routes
router.get('/groups/:groupId/members', ensureAuthenticated, groupController.getMembers);
router.post('/groups/:groupId/members', ensureAuthenticated, groupController.addMember);
router.put('/groups/:groupId/members/:memberId', ensureAuthenticated, groupController.updateMember);
router.delete('/groups/:groupId/members/:memberId', ensureAuthenticated, groupController.deleteMember);

// Bulk Member Registration Routes
router.post('/groups/:groupId/members/analyze-bulk', ensureAuthenticated, groupController.analyzeBulkMembers);
router.post('/groups/:groupId/members/finalize-bulk', ensureAuthenticated, groupController.finalizeBulkMembers);

// Prize Master Routes
router.get('/groups/:groupId/prize-masters', ensureAuthenticated, groupController.getPrizeMasters);
router.post('/groups/:groupId/prize-masters/generate-upload-url', ensureAuthenticated, groupController.generatePrizeMasterUploadUrl);
router.post('/groups/:groupId/prize-masters', ensureAuthenticated, groupController.addPrizeMaster);
router.delete('/prize-masters/:masterId', ensureAuthenticated, groupController.deletePrizeMaster);

module.exports = router;
