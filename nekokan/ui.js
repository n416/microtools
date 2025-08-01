// ui.js
import {
  loadTimeDisplays,
  saveTimeDisplays,
  loadDisabledChannels,
  loadChannelCount,
  saveChannelCount,
  loadSecondsDisplayState, // インポートに追加
} from './storage.js';
let timeDisplays = loadTimeDisplays();

// timeDisplays が undefined の場合、空のオブジェクトで初期化
if (!timeDisplays) {
  timeDisplays = {};
  saveTimeDisplays(timeDisplays); // 初期化後に保存
}

import {rescheduleAllAlarms} from './alarmManager.js';

let orderedLogEntries = [];
let notifiedEvents = new Set();

// ノートを更新
export function updateNoteCard() {
  timeDisplays = loadTimeDisplays();
  collectAndSortLogEntries();

  let lastArea = null;
  const formattedEntries = [];
  const hideTime = document
    .getElementById('checkboxIcon')
    .classList.contains('fa-square-check'); // 時刻非表示の状態

  const showSeconds = loadSecondsDisplayState(); // 秒表示の状態を読み込む

  orderedLogEntries.forEach((entry, index) => {
    let timePart = ''; // 表示する時刻部分を格納する変数
    if (!hideTime) {
      // showSeconds の状態に応じて表示を切り替える
      timePart = showSeconds ? entry.time : entry.time.substring(0, 5);
    }
    // data属性を追加
    const dataAttributes = `data-area="${entry.area}" data-channel="${entry.channel}"`;
    if (lastArea !== entry.area) {
      if (formattedEntries.length > 0) {
        formattedEntries.push('<hr>');
      }
      formattedEntries.push(
        `<span class="${entry.class}" ${dataAttributes}>${entry.area} ${
          entry.channel
        }${timePart ? ' ' + timePart : ''}</span>`
      );
    } else {
      formattedEntries.push(
        `<span class="${entry.class}" ${dataAttributes}>${entry.channel}${
          timePart ? ' ' + timePart : ''
        }</span>`
      );
    }
    lastArea = entry.area;
  });

  const noteCard = document.getElementById('noteCard');
  if (formattedEntries.length > 0) {
    const noteCardHtml = formattedEntries
      .join(' → ')
      .replace(/ → <hr>/g, '<hr>')
      .replace(/<hr> → /g, '<hr>');
    if (noteCard.innerHTML != noteCardHtml) {
      noteCard.innerHTML = noteCardHtml;
    }
    noteCard.classList.add('active');
  } else {
    noteCard.innerHTML = '';
    noteCard.classList.remove('active');
  }
}

// 時刻ラベルを更新
export function updateTimeDisplay() {
  timeDisplays = loadTimeDisplays();
  document.querySelectorAll('.log-label').forEach((label) => {
    const channelName = label.childNodes[0].nodeValue.trim();
    const areaName = label
      .closest('.area-tile')
      .querySelector('.area-title').textContent;
    const key = `${areaName}_${channelName}`;

    // keyがtimeDisplaysに存在するか確認してから操作
    if (timeDisplays && timeDisplays[key]) {
      let timeDisplay = label.querySelector('.time-display');
      if (!timeDisplay) {
        timeDisplay = document.createElement('div');
        timeDisplay.className = 'time-display';
        label.appendChild(timeDisplay);
      }
      timeDisplay.innerHTML = `<i class="far fa-clock"></i>&nbsp;${timeDisplays[
        key
      ].substring(0, 5)}`;
    }
  });
}

export function updateAreaCount() {
  document.querySelectorAll('.area-tile').forEach((areaTile) => {
    const areaTitleElement = areaTile.querySelector('.area-title');
    if (areaTitleElement) {
      const areaName = areaTitleElement.textContent.trim();
      const channelCount = loadChannelCount(areaName);
      adjustChannelDisplay(areaName, channelCount);
    }
  });
}

