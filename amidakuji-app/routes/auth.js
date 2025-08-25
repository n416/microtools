const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const router = express.Router();

router.get('/google', passport.authenticate('google', {scope: ['profile', 'email']}));

router.get('/google/callback', (req, res, next) => {
  // passport.authenticateにカスタムコールバックを渡して、セッション制御を手動で行う
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/?login_error=1');
    }

    // ★ 核心部分(1): ログイン処理の前に、現在のセッションから合言葉の認証情報を退避させる
    const verifiedGroups = req.session.verifiedGroups || [];

    // req.logInを実行すると、セッションが再生成（regenerate）される
    req.logIn(user, function (err) {
      if (err) {
        return next(err);
      }

      // ★ 核心部分(2): 再生成された「新しい」セッションに、退避させておいた認証情報を書き戻す
      req.session.verifiedGroups = verifiedGroups;

      // セッションを保存してからリダイレクトする
      req.session.save(() => {
        res.redirect('/');
      });
    });
  })(req, res, next);
});

router.get('/logout', authController.logout);
router.post('/clear-group-verification', authController.clearGroupVerification);

module.exports = router;
