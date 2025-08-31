const {firestore} = require('../../utils/firestore');
const {generateLines, calculateResults} = require('../../utils/amidakuji');

exports.startEvent = async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();

    if (!doc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }
    const eventData = doc.data();
    const isOwner = req.user && eventData.ownerId === req.user.id;
    const isSysAdmin = req.user && req.user.role === 'system_admin' && !req.user.isImpersonating;

    if (!isOwner && !isSysAdmin) {
      return res.status(403).json({error: 'このイベントを開始する権限がありません。'});
    }

    if (eventData.status === 'started') {
      return res.status(400).json({error: 'イベントは既に開始されています。'});
    }

    // ▼▼▼ doodlesを渡すように修正 ▼▼▼
    const results = calculateResults(eventData.participants, eventData.lines, eventData.prizes, eventData.doodles);
    // ▲▲▲ ここまで修正 ▲▲▲

    await eventRef.update({status: 'started', results: results});
    res.status(200).json({message: 'イベントが開始されました。', results});
  } catch (error) {
    console.error('Error starting event:', error);
    res.status(500).json({error: 'イベントの開始に失敗しました。'});
  }
};

exports.regenerateLines = async (req, res) => {
  try {
    const {eventId} = req.params;
    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();

    if (!doc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }
    const eventData = doc.data();
    if (eventData.ownerId !== req.user.id) {
      return res.status(403).json({error: 'このイベントを操作する権限がありません。'});
    }
    if (eventData.status === 'started') {
      return res.status(400).json({error: '開始済みのイベントのあみだくじは変更できません。'});
    }

    const newLines = generateLines(eventData.participantCount);
    // ▼▼▼ doodlesを渡すように修正 ▼▼▼
    const newResults = calculateResults(eventData.participants, newLines, eventData.prizes, eventData.doodles);
    // ▲▲▲ ここまで修正 ▲▲▲

    await eventRef.update({
      lines: newLines,
      results: newResults,
    });

    res.status(200).json({
      message: 'あみだくじが再生成されました。',
      lines: newLines,
      results: newResults,
    });
  } catch (error) {
    console.error('Error regenerating Amidakuji lines:', error);
    res.status(500).json({error: 'あみだくじの再生成に失敗しました。'});
  }
};

exports.shufflePrizes = async (req, res) => {
  try {
    const {eventId} = req.params;
    const {shuffledPrizes} = req.body;

    if (!shuffledPrizes || !Array.isArray(shuffledPrizes)) {
      return res.status(400).json({error: '景品リストが無効です。'});
    }

    const eventRef = firestore.collection('events').doc(eventId);
    const doc = await eventRef.get();

    if (!doc.exists) {
      return res.status(404).json({error: 'イベントが見つかりません。'});
    }
    const eventData = doc.data();
    if (eventData.ownerId !== req.user.id) {
      return res.status(403).json({error: 'このイベントを操作する権限がありません。'});
    }

    // ▼▼▼ doodlesを渡すように修正 ▼▼▼
    const newResults = calculateResults(eventData.participants, eventData.lines, shuffledPrizes, eventData.doodles);
    // ▲▲▲ ここまで修正 ▲▲▲

    await eventRef.update({prizes: shuffledPrizes, results: newResults});

    res.status(200).json({message: '景品がシャッフルされました。', prizes: shuffledPrizes, results: newResults});
  } catch (error) {
    console.error('Error shuffling prizes:', error);
    res.status(500).json({error: '景品のシャッフルに失敗しました。'});
  }
};
