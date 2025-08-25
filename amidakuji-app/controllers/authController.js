// amidakuji-app/controllers/authController.js

exports.googleCallback = (req, res) => {
  res.redirect('/');
};

exports.logout = (req, res, next) => {
  // ★ 核心部分(1): ログアウト処理の前に、現在のセッションから合言葉の認証情報を退避させる
  const verifiedGroups = req.session.verifiedGroups || [];
  const redirectTo = req.query.redirect_to || '/'; // --- ▼▼▼ この行を変更 ▼▼▼ ---

  req.logout(function (err) {
    if (err) {
      return next(err);
    }

    // ★ 核心部分(2): ログアウト後の新しいセッションに、退避させておいた認証情報を書き戻す
    req.session.verifiedGroups = verifiedGroups;

    // セッションを保存してからレスポンスを返す
    req.session.save((err) => {
      if (err) {
        return next(err);
      }
      // JSONを返す代わりに、指定されたURLまたはトップページへリダイレクトする
      res.redirect(redirectTo); // --- ▼▼▼ この行を変更 ▼▼▼ ---
    });
  });
};

exports.clearGroupVerification = (req, res) => {
  if (req.session.verifiedGroups) {
    req.session.verifiedGroups = [];
  }
  req.session.save((err) => {
    if (err) {
      return res.status(500).json({error: 'Session could not be updated.'});
    }
    res.status(200).json({message: 'Group verification cleared.'});
  });
};
