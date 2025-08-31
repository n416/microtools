const {Firestore} = require('@google-cloud/firestore');
const {Storage} = require('@google-cloud/storage');

const firestoreOptions = {};
const storageOptions = {};

// ローカル環境の場合のみ、サービスアカウントキーのファイルパスを指定する
if (process.env.NODE_ENV !== 'production') {
  firestoreOptions.keyFilename = './serviceAccountKey.json';
  storageOptions.keyFilename = './serviceAccountKey.json';
}

const firestore = new Firestore(firestoreOptions);
const storage = new Storage(storageOptions);

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

module.exports = {firestore, storage, bucket};