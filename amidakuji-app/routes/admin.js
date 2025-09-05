const express = require('express');
const adminController = require('../controllers/adminController');
const {isSystemAdmin, ensureAuthenticated} = require('../middleware/auth');
const router = express.Router();

router.post('/admin/request', ensureAuthenticated, adminController.requestAdminAccess);
router.get('/admin/requests', isSystemAdmin, adminController.getAdminRequests);
router.post('/admin/approve', isSystemAdmin, adminController.approveAdminRequest);
router.get('/admin/group-admins', isSystemAdmin, adminController.getGroupAdmins);
router.get('/admin/system-admins', isSystemAdmin, adminController.getSystemAdmins);
router.post('/admin/demote', isSystemAdmin, adminController.demoteAdmin);
router.post('/admin/impersonate', isSystemAdmin, adminController.impersonateUser);
router.post('/admin/stop-impersonating', isSystemAdmin, adminController.stopImpersonating);
router.get('/admin/groups/:groupId/password-requests', ensureAuthenticated, adminController.getPasswordRequests);
router.post('/admin/members/:memberId/delete-password', ensureAuthenticated, adminController.approvePasswordReset);

module.exports = router;