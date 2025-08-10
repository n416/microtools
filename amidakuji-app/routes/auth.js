const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const router = express.Router();

// ★修正: 元のURL '/auth/...' に合わせる
router.get('/google', passport.authenticate('google', {scope: ['profile', 'email']}));

router.get(
  '/google/callback',
  passport.authenticate('google', {failureRedirect: '/?login_error=1'}),
  authController.googleCallback
);

router.get('/logout', authController.logout);

module.exports = router;