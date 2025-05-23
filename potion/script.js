const DB_NAME = 'PotionTrackerDB_v2';
const POTION_LOG_STORE_NAME = 'PotionLogStore';
const HUNTING_GROUND_STORE_NAME = 'HuntingGroundStore';
const LOCALSTORAGE_LAST_QUANTITY_KEY = 'lastPotionQuantity_v2';
const LOCALSTORAGE_CURRENT_HG_ID_KEY = 'currentHuntingGroundId_v2';
const LOCALSTORAGE_ACTIVE_TIMER_KEY = 'activePotionTimer_v3_custom'; // キー名を変更

const UNSET_HUNTING_GROUND_ID = 0;
const UNSET_HUNTING_GROUND_NAME = '未設定';

let db;
let chartInstance;
let currentHuntingGroundId = UNSET_HUNTING_GROUND_ID;
// activeTimerInfo の構造:
// { type: 'depletion' | 'custom', timeoutId: number, targetTime: number, depletionTime: number, offsetMinutes?: number }
let activeTimerInfo = null;


let mainHgDropdownContainerEl, mainHgDropdownSelectedEl, mainHgDropdownSelectedNameEl, mainHgDropdownOptionsEl;
let mainHgDropdownSelectedRateEl;

function formatDateTimeSmart(timestamp) {
  if (timestamp === null || timestamp === undefined) return "";
  const dateObj = new Date(timestamp);
  const now = new Date();
  const timeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  if (
    dateObj.getFullYear() === now.getFullYear() &&
    dateObj.getMonth() === now.getMonth() &&
    dateObj.getDate() === now.getDate()
  ) {
    return dateObj.toLocaleTimeString('ja-JP', timeFormatOptions);
  } else {
    const dateFormatOptions = { month: 'numeric', day: 'numeric' };
    return `${dateObj.toLocaleDateString('ja-JP', dateFormatOptions)} ${dateObj.toLocaleTimeString('ja-JP', timeFormatOptions)}`;
  }
}

async function initDB() {
  if (!db) {
    db = await idb.openDB(DB_NAME, 2, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains(POTION_LOG_STORE_NAME)) {
          const store = db.createObjectStore(POTION_LOG_STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('huntingGroundId_timestamp', ['huntingGroundId', 'timestamp']);
        } else if (oldVersion < 2 && transaction.objectStore(POTION_LOG_STORE_NAME)) {
          const store = transaction.objectStore(POTION_LOG_STORE_NAME);
          if (!store.indexNames.contains('huntingGroundId_timestamp')) {
            store.createIndex('huntingGroundId_timestamp', ['huntingGroundId', 'timestamp']);
          }
        }

        if (!db.objectStoreNames.contains(HUNTING_GROUND_STORE_NAME)) {
          const hgStore = db.createObjectStore(HUNTING_GROUND_STORE_NAME, { keyPath: 'id', autoIncrement: true });
          hgStore.createIndex('name', 'name', { unique: true });
        }
      },
    });
    await ensureUnsetHuntingGroundExists();
  }
}

async function ensureUnsetHuntingGroundExists() {
  const tx = db.transaction(HUNTING_GROUND_STORE_NAME, 'readwrite');
  const store = tx.objectStore(HUNTING_GROUND_STORE_NAME);
  let unsetHG = await store.get(UNSET_HUNTING_GROUND_ID);

  if (!unsetHG) {
    try {
      const existingByName = await store.index('name').get(UNSET_HUNTING_GROUND_NAME);
      if (existingByName) {
        // "Unset" exists by name. Ensure currentHuntingGroundId logic handles this.
      } else {
        try {
          await store.put({ id: UNSET_HUNTING_GROUND_ID, name: UNSET_HUNTING_GROUND_NAME, lastCalculatedConsumptionRate: null });
        } catch (e) {
          console.warn("Failed to add 'Unset' hunting ground with specific ID 0. Trying without ID.", e);
          const newId = await store.add({ name: UNSET_HUNTING_GROUND_NAME, lastCalculatedConsumptionRate: null });
          console.log(`'${UNSET_HUNTING_GROUND_NAME}' added with auto-generated ID: ${newId}.`);
        }
      }
    } catch (error) {
      console.error("Error ensuring 'Unset' hunting ground exists:", error);
    }
  }
  await tx.done;

  const storedHgId = localStorage.getItem(LOCALSTORAGE_CURRENT_HG_ID_KEY);
  if (storedHgId !== null) {
    currentHuntingGroundId = parseInt(storedHgId, 10);
    const hg = await getHuntingGroundById(currentHuntingGroundId);
    if (!hg) {
      console.warn(`Stored hunting ground ID ${currentHuntingGroundId} not found. Resetting to 'Unset'.`);
      const unsetRecord = await getHuntingGroundByName(UNSET_HUNTING_GROUND_NAME);
      currentHuntingGroundId = unsetRecord ? unsetRecord.id : UNSET_HUNTING_GROUND_ID;
      localStorage.setItem(LOCALSTORAGE_CURRENT_HG_ID_KEY, currentHuntingGroundId.toString());
    }
  } else {
    const unsetRecord = await getHuntingGroundByName(UNSET_HUNTING_GROUND_NAME);
    currentHuntingGroundId = unsetRecord ? unsetRecord.id : UNSET_HUNTING_GROUND_ID;
    localStorage.setItem(LOCALSTORAGE_CURRENT_HG_ID_KEY, currentHuntingGroundId.toString());
  }
}


async function getHuntingGroundByName(name) {
  await initDB();
  if (!db) { console.error("DB not initialized for getHuntingGroundByName"); return null; }
  const tx = db.transaction(HUNTING_GROUND_STORE_NAME, 'readonly');
  const store = tx.objectStore(HUNTING_GROUND_STORE_NAME);
  const index = store.index('name');
  return await index.get(name);
}


async function addRecord() {
  const quantityInput = document.getElementById('potionQuantity');
  const quantity = parseInt(quantityInput.value, 10);
  if (isNaN(quantity) || quantity < 0) {
    alert('有効なポーション数量 (0以上の数値) を入力してください。');
    return;
  }
  await initDB();
  const record = {
    timestamp: new Date().getTime(),
    quantity: quantity,
    huntingGroundId: currentHuntingGroundId
  };
  try {
    await db.add(POTION_LOG_STORE_NAME, record);
    localStorage.setItem(LOCALSTORAGE_LAST_QUANTITY_KEY, quantity.toString());
    loadAndProcessDataForCurrentHG();
  } catch (error) {
    console.error('記録の追加に失敗しました:', error);
    alert('記録の追加に失敗しました。コンソールで詳細を確認してください。');
  }
}

async function getRecordsForHuntingGround(hgId) {
  await initDB();
  try {
    const tx = db.transaction(POTION_LOG_STORE_NAME, 'readonly');
    const store = tx.objectStore(POTION_LOG_STORE_NAME);
    const index = store.index('huntingGroundId_timestamp');
    return await index.getAll(IDBKeyRange.bound([hgId, -Infinity], [hgId, Infinity]));
  } catch (error) {
    console.error(`ID: ${hgId} の狩り場の記録取得に失敗しました:`, error);
    return [];
  }
}

async function requestDeleteRecord(recordId) {
  if (confirm(`この記録を本当に削除しますか？この操作は取り消せません。`)) {
    await deleteSingleRecord(recordId);
  }
}

async function deleteSingleRecord(recordId) {
  await initDB();
  try {
    await db.delete(POTION_LOG_STORE_NAME, recordId);
    loadAndProcessDataForCurrentHG();
  } catch (error) {
    console.error(`ID: ${recordId} の記録削除に失敗しました:`, error);
    alert('記録の削除に失敗しました。コンソールで詳細を確認してください。');
  }
}

