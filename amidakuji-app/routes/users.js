const express = require('express');
const userController = require('../controllers/userController');
const {ensureAuthenticated} = require('../middleware/auth');
const router = express.Router();

// ★修正: 元のURL '/api/user/me' に合わせる
router.get('/user/me', userController.getCurrentUser);
router.delete('/user/me', ensureAuthenticated, userController.deleteUser);
router.post('/user/me/last-group', ensureAuthenticated, userController.updateLastGroup);

// ★修正: 元のURL '/api/members/...' に合わせる
router.get('/members/:memberId', userController.getMemberDetails);
router.delete('/members/:memberId', userController.deleteMemberAccount);
router.post('/members/:memberId/request-password-deletion', userController.requestPasswordDeletion);
router.post('/members/:memberId/generate-upload-url', userController.generateUploadUrl);
router.put('/members/:memberId/profile', userController.updateProfile);
router.post('/members/:memberId/set-password', userController.setPassword);

module.exports = router;