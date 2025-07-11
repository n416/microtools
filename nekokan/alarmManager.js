// alarmManager.js
import {loadTimeDisplays} from './storage.js'; // ★ インポートを追加

let alarmQueue = [];
let isMuted = false;
let currentAlarmTimeout = null;
// alarmManager.js

function playAudioSequentially(audioFiles, onFinishedCallback) {
  // 再生するファイルがない、またはミュートされている場合は処理を終了
  if (audioFiles.length === 0 || isMuted) {
    if (currentAlarmTimeout) {
      currentAlarmTimeout = null;
    }
    if (onFinishedCallback) onFinishedCallback(); // ★ 再生が終了したのでコールバックを呼ぶ
    return;
  }

  const overlapSeconds = 0.6;
  const currentAudio = new Audio(audioFiles[0]);

  currentAudio.onloadedmetadata = () => {
    // 次の音声がある場合
    if (audioFiles.length > 1) {
      const duration = currentAudio.duration;
      const timeout = (duration - overlapSeconds) * 1000;

      setTimeout(() => {
        // ★ 再帰呼び出しにもコールバックを渡す
        playAudioSequentially(audioFiles.slice(1), onFinishedCallback);
      }, Math.max(timeout, 50));
    } else {
      // ★ これが最後の音声の場合、再生後にコールバックを呼ぶタイマーをセット
      const duration = currentAudio.duration;
      setTimeout(() => {
        if (onFinishedCallback) onFinishedCallback();
      }, duration * 1000);
    }
  };

  // onendedは、最後の音声が終了したことを検知するためだけに使用
  currentAudio.onended = () => {
    if (audioFiles.length <= 1 && currentAlarmTimeout) {
      currentAlarmTimeout = null;
    }
  };

  // 音声の再生を開始
  console.log('Playing:', audioFiles[0]);
  currentAudio.play().catch((error) => {
    console.error('Audio playback failed:', error);
    // エラーが起きても、次の音声の再生を試みる
    if (audioFiles.length > 1) {
      playAudioSequentially(audioFiles.slice(1));
    }
  });
}

function scheduleAlarm(timeDifference, time, area, channel, message) {
  const alarmTime = Date.now() + timeDifference;

  const areaFileMap = {
    テラガード: 'tera',
    トゥリア: 'tori',
    アンゲロス: 'ange',
    フォントゥナス: 'fon',
    モンベラ: 'monbe',
  };

  const alarmEntry = {
    time: alarmTime,
    audioFiles: [
      `./mp3/${time}fungo.mp3`,
      `./mp3/${areaFileMap[area]}.mp3`,
      `./mp3/${channel}.mp3`,
      `./mp3/${message}.mp3`,
    ],
  };

  alarmQueue.push(alarmEntry);
}

function processAlarms() {
  // ★★★ ここから下を追記 ★★★
  // キューに処理すべきアラームがなければ、関数を終了する
  if (alarmQueue.length === 0) {
    return;
  }
  // ★★★ 追記はここまで ★★★

  // 現在アラームタイムアウトが設定されているか、キューが空なら何もしないで終了
  //if (currentAlarmTimeout || alarmQueue.length === 0) return;

  // 現在の時刻を取得（ミリ秒単位）
  const now = new Date().getTime();

  // アラームキューを、アラームの時間に基づいて昇順にソート
  alarmQueue.sort((a, b) => a.time - b.time);

  // 最も早いアラームをキューから確認
  const nextAlarm = alarmQueue[0];

  // もしアラームの時間が現在の時刻よりも過去または同じなら、すぐにアラームを鳴らす
  if (nextAlarm.time <= now) {
    alarmQueue.shift(); // アラームをキューから削除
    playAudioSequentially(nextAlarm.audioFiles, processAlarms);
  } else {
    // アラームの時間がまだ来ていない場合、その時間までタイムアウトを設定
    currentAlarmTimeout = setTimeout(() => {
      alarmQueue.shift(); // アラームをキューから削除
      currentAlarmTimeout = null; // タイムアウトが完了したのでリセット
      // 再生完了後に processAlarms を呼び出すよう、コールバックとして渡す
      playAudioSequentially(nextAlarm.audioFiles, processAlarms);
    }, nextAlarm.time - now); // 今からアラーム時間までの待機時間を指定
  }
}

function muteAlarms() {
  isMuted = true;
  clearAlarms();
}

function unmuteAlarms() {
  isMuted = false;
  processAlarms();
}

function clearAlarms() {
  if (currentAlarmTimeout) {
    clearTimeout(currentAlarmTimeout);
    currentAlarmTimeout = null;
  }
  alarmQueue = [];
}

// 全てのアラームを再スケジュールする関数
function rescheduleAllAlarms() {
  clearAlarms(); // 既存の予約をすべてクリア

  const timeDisplays = loadTimeDisplays();
  const alarmCheckboxes = [1, 3, 5];
  const now = new Date();

  // 現在有効なすべての時刻ログをループ
  for (const key in timeDisplays) {
    const [areaName, channelName] = key.split('_');
    const entryTime = new Date(now.toDateString() + ' ' + timeDisplays[key]);

    // 未来の予定のみを対象
    if (entryTime > now) {
      // チェックされているアラームを登録
      alarmCheckboxes.forEach((alarmTime) => {
        if (document.getElementById(`alarm${alarmTime}min`).checked) {
          const alarmScheduleTime = new Date(
            entryTime.getTime() - alarmTime * 60000
          );
          const timeDifference = alarmScheduleTime.getTime() - now.getTime();
          if (timeDifference > 0) {
            scheduleAlarm(
              timeDifference,
              alarmTime,
              areaName,
              channelName,
              'syutugen'
            );
          }
        }
      });
    }
  }
  // ★★★ ループが完全に終了した後、この1行を追加 ★★★
  processAlarms();
}

export {scheduleAlarm, muteAlarms, unmuteAlarms, rescheduleAllAlarms};