async function clearDataForCurrentHuntingGround() {
  const hg = await getHuntingGroundById(currentHuntingGroundId);
  const hgName = hg ? hg.name : "選択された狩り場";
  if (!confirm(`「${hgName}」の全てのポーション記録を本当に削除しますか？この操作は取り消せません。\n（この狩り場の過去の消費速度データは保持されます）`)) {
    return;
  }
  await initDB();
  try {
    const recordsToDelete = await getRecordsForHuntingGround(currentHuntingGroundId);
    const tx = db.transaction(POTION_LOG_STORE_NAME, 'readwrite');
    const store = tx.objectStore(POTION_LOG_STORE_NAME);
    for (const record of recordsToDelete) {
      await store.delete(record.id);
    }
    await tx.done;
    loadAndProcessDataForCurrentHG();
    alert(`「${hgName}」のポーション記録データが削除されました。`);
  } catch (error) {
    console.error(`「${hgName}」のデータの削除に失敗しました:`, error);
    alert('データの削除に失敗しました。コンソールで詳細を確認してください。');
  }
}

function createLogListItem(record) {
  const listItem = document.createElement('li');
  const logTextSpan = document.createElement('span');
  logTextSpan.classList.add('log-text');
  logTextSpan.textContent = `${formatDateTimeSmart(record.timestamp)} - 数量: ${record.quantity} `;
  listItem.appendChild(logTextSpan);

  const deleteButton = document.createElement('button');
  deleteButton.textContent = '削除';
  deleteButton.classList.add('delete-log-btn');
  deleteButton.onclick = () => requestDeleteRecord(record.id);
  listItem.appendChild(deleteButton);

  return listItem;
}

function displayLogs(records) {
  const logListLatestEl = document.getElementById('logListLatest');
  const olderLogsAccordionEl = document.getElementById('olderLogsAccordion');
  const olderLogsSummaryEl = olderLogsAccordionEl.querySelector('summary');
  const logListOlderEl = document.getElementById('logListOlder');
  const noLogsMessageEl = document.getElementById('noLogsMessage');

  logListLatestEl.innerHTML = '';
  logListOlderEl.innerHTML = '';
  olderLogsAccordionEl.style.display = 'none';
  noLogsMessageEl.style.display = 'none';

  if (!records || records.length === 0) {
    noLogsMessageEl.style.display = 'block';
    return;
  }

  const sortedRecords = [...records].sort((a, b) => b.timestamp - a.timestamp);

  const latestLogs = sortedRecords.slice(0, 3);
  const olderLogs = sortedRecords.slice(3);

  latestLogs.forEach(record => {
    logListLatestEl.appendChild(createLogListItem(record));
  });

  if (olderLogs.length > 0) {
    olderLogsAccordionEl.style.display = 'block';
    olderLogsSummaryEl.textContent = `過去の記録を見る (${olderLogs.length}件)`;
    olderLogs.forEach(record => {
      logListOlderEl.appendChild(createLogListItem(record));
    });
  } else {
    olderLogsSummaryEl.textContent = '過去の記録を見る';
  }
}

function formatRemainingTime(milliseconds) {
  if (milliseconds <= 0) {
    return "既に枯渇か直後";
  }
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `約 ${hours}時間${minutes}分後`;
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("このブラウザはデスクトップ通知をサポートしていません。");
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission !== "denied") {
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (error) {
      console.error("通知許可の要求中にエラーが発生しました:", error);
      return false;
    }
  }
  return false;
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('このブラウザは音声合成をサポートしていません。'); // alertから変更
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  window.speechSynthesis.speak(utterance);
}

function createAudioTestLink(type, label, message) {
  const link = document.createElement('button');
  link.classList.add('audio-test-link');
  link.textContent = label;
  link.onclick = () => speak(message);
  return link;
}

function setupAudioTestLinks() {
  const container = document.getElementById('audioTestLinks');
  if (!container) return;
  container.innerHTML = '';

  const tests = [
    { type: 'depletion', label: '枯渇時 通知音', message: 'ポーションが枯渇しました。' }, // ラベル少し変更
    { type: 'custom_5min', label: '5分前 通知音', message: 'まもなくポーションが枯渇します。5分前です。' }, //例
  ];

  tests.forEach(test => {
    container.appendChild(createAudioTestLink(test.type, test.label, test.message));
  });
}

function showDesktopNotification(title, body) {
  if (Notification.permission === "granted") {
    new Notification(title, { body: body });
  }
}

function createTimerButton(type, label, depletionTime, isActive = false) {
  const button = document.createElement('button');
  button.classList.add('timer-button');
  if (isActive) {
    button.classList.add('active');
  }
  button.dataset.type = type;
  button.textContent = label;
  button.onclick = () => handleTimerAction(type, depletionTime);
  return button;
}

function updateTimerUI(currentDepletionTime) {
  const buttonsContainer = document.getElementById('timerButtons');
  const statusEl = document.getElementById('timerStatus');
  const controlsContainer = document.getElementById('timerNotificationControlsContainer');

  if (!buttonsContainer || !statusEl || !controlsContainer) return;
  buttonsContainer.innerHTML = ''; // UIをクリア

  let hasValidFutureDepletionTime = currentDepletionTime && currentDepletionTime > Date.now();

  if (!hasValidFutureDepletionTime) {
    statusEl.textContent = activeTimerInfo ? '以前の通知は無効になりました。' : '予測枯渇時刻が過去または無効なためタイマーを設定できません。';
    if (activeTimerInfo) clearActiveTimer();
    // controlsContainerの表示制御は呼び出し元で行う
    return;
  }

  // 1. 「枯渇時に通知」ボタン
  const depletionButtonActive = activeTimerInfo && activeTimerInfo.type === 'depletion' && activeTimerInfo.depletionTime === currentDepletionTime;
  const depletionButton = createTimerButton('depletion', '枯渇時に通知', currentDepletionTime, depletionButtonActive);
  buttonsContainer.appendChild(depletionButton);

  // 2. カスタム時間入力エリア
  const customTimerDiv = document.createElement('div');
  customTimerDiv.style.display = 'flex';
  customTimerDiv.style.alignItems = 'center';
  customTimerDiv.style.gap = '5px';
  customTimerDiv.style.flexWrap = 'wrap';

  const customMinutesInput = document.createElement('input');
  customMinutesInput.type = 'number';
  customMinutesInput.id = 'customTimerMinutesInput'; // CSSでスタイル指定するためID付与
  customMinutesInput.min = '0';
  customMinutesInput.placeholder = '例:15';
  customMinutesInput.value = 5;
  if (activeTimerInfo && activeTimerInfo.type === 'custom' && typeof activeTimerInfo.offsetMinutes === 'number' && activeTimerInfo.depletionTime === currentDepletionTime) {
    customMinutesInput.value = activeTimerInfo.offsetMinutes;
  }

  const customLabelSpan = document.createElement('span');
  customLabelSpan.textContent = '分前に';

  const setCustomButton = document.createElement('button');
  setCustomButton.id = 'setCustomTimerButton';
  setCustomButton.classList.add('timer-button');
  const customButtonActive = activeTimerInfo && activeTimerInfo.type === 'custom' && activeTimerInfo.depletionTime === currentDepletionTime;
  if (customButtonActive) {
    setCustomButton.classList.add('active');
  }
  setCustomButton.textContent = 'この設定で通知'; // ボタンのテキスト変更
  setCustomButton.onclick = () => {
    const minutes = parseInt(customMinutesInput.value, 10);
    if (!isNaN(minutes) && minutes >= 0) {
      if (customButtonActive && activeTimerInfo.offsetMinutes === minutes) { // 同じ設定で再度押されたら解除
        clearActiveTimer();
      } else {
        setTimer('custom', currentDepletionTime, minutes);
      }
      updateTimerUI(currentDepletionTime); // UIを即時更新
    } else {
      alert('有効な数値を入力してください（0以上）。');
    }
  };

  customTimerDiv.appendChild(customMinutesInput);
  customTimerDiv.appendChild(customLabelSpan);
  customTimerDiv.appendChild(setCustomButton);
  buttonsContainer.appendChild(customTimerDiv);

  // 3. ステータスメッセージ更新
  if (activeTimerInfo && activeTimerInfo.depletionTime === currentDepletionTime) {
    if (activeTimerInfo.type === 'depletion') {
      statusEl.textContent = `枯渇時に通知が ${formatDateTimeSmart(activeTimerInfo.targetTime)} にセットされています。`;
    } else if (activeTimerInfo.type === 'custom' && typeof activeTimerInfo.offsetMinutes === 'number') {
      statusEl.textContent = `${activeTimerInfo.offsetMinutes}分前に通知が ${formatDateTimeSmart(activeTimerInfo.targetTime)} にセットされています。`;
    }
  } else if (activeTimerInfo && activeTimerInfo.depletionTime !== currentDepletionTime) {
    // 枯渇予測時刻が変わった場合、保存されていたタイマーは実質無効
    clearActiveTimer(); // 古いタイマーをクリア
    statusEl.textContent = '予測枯渇時刻が更新されました。通知を再設定してください。';
    // 新しい枯渇時刻でカスタム入力値が残っていればそれを表示
    const oldCustomValue = localStorage.getItem(LOCALSTORAGE_ACTIVE_TIMER_KEY) ? JSON.parse(localStorage.getItem(LOCALSTORAGE_ACTIVE_TIMER_KEY))?.offsetMinutes : '';
    if (typeof oldCustomValue === 'number') customMinutesInput.value = oldCustomValue;

  } else {
    statusEl.textContent = '通知はセットされていません。';
  }
}


