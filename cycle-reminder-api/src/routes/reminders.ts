import { Router } from 'express';
import { db } from '../config/firebase';
import { protect, protectWrite, AuthRequest } from '../middleware/auth';

const router = Router();
const remindersCollection = db.collection('reminders');
const auditLogsCollection = db.collection('auditLogs');

// ログを記録し、30件に保つためのヘルパー関数
const addLogWithTrim = async (logData: object) => {
  await auditLogsCollection.add({
    ...logData,
    timestamp: new Date().toISOString(),
  });
  const snapshot = await auditLogsCollection.orderBy('timestamp', 'desc').get();
  if (snapshot.size > 30) {
    const oldestDoc = snapshot.docs[snapshot.docs.length - 1];
    await oldestDoc.ref.delete();
  }
};

// GET /api/reminders/:serverId - 特定サーバーのリマインダーを取得
router.get('/:serverId', protect, async (req: AuthRequest, res) => {
  try {
    const { serverId } = req.params;
    const snapshot = await remindersCollection.where('serverId', '==', serverId).get();
    const reminders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(reminders);
  } catch (error) {
    console.error("Failed to fetch reminders:", error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// POST /api/reminders/:serverId - 特定サーバーにリマインダーを作成
router.post('/:serverId', protect, protectWrite, async (req: AuthRequest, res) => {
  try {
    const { serverId } = req.params;
    const { userId, ...reminderData } = req.body;
    const newReminderData = { ...reminderData, serverId: serverId, createdBy: req.user.id };
    
    const docRef = await remindersCollection.add(newReminderData);
    const result = { id: docRef.id, ...newReminderData };

    await addLogWithTrim({
      user: req.user.username,
      action: '作成',
      reminderMessage: result.message,
      after: result,
      serverId: serverId, // ★ serverId をログに追加
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Failed to create reminder:", error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// PUT /api/reminders/:id - 特定のリマインダーを更新
router.put('/:id', protect, protectWrite, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;
    const docRef = remindersCollection.doc(id);
    const beforeSnap = await docRef.get();
    const beforeData = beforeSnap.data();

    if (!beforeData) {
      return res.status(404).json({ error: "Reminder not found." });
    }
    
    await docRef.update(updatedData);

    await addLogWithTrim({
      user: req.user.username,
      action: '更新',
      reminderMessage: updatedData.message,
      before: { id, ...beforeData },
      after: { id, ...updatedData },
      serverId: beforeData.serverId, // ★ serverId をログに追加
    });

    res.status(200).json({ id, ...updatedData });
  } catch (error) {
    console.error("Failed to update reminder:", error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// DELETE /api/reminders/:id - 特定のリマインダーを削除
router.delete('/:id', protect, protectWrite, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const docRef = remindersCollection.doc(id);
    const beforeSnap = await docRef.get();
    const beforeData = beforeSnap.data();

    if (!beforeData) {
      return res.status(404).json({ error: "Reminder not found." });
    }

    await docRef.delete();

    if (beforeData) {
      await addLogWithTrim({
        user: req.user.username,
        action: '削除',
        reminderMessage: beforeData.message,
        before: { id, ...beforeData },
        serverId: beforeData.serverId, // ★ serverId をログに追加
      });
    }
    
    res.status(200).json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error("Failed to delete reminder:", error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

export default router;