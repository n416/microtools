import { updateNoteCard, showToast, updateTimeDisplay, collectAndSortLogEntries } from './ui.js';
import { saveLogs, loadLogs, saveTimeDisplays, loadTimeDisplays, generateShareableUrl, loadFromUrlParams } from './storage.js';
import { initializeTimePicker } from './timePicker.js';
// グローバルに actionHistory を定義
let actionHistory = [];
let redoHistory = [];
let logs;

export function initializeEventListeners() {
  actionHistory = [];
  logs = loadLogs();
  timeDisplays = loadTimeDisplays();

  const confirmButton = document.getElementById('confirmButton');
  const backButton = document.getElementById('backButton');
  const saveButton = document.getElementById('saveButton');
  const copyButton = document.getElementById('copyButton');
  const clearButton = document.getElementById('clearButton');
  const undoButton = document.getElementById('undoButton');
  const redoButton = document.getElementById('redoButton');
  const confirmModalCloseButton = document.getElementById('confirmModalCloseButton');
  const confirmYesButton = document.getElementById('confirmYesButton');
  const confirmNoButton = document.getElementById('confirmNoButton');
  const modalCloseButton = document.getElementById('modalCloseButton');
  const logTextarea = document.getElementById('logTextarea');
  const toast = document.getElementById('toast');
  const resetButton = document.getElementById('resetButton');
  const timePickerModal = document.getElementById('timePickerModal');
  const shareButton = document.getElementById('shareButton');

  logTextarea.value = logs.length > 0 ? logs.join('\n') : logTextarea.value;

  const logButtons = document.querySelectorAll('.log-btn');
  logButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const currentTime = new Date();
      const futureTime = new Date(currentTime.getTime() + 60 * 60 * 1000); // 1時間後
      const futureTimeStr = futureTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const logRow = button.closest('.log-row');
      const logLabel = logRow.querySelector('.log-label');
      const channelName = logLabel.childNodes[0].nodeValue.trim();
      const areaTitle = button.closest('.area-tile').querySelector('.area-title').textContent.replace('（時刻順）', '');

      // ログと時刻を保存する共通関数を呼び出し
      addLogAndTimeEntry(areaTitle, channelName, currentTime, futureTimeStr);

      // ボタンの表示を変更
      button.innerHTML = '!<i class="fas fa-skull-crossbones"></i>';

      // 時刻表示の更新
      let timeDisplay = logLabel.querySelector('.time-display');
      if (!timeDisplay) {
        timeDisplay = document.createElement('div');
        timeDisplay.className = 'time-display';
        logLabel.appendChild(timeDisplay);
      }
      timeDisplay.innerHTML = `<i class="far fa-clock"></i>&nbsp;${futureTimeStr.substring(0, 5)}`;

      // 状態の保存
      const key = `${areaTitle}_${channelName}`;
      timeDisplays[key] = futureTimeStr;
      saveTimeDisplays(timeDisplays);

      // アラームのスケジュール設定
      const alarmTimes = [1, 3, 5]; // アラームの時間（1分前、3分前、5分前）
      alarmTimes.forEach(alarmTime => {
        if (document.getElementById(`alarm${alarmTime}min`).checked) {
          const alarmScheduleTime = new Date(futureTime.getTime() - alarmTime * 60000);
          const timeDifference = alarmScheduleTime.getTime() - currentTime.getTime();
          if (timeDifference > 0) {
            console.log(`アラーム設定: ${alarmTime}分前`);
            scheduleAlarm(timeDifference, alarmTime, areaTitle, channelName, 'syutugen');
          }
        }
      });
      addLogAndTimeEntry
      updateNoteCard();
    });

    // マウスオーバーで表示を変更
    button.addEventListener('mouseover', () => {
      if (button.innerHTML === '<i class="fas fa-cat"></i>') {
        button.innerHTML = '<i class="fas fa-skull-crossbones"></i>';
      }
    });

    // マウスアウトで元に戻す
    button.addEventListener('mouseout', () => {
      if (button.innerHTML === '!<i class="fas fa-skull-crossbones"></i>') return;
      if (button.innerHTML === '<i class="fas fa-skull-crossbones"></i>') {
        button.innerHTML = '<i class="fas fa-cat"></i>';
      }
    });
  });

  // ページロード時に保存された時刻表示を復元
  document.querySelectorAll('.log-label').forEach(label => {
    const channelName = label.childNodes[0].nodeValue.trim();
    const areaName = label.closest('.area-tile').querySelector('.area-title').textContent.replace('（時刻順）', '');
    const key = `${areaName}_${channelName}`;

    if (timeDisplays[key]) {
      let timeDisplay = label.querySelector('.time-display');
      if (!timeDisplay) {
        timeDisplay = document.createElement('div');
        timeDisplay.className = 'time-display';
        label.appendChild(timeDisplay);
      }
      timeDisplay.innerHTML = `<i class="far fa-clock"></i>&nbsp;${timeDisplays[key].substring(0, 5)}`; // 表示上は時：分のみ
    }
  });

  // リセットボタンの機能
  resetButton.addEventListener('click', () => {
    if (confirm('すべてのデータをリセットしますか？')) {
      localStorage.clear();
      location.reload();
    }
  });

  // undoボタンの機能
  undoButton.addEventListener('click', () => {
    if (actionHistory.length > 0) {
      // 直前の状態を取得
      const previousState = actionHistory.pop();

      // リドゥ用に現在の状態を保存
      redoHistory.push({
        logs: [...logs],
        timeDisplays: { ...timeDisplays }
      });

      logs = previousState.logs;  // ログを元に戻す
      timeDisplays = previousState.timeDisplays;  // 時刻表示を元に戻す

      // logTextareaを復元
      logTextarea.value = logs.join('\n');  // ログテキストエリアに表示

      // ローカルストレージに復元した状態を保存
      saveLogs(logs);
      saveTimeDisplays(timeDisplays);

      // 時刻表示をリセットして再描画
      document.querySelectorAll('.time-display').forEach(display => display.remove());

      // 時刻ラベルを更新
      updateTimeDisplay();

      // ノートカードを更新
      updateNoteCard();
    } else {
      showToast('戻る操作はできません');
    }
  });

  // redoボタンの機能
  redoButton.addEventListener('click', () => {
    if (redoHistory.length > 0) {
      // 直前のリドゥ状態を取得
      const redoState = redoHistory.pop();
  
      // アンドゥ用に現在の状態を保存
      actionHistory.push({
        logs: [...logs],
        timeDisplays: { ...timeDisplays }
      });
  
      // リドゥ状態に復元
      logs = redoState.logs;
      timeDisplays = redoState.timeDisplays;
  
      // logTextareaを復元
      logTextarea.value = logs.join('\n');
  
      // ローカルストレージに復元した状態を保存
      saveLogs(logs);
      saveTimeDisplays(timeDisplays);
  
      // 時刻表示をリセットして再描画
      document.querySelectorAll('.time-display').forEach(display => display.remove());
  
      // 時刻ラベルを更新
      updateTimeDisplay();
  
      // ノートカードを更新
      updateNoteCard();
    } else {
      showToast('進む操作はできません');
    }
  });

  // シェアボタンの機能
  shareButton.addEventListener('click', async () => {
    const shareUrl = generateShareableUrl();  // storage.jsからURLを生成

    try {
      await navigator.share(
        {
          title: 'ネコシェア',
          url: shareUrl
        });
    } catch (error) {
      console.error(error);
    }
    showToast("シェアします");  // ui.jsのトースト表示
  });

  confirmButton.addEventListener('click', () => {
    switchScreen('logScreen');
    confirmButton.style.display = 'none';
    backButton.style.display = 'block';
  });

  backButton.addEventListener('click', () => {
    switchScreen('mainScreen');
    confirmButton.style.display = 'block';
    backButton.style.display = 'none';
  });

  saveButton.addEventListener('click', () => {
    logs = logTextarea.value.split('\n');
    saveLogs(logs);
    showToast('ログを保存しました');
  });

  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(logTextarea.value);
    showToast('クリップボードにコピーしました');
  });

  clearButton.addEventListener('click', () => {
    showConfirmModal();
  });

  confirmModalCloseButton.addEventListener('click', closeConfirmModal);
  confirmNoButton.addEventListener('click', closeConfirmModal);

  confirmYesButton.addEventListener('click', () => {
    logs = [];
    logTextarea.value = '';
    localStorage.removeItem('logs');
    closeConfirmModal();
    showToast('ログをクリアしました');
  });

  modalCloseButton.addEventListener('click', closeModal);
  timePickerModal.addEventListener('click', (e) => {
    if (e.target === timePickerModal) {
      timePickerModal.style.display = 'none';
    }
  });

  toast.addEventListener('click', () => {
    toast.className = 'toast';
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeConfirmModal();
    }

    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undoButton.click();
    }

    if (e.ctrlKey && e.key === 'y') {
      e.preventDefault();
      redoButton.click();
    }

  });

  initializeTimePicker();
}