export function collectAndSortLogEntries() {
  const logEntries = [];
  const now = new Date();

  const logLabels = document.querySelectorAll('.log-label');

  logLabels.forEach((label) => {
    const timeDisplay = label.querySelector('.time-display');
    if (timeDisplay) {
      const areaTitle = label
        .closest('.area-tile')
        .querySelector('.area-title')
        .textContent.replace('（時刻順）', '');
      const channelName = label.childNodes[0].nodeValue.trim();
      const key = `${areaTitle}_${channelName}`;
      const internalTimeString = timeDisplays[key];

      if (internalTimeString) {
        const displayTime = internalTimeString.substring(0, 5);
        const logTime = new Date(now.toDateString() + ' ' + internalTimeString);

        let entryClass = '';
        const timeDifference = logTime - now;
        const fiveMinits = 5 * 60 * 1000;

        const originalTitle = "NEKO-KAN"; // 元のタイトル

        // 1. 出現時刻を過ぎて5秒以内、かつ、まだ通知していない場合
        if (timeDifference < 0 && Math.abs(timeDifference) < 5000 && !notifiedEvents.has(key)) {
          
          document.title = `【出現中】${areaTitle} ${channelName}`;
          notifiedEvents.add(key); // 通知済みとして記録

          // 15秒後にタイトルを元に戻す
          setTimeout(() => {
            document.title = originalTitle;
          }, 15000);
        }

        // 2. 通知済みイベントが1分以上経過したら、記録から削除して再度通知できるようにする
        if (timeDifference < -60000 && notifiedEvents.has(key)) {
            notifiedEvents.delete(key);
        }

        if (timeDifference > 0 && timeDifference <= fiveMinits) {
          // 今から5分以内の未来の時刻は soon-log
          entryClass = 'soon-log';
        } else if (
          timeDifference < 0 &&
          Math.abs(timeDifference) <= fiveMinits
        ) {
          // 5分以内の過去の時刻も soon-log
          entryClass = 'soon-log';
        } else if (timeDifference < 0) {
          // 5分以上過去の時刻は past-log
          entryClass = 'past-log';
        }

        logEntries.push({
          time: internalTimeString,
          area: areaTitle,
          channel: channelName,
          text: `${areaTitle} ${displayTime} ${channelName}`,
          logTime,
          class: entryClass,
        });
      }
    }
  });

  logEntries.sort((a, b) => a.time.localeCompare(b.time));
  orderedLogEntries = logEntries;

  const futureEntries = orderedLogEntries.filter(
    (entry) => entry.logTime > now
  );
  if (futureEntries.length > 0) {
    futureEntries[0].class += ' closest-log';
  }
}

export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show';
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

// ページロード時にボタンの状態を復元
document.addEventListener('DOMContentLoaded', () => {
  const disabledChannels = loadDisabledChannels(); // ローカルストレージから取得

  Object.keys(disabledChannels).forEach((key) => {
    const [englishAreaName, channelName] = key.split('_');
    const logButtonId = `#logButton${englishAreaName}${channelName}`;
    const logButton = document.querySelector(logButtonId);

    if (logButton) {
      logButton.disabled = true; // ボタンを無効化
      logButton.classList.add('disabled-log-btn'); // スタイルを適用
    }
  });
});

// timePickerModalの閉じるボタン
const timePickerModalCloseButton = document.getElementById(
  'timePickerModalCloseButton'
);

// 閉じるボタンがクリックされたら、モーダルを非表示にする
timePickerModalCloseButton.addEventListener('click', () => {
  timePickerModal.style.display = 'none';
});

document.querySelectorAll('.area-title').forEach((areaTitle) => {
  areaTitle.addEventListener('click', () => {
    const areaName = areaTitle.textContent ? areaTitle.textContent.trim() : ''; // エリア名を取得
    if (areaName) {
      openChannelSettingsModal(areaName); // モーダルを開く
    }
  });
});

function openChannelSettingsModal(areaName) {
  const modal = document.getElementById('channelSettingsModal');
  modal.style.display = 'flex'; // モーダルを表示
  const channelCountInput = document.getElementById('channelCountInput');
  const currentChannelCount = loadChannelCount(areaName);

  // 現在のチャンネル数を入力欄に表示
  channelCountInput.value = currentChannelCount;

  document.getElementById('channelCountOkButton').onclick = () => {
    const channelCount = parseInt(channelCountInput.value, 10);
    if (channelCount >= 1 && channelCount <= 10) {
      saveChannelCount(areaName, channelCount); // エリアごとのチャンネル数を保存
      adjustChannelDisplay(areaName, channelCount); // エリアごとの表示を調整
    }
    modal.style.display = 'none'; // モーダルを閉じる
  };

  document.getElementById('channelSettingsClearButton').onclick = () => {
    // timeDisplaysから該当エリアのデータを削除
    let timeDisplays = loadTimeDisplays();
    Object.keys(timeDisplays).forEach((key) => {
      if (key.startsWith(areaName + '_')) {
        delete timeDisplays[key];
      }
    });
    saveTimeDisplays(timeDisplays);

    // 画面上の時刻表示をクリア
    const areaTile = Array.from(document.querySelectorAll('.area-tile')).find(
      (tile) => {
        return (
          tile.querySelector('.area-title').textContent.trim() === areaName
        );
      }
    );

    if (areaTile) {
      areaTile
        .querySelectorAll('.time-display')
        .forEach((display) => display.remove());
    }

    // ノートカードを更新してモーダルを閉じる
    updateNoteCard();
    modal.style.display = 'none';
    showToast(`${areaName} の全時刻ログをクリアしました`);
    rescheduleAllAlarms();
  };
  document.getElementById('channelSettingsClearButton').onclick = () => {
    // timeDisplaysから該当エリアのデータを削除
    let timeDisplays = loadTimeDisplays();
    Object.keys(timeDisplays).forEach((key) => {
      if (key.startsWith(areaName + '_')) {
        delete timeDisplays[key];
      }
    });
    saveTimeDisplays(timeDisplays);

    // 画面上の時刻表示をクリア
    const areaTile = Array.from(document.querySelectorAll('.area-tile')).find(
      (tile) => {
        return (
          tile.querySelector('.area-title').textContent.trim() === areaName
        );
      }
    );

    if (areaTile) {
      areaTile
        .querySelectorAll('.time-display')
        .forEach((display) => display.remove());
    }

    // ノートカードを更新してモーダルを閉じる
    updateNoteCard();
    modal.style.display = 'none';
    showToast(`${areaName} の全時刻ログをクリアしました`);
  };
}

