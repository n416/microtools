// ===============================================
// save-load.js : セーブ/ロード機能スクリプト (修正版)
// ===============================================

document.addEventListener('DOMContentLoaded', () => {
    // ページにセーブ/ロード機能のUIを追加する
    addSaveLoadButton();
    createSaveLoadModal();
    setupModalEventListeners();
});

// --- 定数定義 ---
const SAVE_SLOTS_KEY = 'appSaveSlots_v1';
const DATA_KEYS_TO_SAVE = [
    'equipmentSets_v2',
    'equipmentInventory_v2',
    'inventoryEnhancements_v1'
];
const TOTAL_SLOTS = 5;

/**
 * ヘッダーに「セーブ/ロード」ボタンを追加する
 */
function addSaveLoadButton() {
    const headerButtonsContainer = document.querySelector('.header-buttons');
    if (!headerButtonsContainer) return;

    const saveLoadButton = document.createElement('button');
    saveLoadButton.id = 'save-load-button';
    saveLoadButton.className = 'button-like';
    saveLoadButton.textContent = 'セーブ/ロード';
    saveLoadButton.style.backgroundColor = '#28a745'; // 少し目立つ色に

    saveLoadButton.addEventListener('click', openSaveLoadModal); // ★変更

    headerButtonsContainer.appendChild(saveLoadButton);
}

/**
 * セーブ/ロード用のモーダルウィンドウのHTMLを生成し、bodyに追加する
 */
function createSaveLoadModal() {
    const modalHTML = `
        <div id="save-load-overlay" class="hidden">
            <div id="save-load-modal">
                <div class="modal-header">
                    <h2>セーブ / ロード</h2>
                    <button id="save-load-close-button" class="close-button">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="sl-tabs">
                        <input type="radio" name="sl-tab" id="sl-tab-save" class="sl-tab-radio" checked>
                        <label for="sl-tab-save" class="sl-tab-label">セーブ</label>
                        <input type="radio" name="sl-tab" id="sl-tab-load" class="sl-tab-radio">
                        <label for="sl-tab-load" class="sl-tab-label">ロード</label>
                    </div>
                    <div id="save-load-slots">
                        </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * モーダルの基本的なイベントリスナー（閉じるボタンなど）を設定する
 */
function setupModalEventListeners() {
    const overlay = document.getElementById('save-load-overlay');
    const closeButton = document.getElementById('save-load-close-button');

    // 閉じるボタンか、モーダルの外側（オーバーレイ）をクリックで閉じる
    closeButton.addEventListener('click', closeSaveLoadModal); // ★変更
    overlay.addEventListener('click', (event) => {
        if (event.target.id === 'save-load-overlay') {
            closeSaveLoadModal(); // ★変更
        }
    });
}


/**
 * モーダルを開く
 */
function openSaveLoadModal() { // ★変更
    const overlay = document.getElementById('save-load-overlay');
    renderSlots();
    overlay.classList.remove('hidden');
}

/**
 * モーダルを閉じる
 */
function closeSaveLoadModal() { // ★変更
    const overlay = document.getElementById('save-load-overlay');
    overlay.classList.add('hidden');
}

/**
 * セーブスロットの状態を読み込み、モーダル内に描画する
 */
function renderSlots() {
    const slotsContainer = document.getElementById('save-load-slots');
    slotsContainer.innerHTML = ''; // コンテナをクリア

    const savedData = JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)) || {};

    for (let i = 1; i <= TOTAL_SLOTS; i++) {
        const slotKey = `slot-${i}`;
        const slotData = savedData[slotKey];

        const slotElement = document.createElement('div');
        slotElement.className = 'sl-slot';
        slotElement.dataset.slotNumber = i;

        const slotTitle = document.createElement('div');
        slotTitle.className = 'sl-slot-title';
        slotTitle.textContent = `スロット ${i}`;
        
        const slotInfo = document.createElement('div');
        slotInfo.className = 'sl-slot-info';

        if (slotData && slotData.timestamp) {
            const date = new Date(slotData.timestamp);
            slotInfo.textContent = `保存日時: ${date.toLocaleString('ja-JP')}`;
            slotElement.classList.add('has-data');
        } else {
            slotInfo.textContent = '空きスロット';
        }
        
        slotElement.appendChild(slotTitle);
        slotElement.appendChild(slotInfo);

        // 各スロットにクリックイベントを設定
        slotElement.addEventListener('click', () => handleSlotClick(i));
        slotsContainer.appendChild(slotElement);
    }
}

/**
 * スロットがクリックされた時の処理
 * @param {number} slotNumber - クリックされたスロットの番号
 */
function handleSlotClick(slotNumber) {
    const isSaveMode = document.getElementById('sl-tab-save').checked;

    if (isSaveMode) {
        saveData(slotNumber);
    } else {
        loadData(slotNumber);
    }
}

/**
 * 指定されたスロットに現在の状態をセーブする
 * @param {number} slotNumber 
 */
function saveData(slotNumber) {
    if (!confirm(`スロット ${slotNumber} に現在の状態をセーブしますか？\n(既存のデータは上書きされます)`)) {
        return;
    }

    // 保存対象のデータをlocalStorageから取得
    const dataToSave = {};
    DATA_KEYS_TO_SAVE.forEach(key => {
        dataToSave[key] = localStorage.getItem(key);
    });

    // 現在のセーブデータを取得
    const allSlotsData = JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)) || {};

    // 新しいセーブデータを作成
    allSlotsData[`slot-${slotNumber}`] = {
        timestamp: Date.now(),
        data: dataToSave
    };

    // localStorageに保存
    localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(allSlotsData));

    alert(`スロット ${slotNumber} にセーブしました。`);
    renderSlots(); // スロットの表示を更新
}

/**
 * 指定されたスロットから状態をロードする
 * @param {number} slotNumber 
 */
function loadData(slotNumber) {
    const allSlotsData = JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)) || {};
    const slotDataToLoad = allSlotsData[`slot-${slotNumber}`];

    if (!slotDataToLoad) {
        alert(`スロット ${slotNumber} にはセーブデータがありません。`);
        return;
    }

    if (!confirm(`スロット ${slotNumber} のデータをロードしますか？\n(現在の装備やインベントリは上書きされます)`)) {
        return;
    }

    // 保存されているデータをlocalStorageに書き戻す
    const savedRawData = slotDataToLoad.data;
    DATA_KEYS_TO_SAVE.forEach(key => {
        if (savedRawData[key]) {
            localStorage.setItem(key, savedRawData[key]);
        } else {
            localStorage.removeItem(key); // 保存データにキーがなければ削除
        }
    });

    alert(`スロット ${slotNumber} のデータをロードしました。\nページをリロードして反映します。`);
    location.reload();
}