function pushToActionHistory(logs, timeDisplays) {
  actionHistory.push({
    logs: [...logs],  // 現在のログをコピーして保存
    timeDisplays: { ...timeDisplays }  // 現在の時刻表示をコピーして保存
  });
}


export function popActionHistory() {
  return actionHistory.length > 0 ? actionHistory.pop() : null;
}

export function getLogs() {
  return logs;
}

export function setLogs(newLogs) {
  logs = newLogs;
  saveLogs(logs);  // ローカルストレージに保存
}


// グローバルではなく、getter/setterで管理
let timeDisplays = loadTimeDisplays();
export function getTimeDisplays() {
  return timeDisplays;
}
export function setTimeDisplays(newTimeDisplays) {
  timeDisplays = newTimeDisplays;
  saveTimeDisplays(timeDisplays);  // ローカルストレージに保存
}

function switchScreen(screenId) {
  const currentScreen = document.querySelector('.screen:not([style*="display: none"])');
  if (currentScreen) {
    currentScreen.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => {
      currentScreen.style.display = 'none';
      const nextScreen = document.getElementById(screenId);
      nextScreen.style.display = 'flex';
      nextScreen.style.animation = 'fadeIn 0.3s forwards';
    }, 300);
  }
}

function showConfirmModal() {
  const confirmModal = document.getElementById('confirmModal');
  confirmModal.style.display = 'flex';
  confirmModal.style.animation = 'modalFadeInBackground 0.3s forwards';
  document.querySelector('#confirmModal .modal-content').style.animation = 'modalContentFadeIn 0.3s forwards';
}

