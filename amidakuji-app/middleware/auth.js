// amidakuji-app/middleware/auth.js

const {firestore} = require('../utils/firestore');

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  // APIルートか、それ以外（ページ表示）かを判定
  const isApiRequest = req.originalUrl.startsWith('/api/');

  // APIリクエスト、または明確にJSONのみを要求している場合
  if (isApiRequest || (req.accepts('json') && !req.accepts('html'))) {
    return res.status(401).json({error: 'ログインが必要です。'});
  } else {
    // ページ表示リクエストの場合
    res.status(401).render('index', {
      user: null,
      ogpData: {},
      noIndex: true,
      groupData: null,
      eventData: null,
      error: {message: 'このページにアクセスするにはログインが必要です。'},
    });
  }
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
