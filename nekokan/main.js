import {showOverwriteModal} from './ui.js';
import {loadFromUrlParams, loadLogs, removeHistoryGetData} from './storage.js';
import {initializeEventListeners} from './events.js';
import {updateNoteCard, updateAreaCount, updateDigitalClock} from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const existingData = loadLogs(); // ローカルストレージ内のデータを確認

  if (
    new URLSearchParams(window.location.search).has('data') &&
    existingData.length > 0
  ) {
    // 上書き確認モーダルを表示して、ユーザーの選択後に処理を続ける
    showOverwriteModal(
      () => {
        // ユーザーがOKを押した場合、GETパラメータのデータをロードしてから初期化
        loadFromUrlParams();
        initializeEventListeners();
        updateNoteCard(); // ノートカードを更新
        updateAreaCount();
        // URLからGETパラメータを削除
        removeHistoryGetData();
      },
      () => {
        // ユーザーがキャンセルを押した場合、通常の初期化
        initializeEventListeners();
        updateNoteCard();
        updateAreaCount();
        // URLからGETパラメータを削除
        removeHistoryGetData();
      }
    );
  } else {
    // 上書き確認の必要がない場合は直接データをロード
    loadFromUrlParams();
    initializeEventListeners();
    updateNoteCard();
    updateAreaCount();
    removeHistoryGetData();
  }
  // URLからGETパラメータを削除
  setInterval(updateNoteCard, 5000);
  // デジタル時計の初期化と更新（1秒ごと）
  updateDigitalClock(); // ページ読み込み時に即時表示
  setInterval(updateDigitalClock, 1000);
});