function handleTimerAction(type, depletionTime) {
  if (type === 'depletion') {
    if (activeTimerInfo && activeTimerInfo.type === 'depletion' && activeTimerInfo.depletionTime === depletionTime) {
      clearActiveTimer();
    } else {
      setTimer('depletion', depletionTime);
    }
    updateTimerUI(depletionTime);
  }
  // カスタムタイマーのセット/解除は setCustomButton の onclick 内で直接処理
}

function setTimer(type, depletionTime, customOffsetMinutes = null) {
  clearActiveTimer(); // 既存のタイマーをクリア
  let offsetMilliseconds = 0;
  let actualOffsetMinutes = 0;

  if (type === 'custom') {
    if (customOffsetMinutes === null || isNaN(customOffsetMinutes) || customOffsetMinutes < 0) {
      alert('カスタム通知には有効な分数（0以上）を指定してください。');
      return;
    }
    actualOffsetMinutes = parseInt(customOffsetMinutes, 10);
    offsetMilliseconds = actualOffsetMinutes * 60 * 1000;
  } else if (type === 'depletion') {
    actualOffsetMinutes = 0; // 枯渇時はオフセット0分
  } else {
    console.error('未対応のタイマータイプ:', type);
    return;
  }

  const targetTime = depletionTime - offsetMilliseconds;

  if (targetTime <= Date.now()) {
    alert('通知時刻が現在時刻より過去になります。タイマーはセットされませんでした。');
    activeTimerInfo = null; //念のため
    updateTimerUI(depletionTime); // UIをリフレッシュしてボタンのアクティブ状態などを解除
    return;
  }

  // setTimeout の上限値 (約24.8日をミリ秒で表現)
  // 2147483647 (32-bit signed integer max value)
  const MAX_TIMEOUT_DELAY = 2147483647;
  const delayMilliseconds = targetTime - Date.now();

  // ▼▼▼ 遅延時間チェックの追加 ▼▼▼
  if (delayMilliseconds > MAX_TIMEOUT_DELAY) {
    alert(`通知時刻が遠すぎるため (${(delayMilliseconds / (1000 * 60 * 60 * 24)).toFixed(1)}日後)、タイマーを設定できません。ブラウザの制限により、約24日後までのタイマーが設定可能です。`);
    activeTimerInfo = null;
    updateTimerUI(depletionTime);
    return;
  }

  const timeoutId = setTimeout(() => {
    triggerNotification(type, depletionTime, actualOffsetMinutes);
    clearActiveTimer(); // 通知後はクリア
    loadAndProcessDataForCurrentHG(); // UIと予測を再評価
  }, targetTime - Date.now());

  activeTimerInfo = { type, timeoutId, targetTime, depletionTime, offsetMinutes: (type === 'custom' ? actualOffsetMinutes : undefined) };
  // localStorageにはtimeoutIdは保存しない
  localStorage.setItem(LOCALSTORAGE_ACTIVE_TIMER_KEY, JSON.stringify({
    type,
    targetTime,
    depletionTime,
    offsetMinutes: activeTimerInfo.offsetMinutes
  }));
  console.log(`${type === 'custom' ? actualOffsetMinutes + '分前' : '枯渇時'}のタイマーをセット: ${formatDateTimeSmart(targetTime)}`);
}

function clearActiveTimer() {
  if (activeTimerInfo && activeTimerInfo.timeoutId) {
    clearTimeout(activeTimerInfo.timeoutId);
  }
  if (activeTimerInfo) { // activeTimerInfo が null でない場合のみログ出力
    console.log(`${activeTimerInfo.type === 'custom' ? activeTimerInfo.offsetMinutes + '分前' : '枯渇時'} のタイマーを解除しました。`);
  }
  activeTimerInfo = null;
  localStorage.removeItem(LOCALSTORAGE_ACTIVE_TIMER_KEY);
}

function triggerNotification(type, depletionTime, offsetMinutesUsed = null) {
  let speechMsg, desktopTitle, desktopBody;

  if (type === 'depletion' || (type === 'custom' && offsetMinutesUsed === 0)) {
    speechMsg = `ポーションが枯渇しました。予測時刻は ${formatDateTimeSmart(depletionTime)} でした。`;
    desktopTitle = 'ポーション枯渇';
    desktopBody = `ポーションが枯渇しました (${formatDateTimeSmart(depletionTime)})。`;
  } else if (type === 'custom' && offsetMinutesUsed > 0) {
    speechMsg = `まもなくポーションが枯渇します。${offsetMinutesUsed}分前です。予測時刻は ${formatDateTimeSmart(depletionTime)} です。`;
    desktopTitle = `ポーション枯渇予測 (${offsetMinutesUsed}分前)`;
    desktopBody = `ポーションが約${offsetMinutesUsed}分後に枯渇する見込みです (${formatDateTimeSmart(depletionTime)})。`;
  } else {
    console.warn("不明な通知タイプまたはオフセット:", type, offsetMinutesUsed);
    speechMsg = '通知時刻です。'; // フォールバック
    desktopTitle = '通知';
    desktopBody = '設定された時刻になりました。';
  }

  if (document.visibilityState === 'visible') {
    speak(speechMsg);
  }
  showDesktopNotification(desktopTitle, desktopBody);
}

function loadTimerFromStorage() {
  const storedTimerJSON = localStorage.getItem(LOCALSTORAGE_ACTIVE_TIMER_KEY);
  if (storedTimerJSON) {
    try {
      const storedTimer = JSON.parse(storedTimerJSON);
      if (storedTimer.type && storedTimer.targetTime && storedTimer.depletionTime) {
        // targetTime と depletionTime の両方が未来であるか確認
        if (storedTimer.targetTime > Date.now() && storedTimer.depletionTime > Date.now()) {
          let offsetMinsToRestore = undefined;
          if (storedTimer.type === 'custom') {
            offsetMinsToRestore = storedTimer.offsetMinutes;
            if (typeof offsetMinsToRestore !== 'number' || offsetMinsToRestore < 0) {
              console.warn("ストレージのカスタムオフセットが無効。タイマーをクリアします。");
              localStorage.removeItem(LOCALSTORAGE_ACTIVE_TIMER_KEY);
              return; // ここで処理を中断
            }
          }
          // setTimer内でactiveTimerInfoが設定され、localStorageにも再保存される
          setTimer(storedTimer.type, storedTimer.depletionTime, offsetMinsToRestore);
          console.log("保存されたタイマーを復元・再設定しました。");
        } else {
          console.log("保存されたタイマーの通知時刻または枯渇時刻が過去のためクリアします。");
          localStorage.removeItem(LOCALSTORAGE_ACTIVE_TIMER_KEY);
        }
      } else {
        console.log("保存されたタイマー情報が不完全なためクリアします。");
        localStorage.removeItem(LOCALSTORAGE_ACTIVE_TIMER_KEY);
      }
    } catch (e) {
      console.error("ローカルストレージのタイマー情報解析エラー:", e);
      localStorage.removeItem(LOCALSTORAGE_ACTIVE_TIMER_KEY);
    }
  }
}

