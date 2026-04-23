const {Firestore} = require('@google-cloud/firestore');
const {Storage} = require('@google-cloud/storage');

const firestoreOptions = {};
const storageOptions = {};

// ローカル環境の場合のみ、サービスアカウントキーのファイルパスを指定する
if (process.env.NODE_ENV !== 'production') {
  const fs = require('fs');
  if (fs.existsSync('./serviceAccountKey.json')) {
    firestoreOptions.keyFilename = './serviceAccountKey.json';
    storageOptions.keyFilename = './serviceAccountKey.json';
  } else {
    console.warn("⚠️ serviceAccountKey.json が見つかりません。Application Default Credentials (ADC) を使用して接続します。");
  }
}

const firestore = new Firestore(firestoreOptions);
const storage = new Storage(storageOptions);

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

module.exports = {firestore, storage, bucket};