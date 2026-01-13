import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';

export function useTitleNotification() {
  const timeDisplays = useSelector(state => state.nekokan.timeDisplays);
  const notifiedEvents = useRef(new Set()); // 通知済みキー {Area}_{Channel}
  const originalTitle = useRef(document.title);
  const resetTimer = useRef(null);

  useEffect(() => {
    // オリジナルタイトルを保持 (NEKO-KAN 2など)
    if (!document.title.startsWith('【出現中】')) {
        originalTitle.current = document.title;
    }

    const checkNotifications = () => {
      const now = new Date();
      
      Object.entries(timeDisplays).forEach(([key, timeStr]) => {
        const [areaName, channelName] = key.split('_');
        const targetTime = new Date(now.toDateString() + ' ' + timeStr);
        const diff = targetTime - now;
        
        // 条件: 予定時刻を過ぎていて、かつ5秒以内 (-5000 < diff < 0)
        // かつ、まだ通知していない場合
        if (diff < 0 && diff > -5000 && !notifiedEvents.current.has(key)) {
            // タイトル変更
            document.title = `【出現中】${areaName} ${channelName}`;
            notifiedEvents.current.add(key);

            // 既存のタイマーがあればクリア
            if (resetTimer.current) clearTimeout(resetTimer.current);

            // 15秒後に戻す
            resetTimer.current = setTimeout(() => {
                document.title = originalTitle.current;
            }, 15000);
        }

        // 1分以上経過したら通知済みリストから削除（リセット）
        // これにより次回設定時にまた通知可能になる
        if (diff < -60000 && notifiedEvents.current.has(key)) {
            notifiedEvents.current.delete(key);
        }
      });
    };

    const interval = setInterval(checkNotifications, 1000);
    return () => {
        clearInterval(interval);
        if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [timeDisplays]);
}