async function calculatePredictionAndConsumptionRate(records, hgIdToUpdate) {
  const predictionMessageArea = document.getElementById('predictionMessageArea');
  const consumptionRateDisplay = document.getElementById('consumptionRateDisplay');
  const timerControlsContainer = document.getElementById('timerNotificationControlsContainer');

  const baseReturn = {
    prediction: null,
    regressionParams: null,
    residualsStdDev: 0,
    consumptionRatePerMin: null
  };

  predictionMessageArea.innerHTML = ''; // メッセージエリアを初期化
  const hgData = await getHuntingGroundById(hgIdToUpdate);
  let existingDbRate = null;
  if (hgData && hgData.lastCalculatedConsumptionRate !== null && hgData.lastCalculatedConsumptionRate !== undefined) {
    existingDbRate = hgData.lastCalculatedConsumptionRate;
  }

  // 1. 記録がない場合
  if (!records || records.length === 0) {
    predictionMessageArea.innerHTML = '<p>記録がありません。</p>';
    consumptionRateDisplay.textContent = existingDbRate ? `保存された消費速度: 約 ${existingDbRate.toFixed(2)} 個/分` : `消費速度: 計算不可`;
    if (timerControlsContainer) timerControlsContainer.style.display = 'none';
    updateTimerUI(null);
    return { ...baseReturn, consumptionRatePerMin: existingDbRate };
  }

  const sortedRecords = [...records].sort((a, b) => a.timestamp - b.timestamp);

  // 2. 最後に数量が増加したインデックスを探す
  let lastIncreaseIndex = -1;
  for (let i = 1; i < sortedRecords.length; i++) {
    if (sortedRecords[i].quantity > sortedRecords[i - 1].quantity) {
      lastIncreaseIndex = i;
    }
  }

  // 3. 計算対象データとフラグを設定
  let recordsForCalculation;
  const increaseDetected = lastIncreaseIndex !== -1;
  if (increaseDetected) {
    recordsForCalculation = sortedRecords.slice(lastIncreaseIndex);
  } else {
    recordsForCalculation = sortedRecords;
  }
  const n = recordsForCalculation.length;
  const latestRecord = recordsForCalculation[n - 1];

  // 4. 状況に応じて処理を分岐
  if (increaseDetected) {
    // --- 4a. 増加が検出された場合 ---
    if (n < 3) {
      // --- 4a-1. データが3件未満の場合 (暫定予測 or 待機) ---
      const pointsNeeded = 3 - n;
      const increaseTimeStr = formatDateTimeSmart(recordsForCalculation[0].timestamp);

      if (existingDbRate !== null && existingDbRate > 0) {
        // --- 以前の速度で暫定予測 ---
        const ratePerSec = existingDbRate / 60;
        const firstTimestampSeconds = recordsForCalculation[0].timestamp / 1000;
        const latestElapsedSeconds = (latestRecord.timestamp / 1000) - firstTimestampSeconds;
        const m_sec = -ratePerSec;
        // 暫定予測線が最新の点を通過するように切片(c_sec)を計算
        const c_sec = latestRecord.quantity - m_sec * latestElapsedSeconds;
        const regressionParams = { m_sec, c_sec, firstTimestampSeconds };

        // 枯渇時刻を計算
        const depletionTimestampRelativeSec = -c_sec / m_sec;
        const depletionTime = (firstTimestampSeconds + depletionTimestampRelativeSec) * 1000;
        const remainingTimeFormatted = formatRemainingTime(depletionTime - Date.now());

        let message = `<p>ポーションが増加しました (${increaseTimeStr})。<strong>以前の速度 (約 ${existingDbRate.toFixed(2)} 個/分)</strong> で暫定予測します。</p>`;
        message += `<p>枯渇は <strong>${remainingTimeFormatted}</strong> の見込みです。(暫定予測時刻: ${formatDateTimeSmart(depletionTime)})</p>`;
        message += `<p class="confidence-interval" style="font-size:0.9em; color:#555;">※あと ${pointsNeeded} 回記録すると、新しい消費ペースで再計算されます。</p>`;

        predictionMessageArea.innerHTML = message;
        consumptionRateDisplay.textContent = `以前の消費速度: 約 ${existingDbRate.toFixed(2)} 個/分 (暫定使用中)`;

        // 暫定予測結果を返し、タイマーUIを更新
        const isDepleted = depletionTime <= Date.now();
        updateTimerUI(isDepleted ? null : depletionTime);
        return { prediction: { depleted: isDepleted, depletionTime }, regressionParams, residualsStdDev: 0, consumptionRatePerMin: existingDbRate };

      } else {
        // --- 以前の速度がないため待機 ---
        let message = `<p>ポーションが増加しました (${increaseTimeStr})。</p>`;
        message += `<p>あと ${pointsNeeded} 回記録すると予測を開始します。(以前の速度記録なし)</p>`;

        predictionMessageArea.innerHTML = message;
        consumptionRateDisplay.textContent = `消費速度: 計算不可 (記録不足)`;
        updateTimerUI(null);
        return { ...baseReturn, consumptionRateMin: existingDbRate };
      }
    } else {
      // --- 4a-2. データが3件以上の場合 (線形回帰へ) ---
      console.log(`増加後、${n} 件のデータで新しい速度を計算します。`);
      // このまま下の線形回帰処理に進む
    }
  } else {
    // --- 4b. 増加が検出されなかった場合 ---
    if (n < 2) {
      // --- 4b-1. データが2件未満の場合 (待機) ---
      predictionMessageArea.innerHTML = '<p>まだ予測できません。最低2つの記録が必要です。</p>';
      consumptionRateDisplay.textContent = existingDbRate ? `保存された消費速度: 約 ${existingDbRate.toFixed(2)} 個/分 (記録不足)` : `消費速度: 計算不可 (記録不足)`;
      updateTimerUI(null);
      return { ...baseReturn, consumptionRatePerMin: existingDbRate };
    } else {
      // --- 4b-2. データが2件以上の場合 (線形回帰へ) ---
      console.log(`増加なし、${n} 件のデータで速度を計算します。`);
      // このまま下の線形回帰処理に進む
    }
  }

  // --- 5. 線形回帰による計算 (4a-2 または 4b-2 からここに来る) ---
  const firstTimestampSeconds = recordsForCalculation[0].timestamp / 1000;
  const xValues = recordsForCalculation.map(r => (r.timestamp / 1000) - firstTimestampSeconds);
  const yValues = recordsForCalculation.map(r => r.quantity);

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xValues[i]; sumY += yValues[i]; sumXY += xValues[i] * yValues[i]; sumX2 += xValues[i] * xValues[i];
  }

  const m_sec_denominator = (n * sumX2 - sumX * sumX);
  const m_sec = m_sec_denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / m_sec_denominator;
  const c_sec = (sumY - m_sec * sumX) / n;
  const regressionParams = { m_sec, c_sec, firstTimestampSeconds };

  let newlyCalculatedRate = null;
  if (m_sec < 0) {
    newlyCalculatedRate = Math.abs(m_sec * 60);
    consumptionRateDisplay.textContent = `現在の狩り場の消費速度: 約 ${newlyCalculatedRate.toFixed(2)} 個/分`;
    if (increaseDetected) {
        consumptionRateDisplay.textContent += ` (新しいデータで計算)`;
    }
  } else {
    consumptionRateDisplay.textContent = `現在の狩り場の消費速度: 計算不可 (消費なし/増加傾向)`;
  }
  await updateHuntingGroundConsumptionRate(hgIdToUpdate, newlyCalculatedRate);

  let residualsStdDev = 0;
  if (n > 2) {
    let sumSquaredResiduals = 0;
    for (let i = 0; i < n; i++) {
      const predictedY = m_sec * xValues[i] + c_sec;
      sumSquaredResiduals += Math.pow(yValues[i] - predictedY, 2);
    }
    residualsStdDev = Math.sqrt(sumSquaredResiduals / (n - 2));
  }

  let predictionText = '';
  let depletionTime = null;
  let depleted = false;

  if (m_sec >= 0) {
    predictionText = '<p>ポーションが消費されていないか、増えています。枯渇予測はできません。</p>';
  } else {
    const depletionTimestampRelativeSec = -c_sec / m_sec;
    depletionTime = (firstTimestampSeconds + depletionTimestampRelativeSec) * 1000;
    if (depletionTime <= latestRecord.timestamp) {
      predictionText = `<p>予測によると、ポーションは既に枯渇しているか、最終記録(${formatDateTimeSmart(latestRecord.timestamp)}: ${latestRecord.quantity}個)直後に枯渇したと考えられます。</p>`;
      depleted = true;
    } else {
      const nowMilliseconds = new Date().getTime();
      const remainingMilliseconds = depletionTime - nowMilliseconds;
      const remainingTimeFormatted = formatRemainingTime(remainingMilliseconds);
      predictionText = `<p>現在のペースで消費すると、ポーションは<strong> ${remainingTimeFormatted} </strong>に枯渇する見込みです。</p>`;
      predictionText += `<p>(予測枯渇時刻: ${formatDateTimeSmart(depletionTime)})</p>`;
      if (n > 2 && residualsStdDev > 0.1) {
          const qtyAtDepletionLower = residualsStdDev;
          const qtyAtDepletionUpper = -residualsStdDev;
          const depletionTimeLowerSec = (- (c_sec + qtyAtDepletionLower)) / m_sec;
          const depletionTimeUpperSec = (- (c_sec + qtyAtDepletionUpper)) / m_sec;
          const depletionTimeLower = (firstTimestampSeconds + depletionTimeLowerSec) * 1000;
          const depletionTimeUpper = (firstTimestampSeconds + depletionTimeUpperSec) * 1000;

          if (depletionTimeLower < depletionTimeUpper && depletionTimeLower > nowMilliseconds) {
            predictionText += `<p class="confidence-interval" style="font-size:0.9em; color:#555;">(予測のばらつきを考慮すると、枯渇は ${formatDateTimeSmart(depletionTimeLower)} から ${formatDateTimeSmart(depletionTimeUpper)} の間になる可能性があります。)</p>`;
          }
      }
    }
  }
  predictionMessageArea.innerHTML = predictionText;

  // タイマーUI更新
  updateTimerUI(depletionTime && !depleted && depletionTime > Date.now() ? depletionTime : null);

  return { prediction: depletionTime ? { depleted, depletionTime } : null, regressionParams, residualsStdDev, consumptionRatePerMin: newlyCalculatedRate };
}