function closeConfirmModal() {
  const confirmModal = document.getElementById('confirmModal');
  confirmModal.style.display = 'none';
}

function closeModal() {
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.style.display = 'none'; // 各モーダルを閉じる
  });
}

// 共通のログ整形と追加処理
export function addLogEntry(areaTitle, channelName, logTime) {
  logs = loadLogs();  // 現在のログを取得
  const currentTimeStr = logTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const padFullWidth = (str, length) => {
    let fullWidthSpace = '　'; // 全角スペース
    let currentLength = [...str].reduce((sum, char) => sum + (char.match(/[^\x00-\x7F]/) ? 2 : 1), 0);
    let spacesToAdd = (length - currentLength) / 2;

    if (spacesToAdd > 0) {
      return str + fullWidthSpace.repeat(Math.max(0, spacesToAdd));
    } else {
      return str;
    }
  };

  const maxAreaLength = 15;
  const maxChannelLength = 2;

  const paddedAreaTitle = padFullWidth(areaTitle, maxAreaLength);
  const paddedChannelName = padFullWidth(channelName, maxChannelLength);

  // 整形したログエントリ
  const logEntry = `${paddedAreaTitle} ${paddedChannelName} ${currentTimeStr.substring(0, 5)}`;
  logs.push(logEntry);

  // 既存の内容に新しいログを追加して表示
  const logTextarea = document.getElementById('logTextarea');
  logTextarea.value = logs.join('\n');  // ここで、すべてのログを連結して表示

  // ログを保存
  saveLogs(logs);

  showToast(`${areaTitle} ${channelName}のログを追加しました`);
}

// 共通関数: ログと時刻を追加・保存
export function addLogAndTimeEntry(areaTitle, channelName, logTime, futureTime) {
  // 新しい操作が発生したのでリドゥ履歴をクリア
  redoHistory = [];

  // 状態の保存は更新前に行う
  pushToActionHistory(logs, timeDisplays);

  // ログを追加
  addLogEntry(areaTitle, channelName, logTime);

  // 時刻表示を更新
  const key = `${areaTitle}_${channelName}`;
  timeDisplays[key] = futureTime;
  saveTimeDisplays(timeDisplays);

  // ここで時刻を表示する部分を修正
  const labels = document.querySelectorAll('.log-label');
  labels.forEach(label => {
    const currentChannelName = label.childNodes[0].nodeValue.trim();
    const currentAreaName = label.closest('.area-tile').querySelector('.area-title').textContent.replace('（時刻順）', '').trim();  // エリア名を取得

    // エリア名とチャンネル名の両方が一致する場合のみ更新
    if (currentChannelName === channelName && currentAreaName === areaTitle) {
      let timeDisplay = label.querySelector('.time-display');
      if (!timeDisplay) {
        timeDisplay = document.createElement('div');
        timeDisplay.className = 'time-display';
        label.appendChild(timeDisplay);
      }
      timeDisplay.innerHTML = `<i class="far fa-clock"></i>&nbsp;${futureTime.substring(0, 5)}`;
    }
  });

}
document.getElementById('shareButton').addEventListener('click', () => {
  const shareUrl = generateShareableUrl();  // ローカルストレージからURLを生成
  navigator.clipboard.writeText(shareUrl).then(() => {
    showToast("URLをクリップボードに保存しました");
  }).catch(err => {
    console.error('Failed to copy URL: ', err);
  });
});

document.getElementById('toggleTimeDisplay').addEventListener('click', () => {
  const checkboxIcon = document.getElementById('checkboxIcon');
  
  if (checkboxIcon.classList.contains('fa-square')) {
    checkboxIcon.classList.remove('fa-square');
    checkboxIcon.classList.add('fa-square-check');
  } else {
    checkboxIcon.classList.remove('fa-square-check');
    checkboxIcon.classList.add('fa-square');
  }

  // ノートカードを更新
  updateNoteCard();
});