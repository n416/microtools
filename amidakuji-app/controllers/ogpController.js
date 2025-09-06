// controllers/ogpController.js (修正後)
const { firestore, bucket } = require('../utils/firestore');
const sharp = require('sharp');
const fetch = require('node-fetch');

const DEFAULT_IMAGE_URL = 'https://storage.googleapis.com/amidakuji-app-native.appspot.com/default-ogp.png';

exports.generateOgpImage = async (req, res) => {
  try {
    const { eventId, participantName } = req.params;
    const decodedParticipantName = decodeURIComponent(participantName);

    const cacheFileName = `ogp-cache/${eventId}-${Buffer.from(decodedParticipantName).toString('base64')}.png`;
    const file = bucket.file(cacheFileName);

    const [exists] = await file.exists();
    if (exists) {
      // ★ 修正点: Cache-Controlヘッダーを追加
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24時間
      res.setHeader('Content-Type', 'image/png');
      file.createReadStream().pipe(res);
      return;
    }

    const eventDoc = await firestore.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).send('Event not found');
    }
    const eventData = eventDoc.data();
    const result = eventData.results ? eventData.results[decodedParticipantName] : null;

    let baseImageUrl = DEFAULT_IMAGE_URL;
    if (result && result.prize && result.prize.imageUrl) {
      baseImageUrl = result.prize.imageUrl;
    }

    const imageResponse = await fetch(baseImageUrl);
    if (!imageResponse.ok) throw new Error('Failed to fetch base image');
    const imageBuffer = await imageResponse.buffer();

    const processedImageBuffer = await sharp(imageBuffer)
      .blur(25)
      .png()
      .toBuffer();

    const stream = file.createWriteStream({
      metadata: {
        contentType: 'image/png',
        // ★ 修正点: GCSオブジェクト自体のキャッシュ設定も追加
        cacheControl: 'public, max-age=86400',
      },
    });

    stream.on('error', (err) => {
      console.error('GCS stream write error:', err);
    });

    stream.on('finish', () => {
      console.log(`Successfully uploaded OGP cache: ${cacheFileName}`);
    });

    // ★ 修正点: レスポンスヘッダーを追加
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24時間
    res.setHeader('Content-Type', 'image/png');
    res.write(processedImageBuffer);
    res.end();

    stream.end(processedImageBuffer);

  } catch (error) {
    console.error('OGP Image Generation Error:', error);
    res.redirect(DEFAULT_IMAGE_URL);
  }
};