// ページロード時に各エリアのチャンネル数を適用
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.area-tile').forEach((areaTile) => {
    const areaTitleElement = areaTile.querySelector('.area-title');
    if (areaTitleElement) {
      const areaName = areaTitleElement.textContent.trim();
      const channelCount = loadChannelCount(areaName);
      adjustChannelDisplay(areaName, channelCount);
    }
  });
});

function adjustChannelDisplay(areaName, channelCount) {
  const areaTile = Array.from(document.querySelectorAll('.area-tile')).find(
    (tile) => {
      return tile.querySelector('.area-title').textContent.trim() === areaName;
    }
  );

  if (!areaTile) {
    console.error(`Area tile for ${areaName} not found`);
    return;
  }
  // PVP行を除いたlog-rowの表示を設定 (入力値 + 1)
  for (let i = 1; i <= 10; i++) {
    // PVPが1行目にあるため、実際のチャンネルはnth-child(i + 2)から始まる
    const logRow = areaTile.querySelector(`.log-row:nth-child(${i + 2})`); // i + 2でPVPを飛ばす
    if (i <= channelCount) {
      logRow.style.display = 'flex'; // チャンネルを表示
    } else {
      logRow.style.display = 'none'; // チャンネルを非表示
    }
  }
}

// ページロード時に各エリアのチャンネル数を適用
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.area-tile').forEach((areaTile) => {
    const areaTitleElement = areaTile.querySelector('.area-title');
    if (areaTitleElement) {
      const areaName = areaTitleElement.textContent.trim();
      const channelCount = loadChannelCount(areaName);
      adjustChannelDisplay(areaName, channelCount);
    }
  });
});

// 閉じるボタンのイベントリスナー
document
  .getElementById('channelSettingsModalCloseButton')
  .addEventListener('click', () => {
    const modal = document.getElementById('channelSettingsModal');
    modal.style.display = 'none'; // モーダルを非表示にする
  });

const channelSettingsModal = document.getElementById('channelSettingsModal');
channelSettingsModal.addEventListener('click', (event) => {
  if (event.target === channelSettingsModal) {
    channelSettingsModal.style.display = 'none';
  }
});

export function showOverwriteModal(onConfirm, onCancel) {
  const overwriteModal = document.getElementById('overwriteModal');
  overwriteModal.style.display = 'flex';

  // OKボタンを押したときの処理
  document
    .getElementById('overwriteYesButton')
    .addEventListener('click', () => {
      onConfirm();
      overwriteModal.style.display = 'none';
    });

  // キャンセルボタンを押したときの処理
  document.getElementById('overwriteNoButton').addEventListener('click', () => {
    onCancel();
    overwriteModal.style.display = 'none';
  });

  // 閉じるボタンを押したときの処理（キャンセルと同様）
  document
    .getElementById('overwriteModalCloseButton')
    .addEventListener('click', () => {
      onCancel();
      overwriteModal.style.display = 'none';
    });

  // モーダル背景をクリックしたときにキャンセル処理を行う
  overwriteModal.addEventListener('click', (event) => {
    if (event.target === overwriteModal) {
      onCancel();
      overwriteModal.style.display = 'none';
    }
  });
}

// デジタル時計を更新する関数
export function updateDigitalClock() {
  const clockElement = document.getElementById('digitalClock');
  if (clockElement) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    clockElement.textContent = `${hours}:${minutes}:${seconds}`;
  }
}
