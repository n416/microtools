// alarmManager.js

let alarmQueue = [];
let isMuted = false;
let currentAlarmTimeout = null;

function playAudioSequentially(audioFiles) {
  if (audioFiles.length === 0 || isMuted) return;

  const currentAudio = new Audio(audioFiles[0]);

  // 音声の長さを取得して次の音声再生をセット
  currentAudio.onloadedmetadata = () => {
    const duration = currentAudio.duration;

    // 次の音声を0.75秒早く再生する
    if (audioFiles.length > 1) {
      setTimeout(() => {
        playAudioSequentially(audioFiles.slice(1));
      }, (duration - 0.75) * 1000);
    }

    console.log('Playing:', audioFiles[0]); // 再生中のファイルをログ出力
    currentAudio.play().catch(error => {
      console.error('Audio playback failed:', error);
    });
  };

  currentAudio.onended = () => {
    if (audioFiles.length === 1) {
      currentAlarmTimeout = null; // 全ての音声が再生し終わったら、タイマーをクリア
    }
  };
}

function scheduleAlarm(timeDifference, time, area, channel, message) {

  const alarmTime = Date.now() + timeDifference;

  const areaFileMap = {
    "テラガード": "tera",
    "トゥリア": "tori",
    "アンゲロス": "ange",
    "フォントゥナス": "fon"
  };

  const alarmEntry = {
    time: alarmTime,
    audioFiles: [
      `./mp3/${time}fungo.mp3`,
      `./mp3/${areaFileMap[area]}.mp3`,
      `./mp3/${channel}.mp3`,
      `./mp3/${message}.mp3`
    ]
  };

  alarmQueue.push(alarmEntry);
  processAlarms();
}

function processAlarms() {
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
    playAudioSequentially(nextAlarm.audioFiles); // アラーム音を再生
    processAlarms(); // 次のアラームを処理するため再帰的に関数を呼び出す
  } else {
    // アラームの時間がまだ来ていない場合、その時間までタイムアウトを設定
    currentAlarmTimeout = setTimeout(() => {
      alarmQueue.shift(); // アラームをキューから削除
      playAudioSequentially(nextAlarm.audioFiles); // 指定の時間が来たらアラーム音を再生
      currentAlarmTimeout = null; // タイムアウトが完了したのでリセット
      processAlarms(); // 次のアラームを処理するため再帰的に関数を呼び出す
    }, nextAlarm.time - now); // 今からアラーム時間までの待機時間を指定
  }
}


function clearAlarms() {
  if (currentAlarmTimeout) {
    clearTimeout(currentAlarmTimeout);
    currentAlarmTimeout = null;
  }
  alarmQueue = [];
}

function muteAlarms() {
  isMuted = true;
  clearAlarms();
}

function unmuteAlarms() {
  isMuted = false;
  processAlarms();
}

export { scheduleAlarm, muteAlarms, unmuteAlarms };