function renderChart(records, predictionResult) {
  const ctx = document.getElementById('potionChart').getContext('2d');
  if (chartInstance) { chartInstance.destroy(); }
  if (!records || records.length === 0) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); return;
  }

  const sortedRecords = [...records].sort((a, b) => a.timestamp - b.timestamp);
  const now = new Date().getTime();
  const minFutureSpanFromNow = 1 * 3600 * 1000;
  const defaultFutureSpan = 24 * 3600 * 1000;
  const marginAfterEvent = 1 * 3600 * 1000;
  let targetEndTime = 0;

  if (predictionResult && predictionResult.prediction && predictionResult.prediction.depletionTime) {
    const { depletionTime } = predictionResult.prediction;
    if (depletionTime > now) {
      targetEndTime = depletionTime + marginAfterEvent;
    } else {
      targetEndTime = now + defaultFutureSpan;
    }
  } else {
    targetEndTime = now + defaultFutureSpan;
  }

  let lastChartTimestamp = Math.max(targetEndTime, now + minFutureSpanFromNow);
  if (sortedRecords.length > 0) {
    lastChartTimestamp = Math.max(lastChartTimestamp, sortedRecords[sortedRecords.length - 1].timestamp + minFutureSpanFromNow);
  }

  const datasets = [{
    label: '実際のポーション数量', data: sortedRecords.map(r => ({ x: r.timestamp, y: r.quantity })),
    borderColor: 'rgb(26, 115, 232)', backgroundColor: 'rgba(26, 115, 232, 0.1)',
    tension: 0.1, fill: false, pointRadius: 5, pointHoverRadius: 7,
  }];

  // 予測線を描画する条件: regressionParams があり、かつ傾き(m_sec)が負の場合
  if (predictionResult && predictionResult.regressionParams && predictionResult.regressionParams.m_sec < 0) {
    const { m_sec, c_sec, firstTimestampSeconds } = predictionResult.regressionParams;
    const residualsStdDev = predictionResult.residualsStdDev || 0;
    const predictionLine = [], upperBand = [], lowerBand = [];

    // const firstChartTimestamp = sortedRecords[0].timestamp; // ★不要になったため削除 or コメントアウト
    const extendedLastChartTimestamp = Math.max(lastChartTimestamp, predictionResult.prediction?.depletionTime || 0);
    const numPredictionPoints = 100;

    // ★変更点: 予測線の開始点を、回帰計算で使ったデータの開始点 (firstTimestampSeconds) に合わせる (ミリ秒に変換)
    const actualStartForPrediction = firstTimestampSeconds * 1000;

    const step = (extendedLastChartTimestamp - actualStartForPrediction) / Math.max(1, (numPredictionPoints - 1));

    // extendedLastChartTimestamp が actualStartForPrediction より大きい場合のみ描画
    if (extendedLastChartTimestamp > actualStartForPrediction) {
      for (let i = 0; i < numPredictionPoints; i++) {
        const currentTs = actualStartForPrediction + i * step;

        // ★変更点: 予測開始点 (actualStartForPrediction) より前の点は描画しないようにする
        // 最初の点(i=0)は必ず描画し、それ以降は開始点より後かチェック
        if (currentTs < actualStartForPrediction && i > 0) continue;

        const currentElapsedSeconds = (currentTs / 1000) - firstTimestampSeconds;
        const predictedQty = Math.max(0, m_sec * currentElapsedSeconds + c_sec);
        predictionLine.push({ x: currentTs, y: predictedQty });
        if (sortedRecords.length > 2 && residualsStdDev > 0.01) {
          upperBand.push({ x: currentTs, y: Math.max(0, predictedQty + residualsStdDev) });
          lowerBand.push({ x: currentTs, y: Math.max(0, predictedQty - residualsStdDev) });
        }
      }
    }


    datasets.push({
      label: '予測枯渇線', data: predictionLine, borderColor: 'rgb(217, 48, 37)',
      borderDash: [6, 3], tension: 0.1, fill: false, pointRadius: 0,
    });
    if (lowerBand.length > 0 && upperBand.length > 0) {
      datasets.push({
        label: '予測範囲', data: upperBand, borderColor: 'rgba(251, 188, 5, 0.3)', backgroundColor: 'rgba(251, 188, 5, 0.1)',
        tension: 0.1, fill: '+1', pointRadius: 0,
      });
      datasets.push({
        label: '予測範囲_lower_hidden', data: lowerBand, showInLegend: false, fill: false, pointRadius: 0, borderColor: 'transparent'
      });
    }
  }

  const minX = (sortedRecords.length > 0) ? sortedRecords[0].timestamp : now - minFutureSpanFromNow;
  chartInstance = new Chart(ctx, {
    type: 'line', data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time', time: { unit: 'hour', displayFormats: { hour: 'HH:mm', day: 'MM/dd HH:mm' }, tooltipFormat: 'yyyy/MM/dd HH:mm:ss' },
          ticks: { callback: (value) => formatDateTimeSmart(value), maxRotation: 70, minRotation: 0, autoSkip: true, maxTicksLimit: 10 },
          title: { display: true, text: '時刻', font: { size: 14 } }, grid: { color: '#e0e0e0' }, min: minX, max: lastChartTimestamp
        },
        y: { beginAtZero: true, title: { display: true, text: 'ポーション数量', font: { size: 14 } }, grid: { color: '#e0e0e0' } }
      },
      plugins: {
        tooltip: {
          mode: 'index', intersect: false, backgroundColor: 'rgba(0,0,0,0.8)', titleFont: { size: 14 }, bodyFont: { size: 12 }, padding: 10,
          callbacks: { title: (tooltipItems) => tooltipItems.length > 0 ? formatDateTimeSmart(tooltipItems[0].parsed.x) : '' }
        },
        legend: { position: 'bottom', labels: { font: { size: 12 }, filter: (item) => item.text !== '予測範囲_lower_hidden' } }
      },
      interaction: { mode: 'nearest', axis: 'x', intersect: false }
    }
  });
}

