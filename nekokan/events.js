import {
  updateNoteCard,
  showToast,
  updateTimeDisplay,
  updateAreaCount,
} from './ui.js';
import {
  saveLogs,
  loadLogs,
  saveTimeDisplays,
  loadTimeDisplays,
  generateShareableUrl,
  loadFromUrlParams,
  loadSecondsDisplayState,
  saveSecondsDisplayState,
  saveDefaultChannelCount,
  loadDefaultChannelCount,
  saveHideTimeState,
  loadHideTimeState,
  saveAlarmCheckboxesState,
  loadAlarmCheckboxesState,
} from './storage.js';
import {rescheduleAllAlarms} from './alarmManager.js';
import {initializeTimePicker} from './timePicker.js';

// グローバルに actionHistory を定義
let actionHistory = [];
let redoHistory = [];
let logs;

export function initializeEventListeners() {
  actionHistory = [];
  logs = loadLogs();
  timeDisplays = loadTimeDisplays();

  // 「時刻非表示」チェックボックスの状態を復元
  const hideTimeCheckbox = document.getElementById('checkboxIcon');
  if (loadHideTimeState()) {
    hideTimeCheckbox.classList.remove('fa-square');
    hideTimeCheckbox.classList.add('fa-square-check');
  }
  const confirmButton = document.getElementById('confirmButton');
  const backButton = document.getElementById('backButton');
  const saveButton = document.getElementById('saveButton');
  const copyButton = document.getElementById('copyButton');
  const clearButton = document.getElementById('clearButton');
  const undoButton = document.getElementById('undoButton');
  const redoButton = document.getElementById('redoButton');
  const confirmModalCloseButton = document.getElementById(
    'confirmModalCloseButton'
  );
  const confirmYesButton = document.getElementById('confirmYesButton');
  const confirmNoButton = document.getElementById('confirmNoButton');
  const modalCloseButton = document.getElementById('modalCloseButton');
  const logTextarea = document.getElementById('logTextarea');
  const toast = document.getElementById('toast');
  const resetButton = document.getElementById('resetButton');
  const timePickerModal = document.getElementById('timePickerModal');
  const shareButton = document.getElementById('shareButton');
  // 上記の代わりにこのコードを貼り付け
  const toggleSecondsBtn = document.getElementById('toggleSecondsDisplay');
  const secondsIcon = document.getElementById('secondsCheckboxIcon');
  const titleElement = document.querySelector('.title');
  const defaultChannelModal = document.getElementById(
    'defaultChannelSettingsModal'
  );
  const defaultChannelCountInput = document.getElementById(
    'defaultChannelCountInput'
  );
  const defaultChannelOkButton = document.getElementById(
    'defaultChannelCountOkButton'
  );
  const defaultChannelCloseButton = document.getElementById(
    'defaultChannelSettingsModalCloseButton'
  );

  // タイトルクリックでモーダルを開く
  titleElement.addEventListener('click', () => {
    // 現在のデフォルト値を読み込んで入力欄に表示
    defaultChannelCountInput.value = loadDefaultChannelCount();
    defaultChannelModal.style.display = 'flex';
  });

  // OKボタンの処理
  defaultChannelOkButton.addEventListener('click', () => {
    const newCount = parseInt(defaultChannelCountInput.value, 10);
    // 1～6の範囲内かチェック
    if (newCount >= 1 && newCount <= 6) {
      saveDefaultChannelCount(newCount); // 新しいデフォルト値を保存
      updateAreaCount(); // 全エリアの表示を更新
      defaultChannelModal.style.display = 'none'; // モーダルを閉じる
      showToast(`デフォルトチャンネル数を ${newCount} に設定しました`);
    } else {
      showToast('1から6の数値を入力してください');
    }
  });

  // 閉じるボタンの処理
  defaultChannelCloseButton.addEventListener('click', () => {
    defaultChannelModal.style.display = 'none';
  });

  // モーダル外のクリックで閉じる処理
  defaultChannelModal.addEventListener('click', (event) => {
    if (event.target === defaultChannelModal) {
      defaultChannelModal.style.display = 'none';
    }
  });
  // ページの読み込み時に、保存された状態に応じてアイコンを復元
  if (loadSecondsDisplayState()) {
    secondsIcon.classList.remove('fa-square');
    secondsIcon.classList.add('fa-square-check');
  }

  // ボタンがクリックされたときの処理
  toggleSecondsBtn.addEventListener('click', () => {
    // 'fa-square-check' クラスの有無を切り替え、その結果（クラスが追加されたか否か）を取得
    const isChecked = secondsIcon.classList.toggle('fa-square-check');
    // 'fa-square' クラスは 'fa-square-check' と逆の状態にする
    secondsIcon.classList.toggle('fa-square', !isChecked);

    // 新しい状態を保存し、ノートカードを更新
    saveSecondsDisplayState(isChecked);
    updateNoteCard();
  });
  logTextarea.value = logs.length > 0 ? logs.join('\n') : logTextarea.value;

  const logButtons = document.querySelectorAll('.log-btn');
  logButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const currentTime = new Date();
      const futureTime = new Date(currentTime.getTime() + 60 * 60 * 1000); // 1時間後
      const futureTimeStr = futureTime.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const logRow = button.closest('.log-row');
      const logLabel = logRow.querySelector('.log-label');
      const channelName = logLabel.childNodes[0].nodeValue.trim();
      const areaTitle = button
        .closest('.area-tile')
        .querySelector('.area-title')
        .textContent.replace('（時刻順）', '');

      // ログと時刻を保存する共通関数を呼び出し
      addLogAndTimeEntry(
        areaTitle,
        channelName,
        currentTime,
        futureTimeStr,
        button
      );
    });

    // マウスオーバーで表示を変更
    button.addEventListener('mouseover', () => {
      if (button.innerHTML === '<i class="fas fa-cat"></i>') {
        button.innerHTML = '<i class="fas fa-skull-crossbones"></i>';
      }
    });

    // マウスアウトで元に戻す
    button.addEventListener('mouseout', () => {
      if (button.innerHTML === '!<i class="fas fa-skull-crossbones"></i>')
        return;
      if (button.innerHTML === '<i class="fas fa-skull-crossbones"></i>') {
        button.innerHTML = '<i class="fas fa-cat"></i>';
      }
    });
  });

  // ページロード時に保存された時刻表示を復元
  document.querySelectorAll('.log-label').forEach((label) => {
    const channelName = label.childNodes[0].nodeValue.trim();
    const areaName = label
      .closest('.area-tile')
      .querySelector('.area-title')
      .textContent.replace('（時刻順）', '');
    const key = `${areaName}_${channelName}`;

    if (timeDisplays[key]) {
      let timeDisplay = label.querySelector('.time-display');
      if (!timeDisplay) {
        timeDisplay = document.createElement('div');
        timeDisplay.className = 'time-display';
        label.appendChild(timeDisplay);
      }
      timeDisplay.innerHTML = `<i class="far fa-clock"></i>&nbsp;${timeDisplays[
        key
      ].substring(0, 5)}`; // 表示上は時：分のみ
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
        timeDisplays: {...timeDisplays},
      });

      logs = previousState.logs; // ログを元に戻す
      timeDisplays = previousState.timeDisplays; // 時刻表示を元に戻す

      // logTextareaを復元
      logTextarea.value = logs.join('\n'); // ログテキストエリアに表示

      // ローカルストレージに復元した状態を保存
      saveLogs(logs);
      saveTimeDisplays(timeDisplays);

      // 時刻表示をリセットして再描画
      document
        .querySelectorAll('.time-display')
        .forEach((display) => display.remove());

      // 時刻ラベルを更新
      updateTimeDisplay();

      // ノートカードを更新
      updateNoteCard();
      rescheduleAllAlarms();
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
        timeDisplays: {...timeDisplays},
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
      document
        .querySelectorAll('.time-display')
        .forEach((display) => display.remove());

      // 時刻ラベルを更新
      updateTimeDisplay();
      rescheduleAllAlarms();

      // ノートカードを更新
      updateNoteCard();
    } else {
      showToast('進む操作はできません');
    }
  });

  // シェアボタンの機能
  shareButton.addEventListener('click', async () => {
    const shareUrl = generateShareableUrl(); // storage.jsからURLを生成

    try {
      await navigator.share({
        title: 'ネコシェア',
        url: shareUrl,
      });
    } catch (error) {
      console.error(error);
    }
    showToast('シェアします'); // ui.jsのトースト表示
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

  const noteCard = document.getElementById('noteCard');

  // エリア名とチャンネル名から該当する .log-row を見つけるヘルパー関数
  const findLogRow = (area, channel) => {
    for (const tile of document.querySelectorAll('.area-tile')) {
      const title = tile.querySelector('.area-title');
      if (title && title.textContent.trim() === area) {
        for (const label of tile.querySelectorAll('.log-label')) {
          if (label.childNodes[0].nodeValue.trim() === channel) {
            return label.closest('.log-row');
          }
        }
      }
    }
    return null;
  };

  // マウスオーバーで点灯
  noteCard.addEventListener('mouseover', (e) => {
    if (e.target.tagName === 'SPAN' && e.target.dataset.area) {
      const {area, channel} = e.target.dataset;
      const logRow = findLogRow(area, channel);
      if (logRow) {
        logRow.classList.add('log-row-highlight');
      }
    }
  });

  // マウスが離れたら消灯
  noteCard.addEventListener('mouseout', (e) => {
    document.querySelectorAll('.log-row-highlight').forEach((row) => {
      row.classList.remove('log-row-highlight');
    });
  });

  // クリックで点滅
  noteCard.addEventListener('click', (e) => {
    if (e.target.tagName === 'SPAN' && e.target.dataset.area) {
      // 既存の点滅があれば一旦リセット
      document.querySelectorAll('.log-row-blink').forEach((row) => {
        row.classList.remove('log-row-blink');
      });

      const {area, channel} = e.target.dataset;
      const logRow = findLogRow(area, channel);
      if (logRow) {
        logRow.classList.add('log-row-blink');
        // アニメーションが終了したらクラスを削除し、再クリックで点滅できるようにする
        logRow.addEventListener(
          'animationend',
          () => {
            logRow.classList.remove('log-row-blink');
          },
          {once: true}
        );
      }
    }
  });

  // アラーム時刻チェックボックスの処理
  const alarmTimeCheckboxes = ['alarm1min', 'alarm3min', 'alarm5min'];
  const muteCheckbox = document.getElementById('muteAlarm');

  // 1. ページ読み込み時に状態を復元
  const savedAlarmState = loadAlarmCheckboxesState();
  alarmTimeCheckboxes.forEach((id) => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.checked =
        savedAlarmState[id] !== undefined ? savedAlarmState[id] : true;
    }
  });

  // 2. 全てのアラーム関連チェックボックスにリスナーを設定
  [...alarmTimeCheckboxes, 'muteAlarm'].forEach((id) => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        // 3. 状態が変更されたら、現在の状態を保存
        const currentState = {
          alarm1min: document.getElementById('alarm1min').checked,
          alarm3min: document.getElementById('alarm3min').checked,
          alarm5min: document.getElementById('alarm5min').checked,
        };
        saveAlarmCheckboxesState(currentState);

        // 4. アラームを再スケジュール
        rescheduleAllAlarms();
      });
    }
  });
}

