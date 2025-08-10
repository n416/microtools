exports.googleCallback = (req, res) => {
  res.redirect('/');
};

exports.logout = (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
};