function initMainHuntingGroundDropdown() {
  mainHgDropdownContainerEl = document.getElementById('mainHuntingGroundDropdownContainer');
  mainHgDropdownSelectedEl = document.getElementById('mainHgDropdownSelected');
  mainHgDropdownSelectedNameEl = document.getElementById('mainHgDropdownSelectedName');
  mainHgDropdownOptionsEl = document.getElementById('mainHgDropdownOptions');
  mainHgDropdownSelectedRateEl = document.getElementById('mainHgDropdownSelectedRate'); // ★追加

  if (!mainHgDropdownContainerEl || !mainHgDropdownSelectedEl || !mainHgDropdownSelectedNameEl || !mainHgDropdownOptionsEl) {
    console.error('Main hunting ground dropdown elements not found!');
    return;
  }

  mainHgDropdownSelectedEl.addEventListener('click', () => {
    const isOpen = mainHgDropdownContainerEl.classList.toggle('open');
    mainHgDropdownSelectedEl.setAttribute('aria-expanded', isOpen.toString());
    if (isOpen) {
      loadHuntingGroundsForMainDropdown(true);
    }
  });

  document.addEventListener('click', (event) => {
    if (!mainHgDropdownContainerEl.contains(event.target) && mainHgDropdownContainerEl.classList.contains('open')) {
      mainHgDropdownContainerEl.classList.remove('open');
      mainHgDropdownSelectedEl.setAttribute('aria-expanded', 'false');
    }
  });

  mainHgDropdownSelectedEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const isOpen = mainHgDropdownContainerEl.classList.toggle('open');
      mainHgDropdownSelectedEl.setAttribute('aria-expanded', isOpen.toString());
      if (isOpen) loadHuntingGroundsForMainDropdown(true);
    } else if (event.key === 'Escape' && mainHgDropdownContainerEl.classList.contains('open')) {
      mainHgDropdownContainerEl.classList.remove('open');
      mainHgDropdownSelectedEl.setAttribute('aria-expanded', 'false');
    }
  });
}

async function loadHuntingGroundsForMainDropdown(focusFirst = false) {
  if (!db || !mainHgDropdownOptionsEl) return;

  const tx = db.transaction(HUNTING_GROUND_STORE_NAME, 'readonly');
  const store = tx.objectStore(HUNTING_GROUND_STORE_NAME);
  let allHGs = await store.getAll();
  await tx.done;

  mainHgDropdownOptionsEl.innerHTML = '';

  const actualUnsetHGServer = await getHuntingGroundByName(UNSET_HUNTING_GROUND_NAME);
  const actualUnsetId = actualUnsetHGServer ? actualUnsetHGServer.id : UNSET_HUNTING_GROUND_ID;

  const unsetHGForDisplay = allHGs.find(hg => hg.id === actualUnsetId) || { id: actualUnsetId, name: UNSET_HUNTING_GROUND_NAME, lastCalculatedConsumptionRate: null };
  const userDefinedHGs = allHGs.filter(hg => hg.id !== actualUnsetId);

  let displayList = [unsetHGForDisplay, ...userDefinedHGs.sort((a, b) => a.name.localeCompare(b.name))];

  const idMap = new Map();
  displayList.forEach(hg => idMap.set(hg.id, hg));
  displayList = Array.from(idMap.values());
  const unsetIndex = displayList.findIndex(hg => hg.id === actualUnsetId);
  if (unsetIndex > 0) {
    const [unsetEntry] = displayList.splice(unsetIndex, 1);
    displayList.unshift(unsetEntry);
  }

  displayList.forEach((hg, index) => {
    const optionDiv = document.createElement('div');
    optionDiv.classList.add('custom-dropdown-option');
    optionDiv.dataset.id = hg.id;
    optionDiv.setAttribute('role', 'option');
    optionDiv.setAttribute('tabindex', '-1');

    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('dropdown-option-content-wrapper');

    const detailsDiv = document.createElement('div');
    detailsDiv.classList.add('dropdown-option-details');

    const nameSpan = document.createElement('span');
    nameSpan.classList.add('dropdown-option-name');
    nameSpan.textContent = hg.name;

    const rateSpan = document.createElement('span');
    rateSpan.classList.add('dropdown-option-rate');
    let rateText = "消費: -";
    if (hg.lastCalculatedConsumptionRate !== null && hg.lastCalculatedConsumptionRate !== undefined && !isNaN(hg.lastCalculatedConsumptionRate)) {
      rateText = `消費: ${hg.lastCalculatedConsumptionRate.toFixed(2)} 個/分`;
    }
    rateSpan.textContent = rateText;

    detailsDiv.appendChild(nameSpan);
    detailsDiv.appendChild(rateSpan);
    contentWrapper.appendChild(detailsDiv);

    if (hg.id !== actualUnsetId) {
      const actionsDiv = document.createElement('div');
      actionsDiv.classList.add('dropdown-option-actions');

      const deleteBtn = document.createElement('button');
      deleteBtn.classList.add('dropdown-option-delete-btn');
      deleteBtn.innerHTML = '&times;';
      deleteBtn.setAttribute('aria-label', `狩り場「${hg.name}」を削除`);
      deleteBtn.title = `狩り場「${hg.name}」を削除`;

      deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (mainHgDropdownContainerEl.classList.contains('open')) {
          mainHgDropdownContainerEl.classList.remove('open');
          mainHgDropdownSelectedEl.setAttribute('aria-expanded', 'false');
        }
        await requestDeleteHuntingGround(hg.id, hg.name);
      });
      actionsDiv.appendChild(deleteBtn);
      contentWrapper.appendChild(actionsDiv);
    }
    optionDiv.appendChild(contentWrapper);

    if (hg.id === currentHuntingGroundId) {
      optionDiv.classList.add('selected');
      optionDiv.setAttribute('aria-selected', 'true');
    } else {
      optionDiv.setAttribute('aria-selected', 'false');
    }

    optionDiv.addEventListener('click', async (event) => {
      if (event.target.closest('.dropdown-option-delete-btn')) {
        return;
      }
      mainHgDropdownContainerEl.classList.remove('open');
      mainHgDropdownSelectedEl.setAttribute('aria-expanded', 'false');
      if (currentHuntingGroundId !== hg.id) {
        currentHuntingGroundId = hg.id;
        localStorage.setItem(LOCALSTORAGE_CURRENT_HG_ID_KEY, currentHuntingGroundId.toString());
        await loadAndProcessDataForCurrentHG();
      }
      mainHgDropdownSelectedEl.focus();
    });

    optionDiv.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!event.target.closest('.dropdown-option-delete-btn')) {
          optionDiv.click();
        }
      }
    });
    mainHgDropdownOptionsEl.appendChild(optionDiv);

    if (focusFirst && index === 0) {
      optionDiv.focus();
    }
  });
}