function pushToActionHistory(logs, timeDisplays) {
  actionHistory.push({
    logs: [...logs], // 現在のログをコピーして保存
    timeDisplays: {...timeDisplays}, // 現在の時刻表示をコピーして保存
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
  saveLogs(logs); // ローカルストレージに保存
}

// グローバルではなく、getter/setterで管理
let timeDisplays = loadTimeDisplays();
export function getTimeDisplays() {
  return timeDisplays;
}
export function setTimeDisplays(newTimeDisplays) {
  timeDisplays = newTimeDisplays;
  saveTimeDisplays(timeDisplays); // ローカルストレージに保存
}

function switchScreen(screenId) {
  const currentScreen = document.querySelector(
    '.screen:not([style*="display: none"])'
  );
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
  document.querySelector('#confirmModal .modal-content').style.animation =
    'modalContentFadeIn 0.3s forwards';
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
  logs = loadLogs(); // 現在のログを取得
  const currentTimeStr = logTime.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const padFullWidth = (str, length) => {
    let fullWidthSpace = '　'; // 全角スペース
    let currentLength = [...str].reduce(
      (sum, char) => sum + (char.match(/[^\x00-\x7F]/) ? 2 : 1),
      0
    );
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
  const logEntry = `${paddedAreaTitle} ${paddedChannelName} ${currentTimeStr.substring(
    0,
    5
  )}`;
  logs.push(logEntry);

  // 既存の内容に新しいログを追加して表示
  const logTextarea = document.getElementById('logTextarea');
  logTextarea.value = logs.join('\n'); // ここで、すべてのログを連結して表示

  // ログを保存
  saveLogs(logs);

  showToast(`${areaTitle} ${channelName}のログを追加しました`);
}

// 共通関数: ログと時刻を追加・保存
export function addLogAndTimeEntry(
  areaTitle,
  channelName,
  logTime,
  futureTime,
  button
) {
  // --- ▼▼▼ この関数は以下のように完全に書き換えます ▼▼▼ ---

  // 新しい操作が発生したのでリドゥ履歴をクリア
  redoHistory = [];

  // アンドゥ用に、更新前の状態を保存
  pushToActionHistory(logs, timeDisplays);

  // テキストログを追加
  addLogEntry(areaTitle, channelName, logTime);

  // 時刻データを更新して保存
  const key = `${areaTitle}_${channelName}`;
  timeDisplays[key] = futureTime;
  saveTimeDisplays(timeDisplays);

  // ボタンの表示を変更
  button.innerHTML = '!<i class="fas fa-skull-crossbones"></i>';

  // 時刻表示を更新
  const logLabel = button.closest('.log-row').querySelector('.log-label');
  let timeDisplay = logLabel.querySelector('.time-display');
  if (!timeDisplay) {
    timeDisplay = document.createElement('div');
    timeDisplay.className = 'time-display';
    logLabel.appendChild(timeDisplay);
  }
  timeDisplay.innerHTML = `<i class="far fa-clock"></i>&nbsp;${futureTime.substring(
    0,
    5
  )}`;

  // 全てのアラームを再スケジュール
  rescheduleAllAlarms();

  // ノートカードを更新
  updateNoteCard();
}

document.getElementById('shareButton').addEventListener('click', () => {
  const shareUrl = generateShareableUrl(); // ローカルストレージからURLを生成
  navigator.clipboard
    .writeText(shareUrl)
    .then(() => {
      showToast('URLをクリップボードに保存しました');
    })
    .catch((err) => {
      console.error('Failed to copy URL: ', err);
    });
});

document.getElementById('toggleTimeDisplay').addEventListener('click', () => {
  const checkboxIcon = document.getElementById('checkboxIcon');
  // ★ isCheckedの状態で現在の状態を管理
  const isChecked = checkboxIcon.classList.toggle('fa-square-check');
  checkboxIcon.classList.toggle('fa-square', !isChecked);

  // ★ 状態を保存する処理を追記
  saveHideTimeState(isChecked);

  // ノートカードを更新
  updateNoteCard();
});
