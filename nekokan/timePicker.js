// timePicker.js

import { updateNoteCard } from './ui.js';
import { saveTimeDisplays, loadTimeDisplays, loadDisabledChannels, saveDisabledChannels } from './storage.js';
import { scheduleAlarm, muteAlarms, unmuteAlarms } from './alarmManager.js';
import { addLogEntry, getTimeDisplays, setTimeDisplays, addLogAndTimeEntry } from './events.js';  // events.jsからインポート

export function initializeTimePicker() {
  const timePickerModal = document.getElementById('timePickerModal');
  const timePickerOkButton = document.getElementById('timePickerOkButton');
  const timePickerClearButton = document.getElementById('timePickerClearButton'); // クリアボタンを取得
  const timeInput = document.getElementById('timeInput');
  const hourHand = document.querySelector('.hour-hand');
  const minuteHand = document.querySelector('.minute-hand');
  const muteAlarmCheckbox = document.getElementById('muteAlarm');

  let selectedChannelLabel = null;

  // disabledChannelsをローカルストレージから取得
  let disabledChannels = JSON.parse(localStorage.getItem('disabledChannels')) || {};

  const areaNameMap = {
    'トゥリア': 'Turia',
    'テラガード': 'Terraguard',
    'アンゲロス': 'Angelos',
    'フォントゥナス': 'Fontunas'
  };
  const channelNameMap = {
    'ch1': 'Ch1',
    'ch2': 'Ch2',
    'ch3': 'Ch3',
    'ch4': 'Ch4',
    'ch5': 'Ch5',
    'PVP': 'PVP' // PVPはそのまま
  };

  timePickerOkButton.addEventListener('click', () => {
    const timeDisplays = getTimeDisplays();  // events.jsのgetTimeDisplays()を呼び出して、現在のtimeDisplaysを取得
    if (!selectedChannelLabel) return;

    const channelName = selectedChannelLabel.childNodes[0].nodeValue.trim();
    const areaName = selectedChannelLabel.closest('.area-tile').querySelector('.area-title').textContent.replace('（時刻順）', '');

    // タイムピッカーから取得した時間
    const [inputHours, inputMinutes] = timeInput.value.trim().split(':').map(Number);
    let entryTime = new Date();
    entryTime.setHours(inputHours);
    entryTime.setMinutes(inputMinutes);
    entryTime.setSeconds(0); // 秒を0に設定

    const newTimeStr = entryTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // ログと時刻を保存する共通関数を呼び出し
    addLogAndTimeEntry(areaName, channelName, entryTime, newTimeStr);

    // 時刻表示の更新
    let timeDisplay = selectedChannelLabel.querySelector('.time-display');
    if (!timeDisplay) {
      timeDisplay = document.createElement('div');
      timeDisplay.className = 'time-display';
      selectedChannelLabel.appendChild(timeDisplay);
    }
    timeDisplay.innerHTML = `<i class="far fa-clock"></i>&nbsp;${newTimeStr.substring(0, 5)}`;

    // 状態の保存
    const key = `${areaName}_${channelName}`;
    timeDisplays[key] = newTimeStr;
    saveTimeDisplays(timeDisplays);

    // ノートカードを更新
    updateNoteCard();

    // アラームのスケジュール設定
    const alarmTimes = [1, 3, 5]; // アラームの時間（1分前、3分前、5分前）
    alarmTimes.forEach(alarmTime => {
      if (document.getElementById(`alarm${alarmTime}min`).checked) {
        const alarmScheduleTime = new Date(entryTime.getTime() - alarmTime * 60000);
        const timeDifference = alarmScheduleTime.getTime() - new Date().getTime();
        if (timeDifference > 0) {
          console.log(`アラーム設定: ${alarmTime}分前`);
          scheduleAlarm(timeDifference, alarmTime, areaName, channelName, 'syutugen');
        }
      }
    });
    // モーダルを閉じる
    timePickerModal.style.display = 'none';
  });


  // クリアボタンの処理
  timePickerClearButton.addEventListener('click', () => {
    const timeDisplays = getTimeDisplays();  // events.jsから取得

    if (!selectedChannelLabel) return;

    const channelName = selectedChannelLabel.childNodes[0].nodeValue.trim();
    const areaName = selectedChannelLabel.closest('.area-tile').querySelector('.area-title').textContent.replace('（時刻順）', '');
    const key = `${areaName}_${channelName}`;

    // 表示と保存された時刻をクリア
    let timeDisplay = selectedChannelLabel.querySelector('.time-display');
    if (timeDisplay) {
      selectedChannelLabel.removeChild(timeDisplay);
    }
    delete timeDisplays[key]; // ローカルストレージからも削除
    setTimeDisplays(timeDisplays);

    timePickerModal.style.display = 'none';
    updateNoteCard();
  });

  // 「チャンネル無し」ボタンの処理
  channelToggleButton.addEventListener('click', () => {
    const disabledChannels = loadDisabledChannels();  // ローカルストレージから読み込み

    if (!selectedChannelLabel) return;

    const channelName = selectedChannelLabel.childNodes[0].nodeValue.trim();
    const areaName = selectedChannelLabel.closest('.area-tile').querySelector('.area-title').textContent.replace('（時刻順）', '');

    const mappedChannelName = channelNameMap[channelName] || channelName;
    const englishAreaName = areaNameMap[areaName] || areaName;
    const key = `${englishAreaName}_${mappedChannelName}`;
    const logButton = document.querySelector(`#logButton${englishAreaName}${mappedChannelName}`);

    if (logButton) {
      if (disabledChannels[key]) {
        delete disabledChannels[key];  // チャンネル有りに戻す
        logButton.disabled = false;
        logButton.classList.remove('disabled-log-btn');
      } else {
        disabledChannels[key] = true;  // チャンネル無しにする
        logButton.disabled = true;
        logButton.classList.add('disabled-log-btn');
      }

      saveDisabledChannels(disabledChannels);  // ローカルストレージに保存
    }
    timePickerModal.style.display = 'none';
  });

  // ログラベルがクリックされたときの処理
  document.querySelectorAll('.log-label').forEach(label => {
    label.addEventListener('click', () => {
      selectedChannelLabel = label;
      const channelName = selectedChannelLabel.childNodes[0].nodeValue.trim();
      const areaName = selectedChannelLabel.closest('.area-tile').querySelector('.area-title').textContent.replace('（時刻順）', '');

      // チャンネル名とエリア名をマップで変換
      const mappedChannelName = channelNameMap[channelName] || channelName;
      const englishAreaName = areaNameMap[areaName] || areaName;
      const key = `${englishAreaName}_${mappedChannelName}`;

      disabledChannels = loadDisabledChannels();

      // チャンネル無し状態かどうかを確認してボタンのキャプションを変更
      if (disabledChannels[key]) {
        channelToggleButton.textContent = 'ボタンを有効にする';
      } else {
        channelToggleButton.textContent = 'ボタンを無効にする';
      }

      const timeDisplay = selectedChannelLabel.querySelector('.time-display');

      if (timeDisplay) {
        timeInput.value = timeDisplay.textContent.trim().replace('<i class="fal fa-clock"></i>', '').trim();
      } else {
        const currentTime = new Date();
        const hours = String(currentTime.getHours()).padStart(2, '0');
        const minutes = String(currentTime.getMinutes()).padStart(2, '0');
        timeInput.value = `${hours}:${minutes}`;
      }

      updateClockHands(timeInput.value);
      timePickerModal.style.display = 'flex';
    });
  });

  // 時間入力が変わったときに時計の針を更新
  timeInput.addEventListener('input', () => {
    updateClockHands(timeInput.value);
  });

  // 鳴らさないチェックボックスの処理
  muteAlarmCheckbox.addEventListener('change', () => {
    const alarmCheckboxes = document.querySelectorAll('#alarm1min, #alarm3min, #alarm5min');
    const isDisabled = muteAlarmCheckbox.checked;

    if (isDisabled) {
      muteAlarms();
      alarmCheckboxes.forEach(cb => cb.disabled = true);
    } else {
      unmuteAlarms();
      alarmCheckboxes.forEach(cb => cb.disabled = false);
    }
  });

  // 時計の針を更新する関数
  function updateClockHands(time) {
    const [hours, minutes] = time.split(':').map(Number);
    const hoursDegree = ((hours % 12) / 12) * 360 + (minutes / 60) * 30 - 90;
    const minutesDegree = (minutes / 60) * 360 - 90;

    // 要素が存在する場合にのみスタイルを設定
    if (hourHand && minuteHand) {
      hourHand.style.transform = `rotate(${hoursDegree}deg)`;
      minuteHand.style.transform = `rotate(${minutesDegree}deg)`;
    }
  }
}