async function openHuntingGroundModal() {
  await loadHuntingGroundsForModal();
  document.getElementById('huntingGroundModal').style.display = 'block';
}

function closeHuntingGroundModal() {
  document.getElementById('huntingGroundModal').style.display = 'none';
}

async function loadHuntingGroundsForModal() {
  await initDB();
  const tx = db.transaction(HUNTING_GROUND_STORE_NAME, 'readonly');
  const store = tx.objectStore(HUNTING_GROUND_STORE_NAME);
  const allHGs = await store.getAll();
  await tx.done;

  const hgListEl = document.getElementById('huntingGroundList');
  const noHGsMessageEl = document.getElementById('noHuntingGroundsMessage');
  hgListEl.innerHTML = '';

  const actualUnsetHGServer = await getHuntingGroundByName(UNSET_HUNTING_GROUND_NAME);
  const actualUnsetId = actualUnsetHGServer ? actualUnsetHGServer.id : UNSET_HUNTING_GROUND_ID;

  const unsetHGForDisplay = allHGs.find(hg => hg.id === actualUnsetId) || { id: actualUnsetId, name: UNSET_HUNTING_GROUND_NAME, lastCalculatedConsumptionRate: null };
  const userDefinedHGs = allHGs.filter(hg => hg.id !== actualUnsetId);

  const displayList = [unsetHGForDisplay, ...userDefinedHGs.sort((a, b) => a.name.localeCompare(b.name))];
  const idMap = new Map();
  displayList.forEach(hg => idMap.set(hg.id, hg));
  const uniqueDisplayList = Array.from(idMap.values());
  const unsetIndex = uniqueDisplayList.findIndex(hg => hg.id === actualUnsetId);
  if (unsetIndex > 0) {
    const [unsetEntry] = uniqueDisplayList.splice(unsetIndex, 1);
    uniqueDisplayList.unshift(unsetEntry);
  }

  if (uniqueDisplayList.length <= 1 && uniqueDisplayList[0]?.id === actualUnsetId) {
    noHGsMessageEl.style.display = 'block';
  } else {
    noHGsMessageEl.style.display = 'none';
  }

  uniqueDisplayList.forEach(hg => {
    const listItem = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = hg.name;
    nameSpan.style.fontWeight = (hg.id === currentHuntingGroundId) ? 'bold' : 'normal';
    listItem.appendChild(nameSpan);

    const detailsSpan = document.createElement('span');
    let rateText = "-";
    if (hg.lastCalculatedConsumptionRate !== null && hg.lastCalculatedConsumptionRate !== undefined && !isNaN(hg.lastCalculatedConsumptionRate)) {
      rateText = `${hg.lastCalculatedConsumptionRate.toFixed(2)} 個/分`;
    }
    const consumptionSpan = document.createElement('span');
    consumptionSpan.className = 'hg-consumption-rate';
    consumptionSpan.textContent = `消費: ${rateText}`;
    detailsSpan.appendChild(consumptionSpan);
    listItem.onclick = () => selectHuntingGround(hg.id);

    if (hg.id !== actualUnsetId) {
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '削除';
      deleteBtn.classList.add('small-btn', 'danger');
      deleteBtn.style.marginLeft = '8px'; // Add some space
      deleteBtn.onclick = (e) => { e.stopPropagation(); requestDeleteHuntingGround(hg.id, hg.name); };
      detailsSpan.appendChild(deleteBtn);
    }
    listItem.appendChild(detailsSpan);
    hgListEl.appendChild(listItem);
  });

  const currentHG = await getHuntingGroundById(currentHuntingGroundId);
  document.getElementById('currentHuntingGroundDisplay').textContent = currentHG ? currentHG.name : UNSET_HUNTING_GROUND_NAME;
}

async function addHuntingGroundHandler() {
  const nameInput = document.getElementById('newHuntingGroundName');
  const name = nameInput.value.trim();
  if (!name) { alert('狩り場名を入力してください。'); return; }
  if (name === UNSET_HUNTING_GROUND_NAME) { alert(`「${UNSET_HUNTING_GROUND_NAME}」という名前は予約されているため使用できません。`); return; }

  await initDB();
  try {
    const existing = await getHuntingGroundByName(name);
    if (existing) { alert('その狩り場名は既に使用されています。'); return; }

    const tx = db.transaction(HUNTING_GROUND_STORE_NAME, 'readwrite');
    const store = tx.objectStore(HUNTING_GROUND_STORE_NAME);
    const newHgId = await store.add({ name: name, lastCalculatedConsumptionRate: null });
    await tx.done;
    nameInput.value = '';

    const allHGsInDb = await db.getAll(HUNTING_GROUND_STORE_NAME);
    if (allHGsInDb.filter(hg => hg.name !== UNSET_HUNTING_GROUND_NAME).length === 1) {
      await selectHuntingGround(newHgId);
    } else {
      await loadHuntingGroundsForModal();
    }
    await loadHuntingGroundsForMainDropdown();
  } catch (error) {
    console.error('狩り場の追加に失敗しました:', error); alert('狩り場の追加に失敗しました。');
  }
}

async function getHuntingGroundById(id) {
  if (id === null || id === undefined) return null;
  await initDB();
  if (!db) { console.error("DB not initialized for getHuntingGroundById"); return null; }

  let hg = await db.get(HUNTING_GROUND_STORE_NAME, id);

  const actualUnsetHGServer = await getHuntingGroundByName(UNSET_HUNTING_GROUND_NAME);
  const actualUnsetId = actualUnsetHGServer ? actualUnsetHGServer.id : UNSET_HUNTING_GROUND_ID;

  if (id === actualUnsetId && (!hg || hg.name !== UNSET_HUNTING_GROUND_NAME)) {
    if (actualUnsetHGServer) return actualUnsetHGServer;
  }
  return hg;
}


async function selectHuntingGround(hgId) {
  const hg = await getHuntingGroundById(hgId);
  const actualUnsetHGServer = await getHuntingGroundByName(UNSET_HUNTING_GROUND_NAME);
  const actualUnsetId = actualUnsetHGServer ? actualUnsetHGServer.id : UNSET_HUNTING_GROUND_ID;

  if (!hg) {
    console.warn(`狩り場ID ${hgId} が見つかりません。「${UNSET_HUNTING_GROUND_NAME}」に戻します。`);
    currentHuntingGroundId = actualUnsetId;
  } else {
    currentHuntingGroundId = hg.id;
  }

  localStorage.setItem(LOCALSTORAGE_CURRENT_HG_ID_KEY, currentHuntingGroundId.toString());
  await loadAndProcessDataForCurrentHG(); // This will trigger prediction and UI update for timer
  await loadHuntingGroundsForModal();
  closeHuntingGroundModal();
}

async function requestDeleteHuntingGround(hgId, hgName) {
  const targetHg = await getHuntingGroundById(hgId);
  const actualUnsetHGServer = await getHuntingGroundByName(UNSET_HUNTING_GROUND_NAME);
  const actualUnsetId = actualUnsetHGServer ? actualUnsetHGServer.id : UNSET_HUNTING_GROUND_ID;

  if (targetHg && targetHg.id === actualUnsetId) {
    alert(`「${UNSET_HUNTING_GROUND_NAME}」の狩り場は削除できません。`); return;
  }

  if (confirm(`狩り場「${hgName}」を削除しますか？\nこの狩り場に関連する全てのポーション記録も削除されます。この操作は取り消せません。`)) {
    await deleteHuntingGround(hgId);
  }
}

