const express = require('express');
const {ensureAuthenticated} = require('../middleware/auth');
const router = express.Router();

const groupController = require('../controllers/group/group.js');
const settingsController = require('../controllers/group/settings.js');
const memberController = require('../controllers/member/member.js');
const bulkMemberController = require('../controllers/member/bulk.js');
const prizeMasterController = require('../controllers/prize/master.js');
const maintenanceController = require('../controllers/group/maintenance.js'); // ★ 追加

router.get('/groups', ensureAuthenticated, groupController.getGroups);
router.get('/groups/:groupId', groupController.getGroup);
router.get('/groups/url/:customUrl', groupController.getGroupByCustomUrl);
router.post('/groups', ensureAuthenticated, groupController.createGroup);
router.delete('/groups/:groupId', ensureAuthenticated, groupController.deleteGroup);

router.put('/groups/:groupId/settings', ensureAuthenticated, settingsController.updateGroupSettings);
router.post('/groups/:groupId/verify-password', settingsController.verifyPassword);
router.delete('/groups/:groupId/password', ensureAuthenticated, settingsController.deleteGroupPassword);

router.get('/groups/:groupId/members', ensureAuthenticated, memberController.getMembers);
router.post('/groups/:groupId/members', ensureAuthenticated, memberController.addMember);
router.put('/groups/:groupId/members/:memberId', ensureAuthenticated, memberController.updateMember);
router.delete('/groups/:groupId/members/:memberId', ensureAuthenticated, memberController.deleteMember);
router.get('/groups/:groupId/member-suggestions', memberController.getMemberSuggestions);
router.post('/groups/:groupId/login-or-register', memberController.loginOrRegisterMember);
router.put('/groups/:groupId/members/:memberId/status', ensureAuthenticated, memberController.updateMemberStatus);
router.get('/groups/:groupId/unjoined-members', ensureAuthenticated, memberController.getUnjoinedMembers);

router.post('/groups/:groupId/members/analyze-bulk', ensureAuthenticated, bulkMemberController.analyzeBulkMembers);
router.post('/groups/:groupId/members/finalize-bulk', ensureAuthenticated, bulkMemberController.finalizeBulkMembers);

router.get('/groups/:groupId/prize-masters', ensureAuthenticated, prizeMasterController.getPrizeMasters);
router.post('/groups/:groupId/prize-masters/generate-upload-url', ensureAuthenticated, prizeMasterController.generatePrizeMasterUploadUrl);
router.post('/groups/:groupId/prize-masters', ensureAuthenticated, prizeMasterController.addPrizeMaster);
router.delete('/prize-masters/:masterId', ensureAuthenticated, prizeMasterController.deletePrizeMaster);

router.post('/groups/:groupId/cleanup-events', ensureAuthenticated, maintenanceController.cleanupPastEvents); // ★ 追加

module.exports = router;
