const express = require('express');
const path = require('path');
// firebase-adminをインポート
const admin = require('firebase-admin');

const app = express();
const port = 3000;

// --- Firebase Admin SDKの初期化 ---
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Firestoreのインスタンスを取得
const firestore = admin.firestore();


// 静的ファイル（HTML, CSS, JS）を提供
app.use(express.static(path.join(__dirname, 'public')));
// JSONリクエストボディをパースするため
app.use(express.json());


/**
 * あみだくじの線を生成するヘルパー関数
 */
function generateLines(numParticipants, numPrizes) {
    const lines = [];
    const horizontalLines = 10;
    const canvasHeight = 400;

    for (let i = 0; i < horizontalLines; i++) {
        const startNode = Math.floor(Math.random() * (numParticipants - 1));
        const endNode = startNode + 1;
        const y = Math.random() * (canvasHeight - 40) + 20;

        lines.push({
            fromIndex: startNode,
            toIndex: endNode,
            y: y
        });
    }
    return lines;
}


// --- APIエンドポイント ---

/**
 * 新しいあみだくじイベントを作成し、Firestoreに保存する
 */
app.post('/api/events', async (req, res) => {
    try {
        const { participants, prizes } = req.body;

        if (!participants || !prizes || !Array.isArray(participants) || !Array.isArray(prizes)) {
            return res.status(400).json({ error: 'Invalid participants or prizes data.' });
        }

        const lines = generateLines(participants.length, prizes.length);

        const eventData = {
            participants,
            prizes,
            lines,
            createdAt: new Date(),
        };

        const docRef = await firestore.collection('events').add(eventData);

        console.log(`Event created with ID: ${docRef.id}`);
        res.status(201).json({ id: docRef.id });

    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event.' });
    }
});


/**
 * 指定されたIDのあみだくじイベントをFirestoreから読み込む
 */
app.get('/api/events/:id', async (req, res) => {
    try {
        const eventId = req.params.id;
        if (!eventId) {
            return res.status(400).json({ error: 'Event ID is required.' });
        }

        const docRef = firestore.collection('events').doc(eventId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Event not found.' });
        }

        res.status(200).json(doc.data());

    } catch (error) {
        console.error(`Error fetching event ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch event.' });
    }
});


// ルートURLへのアクセスはindex.htmlを返す
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});