async function deleteHuntingGround(hgIdToDelete) {
  await initDB();
  const hgRecord = await getHuntingGroundById(hgIdToDelete);
  const actualUnsetHGServer = await getHuntingGroundByName(UNSET_HUNTING_GROUND_NAME);
  const actualUnsetId = actualUnsetHGServer ? actualUnsetHGServer.id : UNSET_HUNTING_GROUND_ID;

  if (hgRecord && hgRecord.id === actualUnsetId) {
    alert(`「${UNSET_HUNTING_GROUND_NAME}」の狩り場は削除できません。`);
    return;
  }

  const tx = db.transaction([HUNTING_GROUND_STORE_NAME, POTION_LOG_STORE_NAME], 'readwrite');
  const hgStore = tx.objectStore(HUNTING_GROUND_STORE_NAME);
  const logStore = tx.objectStore(POTION_LOG_STORE_NAME);

  try {
    let recordsToDelete = await logStore.index('huntingGroundId_timestamp').getAll(IDBKeyRange.bound([hgIdToDelete, -Infinity], [hgIdToDelete, Infinity]));
    for (const record of recordsToDelete) {
      await logStore.delete(record.id);
    }
    await hgStore.delete(hgIdToDelete);
    await tx.done;

    if (currentHuntingGroundId === hgIdToDelete) {
      currentHuntingGroundId = actualUnsetId;
      localStorage.setItem(LOCALSTORAGE_CURRENT_HG_ID_KEY, currentHuntingGroundId.toString());
      await loadAndProcessDataForCurrentHG();
    } else {
      await loadHuntingGroundsForModal();
    }
    await loadHuntingGroundsForMainDropdown();
    alert('狩り場と関連データが削除されました。');
  } catch (error) {
    console.error('狩り場の削除に失敗:', error); alert('狩り場の削除に失敗しました。');
    if (tx.error && !tx.committed) await tx.abort();
  }
}

async function clearAllUserHuntingGrounds() {
  const actualUnsetHGServer = await getHuntingGroundByName(UNSET_HUNTING_GROUND_NAME);
  const actualUnsetId = actualUnsetHGServer ? actualUnsetHGServer.id : UNSET_HUNTING_GROUND_ID;
  if (!confirm(`「${UNSET_HUNTING_GROUND_NAME}」以外の全ての狩り場と、それらに関連する全ポーション記録を削除しますか？この操作は取り消せません。`)) return;

  await initDB();
  const tx = db.transaction([HUNTING_GROUND_STORE_NAME, POTION_LOG_STORE_NAME], 'readwrite');
  const hgStore = tx.objectStore(HUNTING_GROUND_STORE_NAME);
  const logStore = tx.objectStore(POTION_LOG_STORE_NAME);

  try {
    const allHGs = await hgStore.getAll();
    for (const hg of allHGs) {
      if (hg.id !== actualUnsetId) {
        let recordsToDelete = await logStore.index('huntingGroundId_timestamp').getAll(IDBKeyRange.bound([hg.id, -Infinity], [hg.id, Infinity]));
        for (const record of recordsToDelete) {
          await logStore.delete(record.id);
        }
        await hgStore.delete(hg.id);
      }
    }
    await tx.done;

    if (currentHuntingGroundId !== actualUnsetId) {
      currentHuntingGroundId = actualUnsetId;
      localStorage.setItem(LOCALSTORAGE_CURRENT_HG_ID_KEY, currentHuntingGroundId.toString());
    }
    await loadAndProcessDataForCurrentHG();
    await loadHuntingGroundsForModal();
    alert('「未設定」以外の全ての狩り場と関連データが削除されました。');
  } catch (error) {
    console.error('全狩り場削除に失敗:', error); alert('全狩り場削除に失敗しました。');
    if (tx.error && !tx.committed) await tx.abort();
  }
}


async function updateHuntingGroundConsumptionRate(hgId, rate) {
  if (hgId === null || hgId === undefined) return;
  await initDB();
  const tx = db.transaction(HUNTING_GROUND_STORE_NAME, 'readwrite');
  const store = tx.objectStore(HUNTING_GROUND_STORE_NAME);
  const hg = await store.get(hgId);
  if (hg) {
    hg.lastCalculatedConsumptionRate = (rate === null || isNaN(rate)) ? null : rate;
    await store.put(hg);
  }
  await tx.done;
  if (document.getElementById('huntingGroundModal').style.display === 'block') {
    await loadHuntingGroundsForModal();
  }
  if (mainHgDropdownContainerEl && mainHgDropdownContainerEl.classList.contains('open')) {
    await loadHuntingGroundsForMainDropdown();
  }
}

async function updateCurrentHG_UI() {
  const hg = await getHuntingGroundById(currentHuntingGroundId);
  const hgName = hg ? hg.name : UNSET_HUNTING_GROUND_NAME;

  const inputSectionTitleEl = document.getElementById('inputSectionTitle');
  const clearDataButtonEl = document.getElementById('clearDataButton');
  const titleEl = document.getElementById('appTitle');
  if (hg && hgName !== UNSET_HUNTING_GROUND_NAME) {
    titleEl.textContent = `${hgName}ポーション枯渇予測`;
    inputSectionTitleEl.textContent = `入力 (${hgName})`;
    clearDataButtonEl.textContent = `「${hgName}」の入力履歴削除`;

  } else {
    titleEl.textContent = "ポーション枯渇予測";
    inputSectionTitleEl.textContent = `入力`;
    clearDataButtonEl.textContent = `入力履歴削除`;
  }

  if (mainHgDropdownSelectedNameEl) {
    mainHgDropdownSelectedNameEl.textContent = hgName;
  }

  if (mainHgDropdownSelectedRateEl) {
    let rateText = "消費: -";
    if (hg && hg.lastCalculatedConsumptionRate !== null && hg.lastCalculatedConsumptionRate !== undefined && !isNaN(hg.lastCalculatedConsumptionRate)) {
      rateText = `消費: ${hg.lastCalculatedConsumptionRate.toFixed(2)} 個/分`;
    }
    mainHgDropdownSelectedRateEl.textContent = rateText;
  }

  const currentHGDisplayModalEl = document.getElementById('currentHuntingGroundDisplay');
  if (currentHGDisplayModalEl) currentHGDisplayModalEl.textContent = hgName;
}

async function loadAndProcessDataForCurrentHG() {
  const quantityInput = document.getElementById('potionQuantity');
  const lastQuantity = localStorage.getItem(LOCALSTORAGE_LAST_QUANTITY_KEY);
  if (lastQuantity !== null) {
    const parsedLastQuantity = parseInt(lastQuantity, 10);
    if (!isNaN(parsedLastQuantity) && parsedLastQuantity >= 0) {
      quantityInput.value = parsedLastQuantity;
    }
  }

  await initDB();
  await updateCurrentHG_UI();

  const records = await getRecordsForHuntingGround(currentHuntingGroundId);
  displayLogs(records);
  const predictionResult = await calculatePredictionAndConsumptionRate(records, currentHuntingGroundId);
  renderChart(records, predictionResult);

  if (mainHgDropdownOptionsEl && (mainHgDropdownContainerEl.classList.contains('open') || mainHgDropdownOptionsEl.children.length === 0)) {
    await loadHuntingGroundsForMainDropdown();
  }
}

window.onload = async () => {
  await initDB();
  initMainHuntingGroundDropdown();

  await requestNotificationPermission(); // 通知許可を最初に求める
  loadTimerFromStorage(); // 保存されたタイマーがあれば復元・再設定
  setupAudioTestLinks(); // 音声テストリンクは静的なので先にセットアップ

  await loadAndProcessDataForCurrentHG(); // データ読み込みと予測、これによりタイマーUIも更新される

  window.onclick = function (event) {
    const modal = document.getElementById('huntingGroundModal');
    if (event.target == modal) {
      closeHuntingGroundModal();
    }
  }
};