const {firestore} = require('../../utils/firestore');
const crypto = require('crypto');
const {getNextAvailableColor} = require('../../utils/color');
const {normalizeName} = require('../../utils/text');
const kuromoji = require('kuromoji');
const Levenshtein = require('levenshtein');

const tokenizerPromise = new Promise((resolve, reject) => {
  console.log('Kuromojiの辞書を読み込んでいます...');
  kuromoji.builder({dicPath: 'node_modules/kuromoji/dict'}).build((err, tokenizer) => {
    if (err) {
      console.error('❌ Kuromojiの初期化に失敗しました:', err);
      return reject(err);
    }
    console.log('✅ Kuromojiの辞書準備が完了しました。');
    resolve(tokenizer);
  });
});

const getReading = async (text) => {
  try {
    const tokenizer = await tokenizerPromise;
    if (!tokenizer) throw new Error('Tokenizer is not available.');

    const tokens = tokenizer.tokenize(text);
    const reading = tokens.map((token) => token.reading || token.surface_form).join('');
    return reading;
  } catch (error) {
    console.error(`読み仮名への変換中にエラーが発生しました (${text}):`, error);
    return text;
  }
};

exports.analyzeBulkMembers = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {namesText} = req.body;

    if (!namesText || typeof namesText !== 'string') {
      return res.status(400).json({error: '登録する名前のテキストが必要です。'});
    }

    const inputNames = [...new Set(namesText.split(/\n|,/).map(normalizeName).filter(Boolean))];

    const membersRef = firestore.collection('groups').doc(groupId).collection('members');
    const membersSnapshot = await membersRef.get();
    const existingMembers = await Promise.all(
      membersSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          reading: await getReading(data.name),
        };
      })
    );
    const existingNames = new Set(existingMembers.map((m) => m.name));

    const analysisResults = await Promise.all(
      inputNames.map(async (inputName) => {
        if (existingNames.has(inputName)) {
          return {inputName, status: 'exact_match', matchedMember: existingMembers.find((m) => m.name === inputName)};
        }

        const inputReading = await getReading(inputName);
        const suggestions = [];

        for (const member of existingMembers) {
          const nameDistance = new Levenshtein(inputName, member.name).distance;
          const readingDistance = new Levenshtein(inputReading, member.reading).distance;

          const nameSimilarity = 1 - nameDistance / Math.max(inputName.length, member.name.length);
          const readingSimilarity = 1 - readingDistance / Math.max(inputReading.length, member.reading.length);

          if (nameSimilarity >= 0.6 || readingSimilarity >= 0.8) {
            suggestions.push({
              id: member.id,
              name: member.name,
              similarity: Math.max(nameSimilarity, readingSimilarity),
            });
          }
        }

        if (suggestions.length > 0) {
          suggestions.sort((a, b) => b.similarity - a.similarity);
          return {inputName, status: 'potential_match', suggestions};
        }

        return {inputName, status: 'new_registration'};
      })
    );

    res.status(200).json({analysisResults});
  } catch (error) {
    console.error('メンバーの一括分析中にエラー:', error);
    res.status(500).json({error: '分析処理に失敗しました。'});
  }
};

exports.finalizeBulkMembers = async (req, res) => {
  try {
    const {groupId} = req.params;
    const {resolutions} = req.body;

    if (!Array.isArray(resolutions)) {
      return res.status(400).json({error: '不正なリクエストです。'});
    }

    const groupRef = firestore.collection('groups').doc(groupId);
    const membersRef = groupRef.collection('members');

    const batch = firestore.batch();
    let createdCount = 0;

    const allMembersSnapshot = await membersRef.get();
    const existingColors = allMembersSnapshot.docs.map((d) => d.data().color);

    for (const resolution of resolutions) {
      if (resolution.action === 'create') {
        const normalized = normalizeName(resolution.inputName);
        if (!normalized) continue;

        const newColor = getNextAvailableColor(existingColors);
        existingColors.push(newColor);

        const newMemberData = {
          name: normalized,
          color: newColor,
          password: null,
          deleteToken: crypto.randomBytes(16).toString('hex'),
          iconUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(normalized)}&background=random&color=fff`,
          createdAt: new Date(),
          createdBy: 'admin-bulk',
          isActive: true,
        };

        const newMemberRef = membersRef.doc();
        batch.set(newMemberRef, newMemberData);
        createdCount++;
      }
    }

    await batch.commit();

    res.status(200).json({
      message: '一括登録が完了しました。',
      createdCount,
      skippedCount: resolutions.length - createdCount,
    });
  } catch (error) {
    console.error('メンバーの一括登録確定処理中にエラー:', error);
    res.status(500).json({error: '登録処理に失敗しました。'});
  }
};
