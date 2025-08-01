// storage.js
import {
  updateNoteCard,
  collectAndSortLogEntries,
  updateAreaCount,
} from './ui.js';

import {rescheduleAllAlarms} from './alarmManager.js';

export function loadLogs() {
  try {
    const logs = localStorage.getItem('logs');
    return logs ? JSON.parse(logs) : [];
  } catch (error) {
    console.error('Failed to load logs:', error);
    return [];
  }
}

export function saveLogs(logs) {
  try {
    localStorage.setItem('logs', JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to save logs:', error);
  }
}

export function loadTimeDisplays() {
  try {
    const timeDisplays = localStorage.getItem('timeDisplays');
    if (!timeDisplays || timeDisplays === 'undefined') {
      return {}; // 空のオブジェクトを返す
    }
    return JSON.parse(timeDisplays);
  } catch (error) {
    console.error('Failed to load timeDisplays:', error);
    return {}; // エラーが発生した場合でも、空のオブジェクトを返す
  }
}

export function saveTimeDisplays(timeDisplays) {
  try {
    if (!timeDisplays) {
      timeDisplays = {}; // undefined の場合に空のオブジェクトで初期化
    }
    localStorage.setItem('timeDisplays', JSON.stringify(timeDisplays));
  } catch (error) {
    // console.error('Failed to save timeDisplays:', error);
  }
}

// ローカルストレージからdisabledChannelsを読み込む
export function loadDisabledChannels() {
  return JSON.parse(localStorage.getItem('disabledChannels')) || {};
}

// ローカルストレージにdisabledChannelsを保存する
export function saveDisabledChannels(disabledChannels) {
  localStorage.setItem('disabledChannels', JSON.stringify(disabledChannels));
}

// 各エリアごとにチャンネル数を保存する
export function saveChannelCount(areaName, channelCount) {
  let channelSettings = {};
  try {
    const savedSettings = localStorage.getItem('channelSettings');

    if (savedSettings) {
      // savedSettingsがnullやundefinedでない場合のみJSON.parseを実行
      channelSettings = JSON.parse(savedSettings);
    } else {
      // savedSettingsがnullまたはundefinedなら空のオブジェクトを使用
      channelSettings = {};
    }
  } catch (error) {
    console.error('Invalid JSON in localStorage for channelSettings:', error);
    // エラー時は空のオブジェクトにリセット
    channelSettings = {};
  }

  // チャンネル数を設定し、再度保存
  channelSettings[areaName] = channelCount;
  localStorage.setItem('channelSettings', JSON.stringify(channelSettings));
}

// 各エリアごとのチャンネル数を取得する
export function loadChannelCount(areaName) {
  let channelSettings = {};

  try {
    const savedSettings = localStorage.getItem('channelSettings');

    // 値が存在し、かつ空でないかチェック
    if (savedSettings && savedSettings !== 'undefined') {
      // 有効なJSONをパース
      channelSettings = JSON.parse(savedSettings);
    } else {
      // 保存されたデータが無効だった場合にデフォルト値を使用
      channelSettings = {};
    }
  } catch (error) {
    console.error('Invalid JSON in localStorage for channelSettings:', error);
    // エラー時は空のオブジェクトにリセット
    channelSettings = {};
  }

  // ★ areaNameに対応する設定がなければ、グローバルのデフォルト値を返す
  return channelSettings[areaName] || loadDefaultChannelCount();
}

// 全エリアのチャンネル数を保存する
export function saveChannelCounts(channelCounts) {
  console.log(channelCounts);
  if (channelCounts && channelCounts !== 'undefined') {
    console.log('not undefined');
    localStorage.setItem('channelSettings', JSON.stringify(channelCounts));
  } else {
    console.log('undefined');
    localStorage.setItem('channelSettings', '');
  }
}

// 全エリアのチャンネル数を取得する
export function loadChannelCounts() {
  let channelSettings = {};

  try {
    const savedSettings = localStorage.getItem('channelSettings');

    // 値が存在し、かつ空でないかチェック
    if (savedSettings && savedSettings !== 'undefined') {
      // 有効なJSONをパース
      channelSettings = JSON.parse(savedSettings);
    } else {
      // 保存されたデータが無効だった場合にデフォルト値を使用
      channelSettings = {};
    }
  } catch (error) {
    console.error('Invalid JSON in localStorage for channelSettings:', error);
    // エラー時は空のオブジェクトにリセット
    channelSettings = {};
  }

  // areaNameに対応するチャンネル数を返す。見つからない場合はデフォルトのチャンネル数を返す
  return channelSettings;
}

export function generateShareableUrl() {
  const logs = loadLogs();
  const timeDisplays = loadTimeDisplays();
  const channelCounts = loadChannelCounts();
  const data = {logs, timeDisplays, channelCounts};

  // LZStringで圧縮
  const compressedData = LZString.compressToEncodedURIComponent(
    JSON.stringify(data)
  );
  const baseUrl = window.location.origin + window.location.pathname;

  // 圧縮したデータをURLに追加
  return `${baseUrl}?data=${compressedData}`;
}

// GETパラメータ読み込み
export function loadFromUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const compressedData = urlParams.get('data');

  if (compressedData) {
    const decompressedData =
      LZString.decompressFromEncodedURIComponent(compressedData);
    const data = JSON.parse(decompressedData);

    if (data) {
      saveLogs(data.logs);
      saveTimeDisplays(data.timeDisplays);
      saveChannelCounts(data.channelCounts);
      // データ復元後にUIを更新
      collectAndSortLogEntries(); // ログを整理
      updateNoteCard(); // ノートカードを更新
      updateAreaCount();
      rescheduleAllAlarms();
    }
  }
}

// URLのクエリパラメータからdataを削除
export function removeHistoryGetData() {
  const url = new URL(window.location);
  url.searchParams.delete('data');
  history.replaceState(null, '', url); // ブラウザ履歴を更新し、URLからdataパラメータを削除
}

// storage.js の末尾に追加

// 秒表示チェックボックスの状態を保存
export function saveSecondsDisplayState(state) {
  localStorage.setItem('secondsDisplayState', JSON.stringify(state));
}

// 秒表示チェックボックスの状態を読み込み
export function loadSecondsDisplayState() {
  const state = localStorage.getItem('secondsDisplayState');
  return state ? JSON.parse(state) : false; // デフォルトはfalse
}

// デフォルトのチャンネル数を保存する
export function saveDefaultChannelCount(count) {
  localStorage.setItem('defaultChannelCount', count);
}

// デフォルトのチャンネル数を読み込む
export function loadDefaultChannelCount() {
  const count = localStorage.getItem('defaultChannelCount');
  // 設定がなければ「5」を、あればその数値を返す
  return count ? parseInt(count, 10) : 2;
}

// 「時刻非表示」の状態を保存
export function saveHideTimeState(state) {
  localStorage.setItem('hideTimeState', JSON.stringify(state));
}

// 「時刻非表示」の状態を読み込み
export function loadHideTimeState() {
  const state = localStorage.getItem('hideTimeState');
  return state ? JSON.parse(state) : false; // デフォルトはfalse（表示）
}

// アラーム時刻設定のチェックボックスの状態を保存
export function saveAlarmCheckboxesState(state) {
  localStorage.setItem('alarmCheckboxesState', JSON.stringify(state));
}

// アラーム時刻設定のチェックボックスの状態を読み込み
export function loadAlarmCheckboxesState() {
  const state = localStorage.getItem('alarmCheckboxesState');
  // デフォルトでは全てチェックされている状態を返す
  return state
    ? JSON.parse(state)
    : {alarm1min: false, alarm3min: false, alarm5min: false};
}
