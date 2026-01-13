import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

// マッピング
const areaFileMap = {
  'テラガード': 'tera',
  'トゥリア': 'tori',
  'アンゲロス': 'ange',
  'フォントゥナス': 'fon',
  'モンベラ': 'monbe',
  'アバドン': 'abaddon', // 仮
};

export function useAudioAlarm() {
  const timeDisplays = useSelector(state => state.nekokan.timeDisplays);
  const alarmSettings = useSelector(state => state.nekokan.alarmSettings);
  
  const [alarmQueue, setAlarmQueue] = useState([]);
  const processingRef = useRef(false);
  const timeoutRef = useRef(null);

  // 定期的に時間をチェックしてキューに追加
  useEffect(() => {
    const checkAlarms = () => {
      if (alarmSettings.muted) return;

      const now = new Date();
      const checkPoints = [];
      if (alarmSettings.alarm1min) checkPoints.push(1);
      if (alarmSettings.alarm3min) checkPoints.push(3);
      if (alarmSettings.alarm5min) checkPoints.push(5);

      if (checkPoints.length === 0) return;

      Object.entries(timeDisplays).forEach(([key, timeStr]) => {
        const [areaName, channelName] = key.split('_');
        const targetTime = new Date(now.toDateString() + ' ' + timeStr);
        
        // 過去の予定は無視
        if (targetTime <= now) return;

        checkPoints.forEach(min => {
          const alertTime = new Date(targetTime.getTime() - min * 60000);
          const diff = alertTime.getTime() - now.getTime();
          
          // ちょうど良いタイミング（例えば誤差1秒以内）でキューに入れる
          // Reactのレンダリングサイクルを考慮し、幅を持たせて重複チェックする実装が理想だが、
          // 簡易的に「diffが0〜1000ms」の場合に発火とみなす
          if (diff >= 0 && diff < 1100) {
             const audioFiles = [
               `./mp3/${min}fungo.mp3`,
               `./mp3/${areaFileMap[areaName] || 'tera'}.mp3`, // デフォルト処理
               `./mp3/${channelName}.mp3`,
               `./mp3/syutugen.mp3`
             ];
             
             setAlarmQueue(prev => {
                // 重複防止（簡易）: 同じファイル構成がキューの末尾にあれば追加しない
                if (prev.length > 0 && JSON.stringify(prev[prev.length-1]) === JSON.stringify(audioFiles)) {
                    return prev;
                }
                return [...prev, audioFiles];
             });
          }
        });
      });
    };

    const interval = setInterval(checkAlarms, 1000);
    return () => clearInterval(interval);
  }, [timeDisplays, alarmSettings]);

  // キューの処理（順次再生）
  useEffect(() => {
    if (alarmQueue.length === 0 || processingRef.current) return;

    const playNextSequence = async () => {
      processingRef.current = true;
      const currentSequence = alarmQueue[0];
      
      // 再生関数
      const playFile = (file) => new Promise((resolve) => {
        const audio = new Audio(file);
        audio.onended = resolve;
        audio.onerror = resolve; // エラーでも次へ
        // オーバーラップ処理は複雑になるため、単純な順次再生で実装
        audio.play().catch(e => {
            console.error("Play error", e);
            resolve();
        });
      });

      for (const file of currentSequence) {
        await playFile(file);
      }

      // 処理完了
      setAlarmQueue(prev => prev.slice(1));
      processingRef.current = false;
    };

    playNextSequence();
  }, [alarmQueue]);
}
