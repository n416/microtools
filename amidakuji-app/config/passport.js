// amidakuji-app/config/passport.js

const GoogleStrategy = require('passport-google-oauth20').Strategy;
const {firestore} = require('../utils/firestore');

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const userRef = firestore.collection('users').doc(profile.id);
          const userDoc = await userRef.get();

          if (!userDoc.exists) {
            const newUser = {
              email: profile.emails[0].value,
              name: profile.displayName,
              role: 'user',
              createdAt: new Date(),
            };
            await userRef.set(newUser);

            const groupsRef = firestore.collection('groups');
            const defaultGroup = {
              name: '新規グループ',
              ownerId: profile.id,
              createdAt: new Date(),
              participants: [],
            };
            await groupsRef.add(defaultGroup);

            return done(null, {id: profile.id, ...newUser});
          } else {
            return done(null, {id: userDoc.id, ...userDoc.data()});
          }
        } catch (error) {
          console.error('Error during Google authentication strategy:', error);
          return done(error, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    if (user.isImpersonating) {
      done(null, {originalAdminId: user.originalUser.id, targetUserId: user.id});
    } else {
      done(null, {targetUserId: user.id});
    }
  });

  passport.deserializeUser(async (sessionData, done) => {
    try {
      const targetUserId = typeof sessionData === 'object' && sessionData.targetUserId ? sessionData.targetUserId : sessionData;
      const originalAdminId = typeof sessionData === 'object' && sessionData.originalAdminId ? sessionData.originalAdminId : null;

      if (!targetUserId) {
        return done(null, false);
      }

      if (originalAdminId) {
        const originalAdminRef = firestore.collection('users').doc(originalAdminId);
        const originalAdminDoc = await originalAdminRef.get();
        if (!originalAdminDoc.exists) return done(null, false);

        const targetUserRef = firestore.collection('users').doc(targetUserId);
        const targetUserDoc = await targetUserRef.get();
        if (!targetUserDoc.exists) return done(null, false);

        const user = {
          id: targetUserDoc.id,
          ...targetUserDoc.data(),
          originalUser: {id: originalAdminDoc.id, ...originalAdminDoc.data()},
          isImpersonating: true,
        };
        return done(null, user);
      } else {
        const userRef = firestore.collection('users').doc(targetUserId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
          return done(null, false);
        }
        return done(null, {id: userDoc.id, ...userDoc.data()});
      }
    } catch (err) {
      return done(err);
    }
  });
};
