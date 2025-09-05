const {firestore} = require('../../utils/firestore');

exports.cleanupPastEvents = async (req, res) => {
  try {
    const {groupId} = req.params;
    const groupRef = firestore.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().ownerId !== req.user.id) {
      return res.status(403).json({error: '権限がありません。'});
    }

    const batch = firestore.batch();

    // 1. グループの全メンバーIDを取得
    const membersSnapshot = await groupRef.collection('members').get();
    const existingMemberIds = new Set(membersSnapshot.docs.map((doc) => doc.id));

    // 2. 開催前のイベントを取得
    const eventsSnapshot = await firestore.collection('events').where('groupId', '==', groupId).where('status', '==', 'pending').get();

    let updatedEventCount = 0;

    // 3. 各イベントの参加者をチェック
    eventsSnapshot.forEach((eventDoc) => {
      const eventData = eventDoc.data();
      const participants = eventData.participants;
      let needsUpdate = false;

      const newParticipants = participants.map((p) => {
        // 参加者情報があるが、そのメンバーがグループに存在しない場合
        if (p.memberId && !existingMemberIds.has(p.memberId)) {
          needsUpdate = true;
          // 参加情報をリセットして空き枠に戻す
          return {...p, name: null, memberId: null, iconUrl: null, color: null};
        }
        return p;
      });

      if (needsUpdate) {
        batch.update(eventDoc.ref, {participants: newParticipants});
        updatedEventCount++;
      }
    });

    await batch.commit();

    res.status(200).json({message: `${updatedEventCount}件の開催前イベントの参加者情報をクリーンアップしました。`});
  } catch (error) {
    console.error('Error cleaning up past events:', error);
    res.status(500).json({error: '過去データの修正に失敗しました。'});
  }
};
