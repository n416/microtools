// amidakuji-app/middleware/auth.js

const {firestore} = require('../utils/firestore');

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  // ▼▼▼ 修正箇所 ▼▼▼
  // JSONを返す代わりに、トップページへリダイレクトする
  res.redirect('/');
  // ▲▲▲ 修正ここまで ▲▲▲
}

async function isSystemAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({error: 'ログインが必要です。'});
  }
  const userId = req.user.isImpersonating ? req.user.originalUser.id : req.user.id;
  const userRef = firestore.collection('users').doc(userId);
  const doc = await userRef.get();
  if (doc.exists && doc.data().role === 'system_admin') {
    return next();
  }
  return res.status(403).json({error: 'アクセス権がありません。'});
}

module.exports = {
  ensureAuthenticated,
  isSystemAdmin,
};