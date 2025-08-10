const {Firestore} = require('@google-cloud/firestore');
const {Storage} = require('@google-cloud/storage');

const firestore = new Firestore({
  keyFilename: './serviceAccountKey.json',
  databaseId: 'amida',
});

const storage = new Storage({
  keyFilename: './serviceAccountKey.json',
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

module.exports = {firestore, storage, bucket};
