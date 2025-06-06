// ===============================================
// simulator.js : メイン画面用スクリプト (最終完成版)
// ===============================================

// --- グローバル定数・変数 ---
const DB_NAME = 'GameEquipmentDB';
const DB_VERSION = 9;
const STORE_NAME = 'equipment';
const INVENTORY_KEY = 'equipmentInventory_v2';
const EQUIPMENT_SET_KEY = 'equipmentSet_v1';

let db;
let equippedItems = {};
let selectedInventoryItem = null;
let selectedSlotId = null;

// ▼▼▼【追記】詳細パネル用の変数を定義 ▼▼▼
let detailsPanel, detailsItemName, detailsItemImage, detailsStatsList;
// ▲▲▲【追記】▲▲▲

// ▼▼▼【追記】インベントリのフルリストと現在選択中のカテゴリを管理 ▼▼▼
let allInventoryItems = [];
let currentInventoryCategory = 'all';
// ▲▲▲【追記】▲▲▲

// ▼▼▼【新規追加】ステータス計算対象となる列名のリスト ▼▼▼
const STAT_HEADERS = [
    '評価数値', '基本攻撃力', '攻撃力増幅', 'クリティカルダメージ増幅', '一般攻撃力',
    'スキルダメージ増幅', '近距離攻撃力', '防御力', '武力', 'ガード貫通', '一般ダメージ増幅',
    '気絶的中', '気絶抵抗', '絶対回避', 'クリティカル発生率', '状態異常抵抗', 'MP回復',
    '防御貫通', '状態異常的中', 'PvP攻撃力', 'PvPクリティカル発生率', '治癒量増加', '硬直',
    '近距離クリティカル発生率', '魔法クリティカル発生率', '活力', '忍耐', '聡明', '硬直耐性',
    '武器攻撃力', '命中', 'ガード', 'クリティカル抵抗', 'クリティカルダメージ耐性', 'HP回復',
    '最大HP', 'ポーション回復量', 'スキルダメージ耐性', '一般ダメージ耐性', '水属性追加ダメージ',
    '風属性追加ダメージ', '土属性追加ダメージ', '火属性追加ダメージ', '詠唱速度', '武器攻撃力増幅'
];

const TYPE_TO_SLOT_CATEGORY = {
    '01大剣': 'weapon', '02宝珠': 'weapon', '03鈍器': 'weapon', '04弓': 'weapon',
    '05杖': 'weapon', '06双剣': 'weapon', '07鎌': 'weapon', '08双拳銃': 'weapon', '09御剣': 'weapon',
    '11頭': 'head', '12手': 'hands', '13上装備': 'top', '14下装備': 'bottom', '15足': 'feet',
    '16マント': 'cloak', '21ベルト': 'belt', '22ブレスレット': 'bracelet', '23リング': 'ring',
    '24ネックレス': 'necklace', '25勲章': 'medal', '26守護具': 'guardian', '27カンパネラ': 'campanella', '28アミュレッタ': 'amulet'
};
const SLOT_CATEGORY_TO_IDS = {
    'weapon': ['slot-weapon'], 'head': ['slot-head'], 'top': ['slot-top'], 'hands': ['slot-hands'],
    'feet': ['slot-feet'], 'bottom': ['slot-bottom'], 'cloak': ['slot-cloak'], 'belt': ['slot-belt'],
    'necklace': ['slot-necklace'], 'bracelet': ['slot-bracelet'],
    'ring': ['slot-ring1', 'slot-ring2', 'slot-ring3', 'slot-ring4', 'slot-ring5'],
    'medal': ['slot-medal'], 'guardian': ['slot-guardian'], 'amulet': ['slot-amulet'], 'campanella': ['slot-campanella'],
};
const SLOT_ID_TO_JAPANESE_NAME = {
    'slot-weapon': '武器', 'slot-head': '頭', 'slot-top': '上装備', 'slot-hands': '手', 'slot-feet': '足',
    'slot-bottom': '下装備', 'slot-cloak': 'マント', 'slot-belt': 'ベルト', 'slot-necklace': 'ネックレス',
    'slot-bracelet': 'ブレスレット', 'slot-ring1': 'リング', 'slot-ring2': 'リング', 'slot-ring3': 'リング',
    'slot-ring4': 'リング', 'slot-ring5': 'リング', 'slot-medal': '勲章', 'slot-guardian': '守護具',
    'slot-amulet': 'アミュレッタ', 'slot-campanella': 'カンパネラ'
};

// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('share');

    if (sharedData) {
        handleSharedData(sharedData);
    } else {
        initializeApp();
    }
});

/**
 * 共有データが見つかった場合の処理
 * @param {string} encodedData - URLに含まれるエンコードされたデータ
 */
function handleSharedData(encodedData) {
    const modalOverlay = document.getElementById('share-modal-overlay');
    const okButton = document.getElementById('modal-ok-button');
    const cancelButton = document.getElementById('modal-cancel-button');
    const modalText = modalOverlay.querySelector('p');

    modalOverlay.classList.remove('hidden');

    okButton.onclick = async () => {
        try {
            modalText.textContent = 'データベースを確認・準備中です...';
            okButton.disabled = true;
            cancelButton.disabled = true;

            await checkAndSetupDatabaseIfNeeded();

            modalText.textContent = 'データを復元しています...';

            const compressedData = atob(encodedData.replace(/-/g, '+').replace(/_/g, '/'));
            const uint8Array = new Uint8Array(compressedData.split('').map(c => c.charCodeAt(0)));
            const jsonString = pako.inflate(uint8Array, { to: 'string' });
            const state = JSON.parse(jsonString);

            if (state.inventory && state.equipment) {
                localStorage.setItem(INVENTORY_KEY, JSON.stringify(state.inventory));
                localStorage.setItem(EQUIPMENT_SET_KEY, JSON.stringify(state.equipment));
            }
        } catch (e) {
            console.error('共有データの処理中にエラーが発生しました:', e);
            alert('データの読み込みに失敗しました。');
        } finally {
            modalOverlay.classList.add('hidden');
            modalText.textContent = '共有されたデータがあります。\n読み込みますか？';
            okButton.disabled = false;
            cancelButton.disabled = false;
            history.replaceState(null, '', window.location.pathname);
            initializeApp();
        }
    };

    cancelButton.onclick = () => {
        modalOverlay.classList.add('hidden');
        history.replaceState(null, '', window.location.pathname);
        initializeApp();
    };
}


/**
 * アプリケーションのメイン初期化処理
 */
async function initializeApp() {
    try {
        detailsPanel = document.getElementById('item-details-panel');
        detailsItemName = document.getElementById('details-item-name');
        detailsItemImage = document.getElementById('details-item-image');
        detailsStatsList = document.getElementById('details-stats-list');

        await openDatabase();
        await loadEquippedItems();
        await loadAndRenderInventory();
        setupGlobalClickListener();
        setupInventoryTabs();
        setupShareButton();
        calculateAndRenderStats();
    } catch (error) { console.error('初期化中にエラーが発生しました:', error); }
}

// --- 関数定義 ---
// (openDatabase, getItemFromDB, renderInventory, handleInventoryClick, handleSlotClick は変更なし)
function openDatabase() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => { const db = e.target.result; if (!db.objectStoreNames.contains(STORE_NAME)) { db.createObjectStore(STORE_NAME, { keyPath: '名称' }); } };
        request.onerror = (e) => reject('DBオープン失敗:', e.target.error);
        request.onsuccess = (e) => { db = e.target.result; resolve(db); };
    });
}
async function loadAndRenderInventory() {
    const inventoryItemNames = JSON.parse(localStorage.getItem(INVENTORY_KEY)) || [];
    if (inventoryItemNames.length === 0) { document.getElementById('inventory-list').innerHTML = '<p style="padding: 10px;">インベントリにアイテムがありません。<br><a href="data.html">インベントリ編集ページ</a>でアイテムを追加してください。</p>'; return; }
    const itemPromises = inventoryItemNames.map(name => getItemFromDB(name));
    const inventoryItems = (await Promise.all(itemPromises)).filter(item => item);
    allInventoryItems = inventoryItems;
    renderInventory(inventoryItems);
}
function getItemFromDB(itemName) {
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(itemName);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}
function renderInventory(items) {
    const inventoryListDiv = document.getElementById('inventory-list');
    inventoryListDiv.innerHTML = '';
    const filteredItems = items.filter(item => {
        if (currentInventoryCategory === 'all') {
            return true;
        }
        return getCategoryFromType(item['タイプ']) === currentInventoryCategory;
    });
    filteredItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'inventory-item';
        itemDiv.id = `inv-${item['名称']}`;
        itemDiv.title = `${item['名称']}\nタイプ: ${item['タイプ']}`;
        const img = document.createElement('img');
        img.src = item['画像URL'] || '';
        img.alt = item['名称'];
        img.className = 'item-icon';
        itemDiv.appendChild(img);
        itemDiv.addEventListener('click', (e) => { e.stopPropagation(); handleInventoryClick(item, e.currentTarget); });
        inventoryListDiv.appendChild(itemDiv);
    });
}
function handleInventoryClick(item, element) {
    if (selectedInventoryItem && selectedInventoryItem['名称'] === item['名称']) {
        equipItem(item);
        clearAllSelections();
    } else {
        clearAllSelections();
        selectedInventoryItem = item;
        element.classList.add('selected');
        displayItemDetails(item, element);
    }
}
function handleSlotClick(slotId, element) {
    const item = equippedItems[slotId];
    if (item) {
        if (selectedSlotId === slotId) {
            unequipItem(slotId);
            clearAllSelections();
        } else {
            clearAllSelections();
            selectedSlotId = slotId;
            element.classList.add('selected');
            displayItemDetails(item, element);
        }
    }
}

/**
 * ▼▼▼【空きスロット優先ロジック 最終修正版】▼▼▼
 * アイテムを対応するスロットに装備させる
 * @param {object} item - 装備するアイテムオブジェクト
 */
function equipItem(item) {
    const itemType = item['タイプ'];
    const slotCategory = TYPE_TO_SLOT_CATEGORY[itemType];
    if (!slotCategory) return;

    const possibleSlotIds = SLOT_CATEGORY_TO_IDS[slotCategory];
    const isRing = (slotCategory === 'ring');

    if (!isRing) {
        if (Object.values(equippedItems).some(equipped => equipped && equipped['名称'] === item['名称'])) {
            console.log(`ユニークアイテム「${item['名称']}」はすでに装備されています。`);
            return;
        }
    }

    const emptySlotId = possibleSlotIds.find(id => !equippedItems[id]);

    if (emptySlotId) {
        equippedItems[emptySlotId] = item;
        renderSlot(emptySlotId);

    } else {
        if (isRing) {
            const pushedOutItem = equippedItems[possibleSlotIds[4]];
            console.log(`リング枠が満杯のため、「${pushedOutItem['名称']}」が押し出されます。`);

            for (let i = possibleSlotIds.length - 2; i >= 0; i--) {
                const currentSlotId = possibleSlotIds[i];
                const nextSlotId = possibleSlotIds[i + 1];
                equippedItems[nextSlotId] = equippedItems[currentSlotId];
            }
            equippedItems[possibleSlotIds[0]] = item;

            possibleSlotIds.forEach(id => renderSlot(id));

        } else {
            const targetSlotId = possibleSlotIds[0];

            if (equippedItems[targetSlotId] && equippedItems[targetSlotId]['名称'] === item['名称']) {
                return;
            }

            unequipItem(targetSlotId, false);
            equippedItems[targetSlotId] = item;
            renderSlot(targetSlotId);
        }
    }

    saveEquippedItems();
    calculateAndRenderStats();
}

function unequipItem(slotId, doSaveAndRecalculate = true) {
    if (equippedItems[slotId]) {
        delete equippedItems[slotId];
        renderSlot(slotId);
        if (doSaveAndRecalculate) {
            saveEquippedItems();
            calculateAndRenderStats(); // ★★★ 装備解除後にステータスを再計算
        }
    }
}

function renderSlot(slotId) {
    const slotElement = document.getElementById(slotId);
    if (!slotElement) return;
    slotElement.classList.remove('selected');
    const newSlotElement = slotElement.cloneNode(true);
    slotElement.parentNode.replaceChild(newSlotElement, slotElement);
    newSlotElement.addEventListener('click', (e) => { e.stopPropagation(); handleSlotClick(slotId, e.currentTarget); });
    newSlotElement.innerHTML = '';
    const item = equippedItems[slotId];
    if (item) {
        newSlotElement.title = `${item['名称']}\nタイプ: ${item['タイプ']}`;
        const img = document.createElement('img');
        img.src = item['画像URL'] || '';
        img.alt = item['名称'];
        img.className = 'item-icon';
        newSlotElement.appendChild(img);
    } else {
        newSlotElement.title = '';
        const defaultSpan = document.createElement('span');
        defaultSpan.textContent = SLOT_ID_TO_JAPANESE_NAME[slotId] || '';
        newSlotElement.appendChild(defaultSpan);
    }
}

function saveEquippedItems() {
    const savableData = {};
    for (const slotId in equippedItems) { savableData[slotId] = equippedItems[slotId]['名称']; }
    localStorage.setItem(EQUIPMENT_SET_KEY, JSON.stringify(savableData));
}

async function loadEquippedItems() {
    const savedSet = JSON.parse(localStorage.getItem(EQUIPMENT_SET_KEY)) || {};
    const itemPromises = [];
    for (const slotId in savedSet) {
        const itemName = savedSet[slotId];
        itemPromises.push(getItemFromDB(itemName).then(item => { if (item) equippedItems[slotId] = item; }));
    }
    await Promise.all(itemPromises);
    document.querySelectorAll('.slot').forEach(slotElement => renderSlot(slotElement.id));
}

function clearAllSelections() {
    if (selectedInventoryItem) {
        const selectedElem = document.getElementById(`inv-${selectedInventoryItem['名称']}`);
        if (selectedElem) selectedElem.classList.remove('selected');
        selectedInventoryItem = null;
    }
    if (selectedSlotId) {
        const selectedElem = document.getElementById(selectedSlotId);
        if (selectedElem) selectedElem.classList.remove('selected');
        selectedSlotId = null;
    }
    hideItemDetails();
}

function setupGlobalClickListener() {
    document.body.addEventListener('click', () => clearAllSelections());
}

/**
 * ▼▼▼【新規追加】ステップ4のメイン機能 ▼▼▼
 * 現在の装備から合計ステータスを計算し、画面に表示する
 */
function calculateAndRenderStats() {
    const totalStats = {};
    const percentStats = new Set();

    // 1. 全ての装備アイテムのステータスを合計する
    for (const slotId in equippedItems) {
        const item = equippedItems[slotId];
        for (const statName of STAT_HEADERS) {
            const value = parseFloat(item[statName]) || 0;
            if (value !== 0) {
                if (value > 0 && value < 1) {
                    percentStats.add(statName);
                }
                totalStats[statName] = (totalStats[statName] || 0) + value;
            }
        }
    }

    // 2. 計算結果を画面に描画する
    const statsPanel = document.getElementById('stats-panel');
    statsPanel.innerHTML = '<h2>ステータス合計</h2>'; // タイトルをセット

    const statsList = document.createElement('div');
    statsList.className = 'stats-list';

    let hasStats = false;
    for (const statName in totalStats) {
        const value = totalStats[statName];
        if (value !== 0) {
            hasStats = true;
            const statEntry = document.createElement('div');
            statEntry.className = 'stat-entry';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'stat-name';
            nameSpan.textContent = statName;

            const valueSpan = document.createElement('span');
            valueSpan.className = 'stat-value';


            // ▼▼▼【ロジック変更箇所】▼▼▼
            if (percentStats.has(statName)) {
                const percentValue = value * 100;
                valueSpan.textContent = (Number.isInteger(percentValue) ? percentValue : percentValue.toFixed(1)) + '%';
            } else {
                valueSpan.textContent = Number.isInteger(value) ? value : value.toFixed(2);
            }
            // ▲▲▲【ロジック変更箇所】▲▲▲

            // 小数点が見苦しくならないように丸める
            //valueSpan.textContent = Number.isInteger(value) ? value : value.toFixed(2);

            statEntry.appendChild(nameSpan);
            statEntry.appendChild(valueSpan);
            statsList.appendChild(statEntry);
        }
    }

    if (!hasStats) {
        statsList.textContent = '装備がありません。';
    }

    statsPanel.appendChild(statsList);
}

// (displayItemDetails, hideItemDetails, getCategoryFromType, setupInventoryTabs は変更なし)
function displayItemDetails(item, clickedElement) {
    if (!item || !detailsPanel || !clickedElement) return;
    detailsItemName.textContent = item['名称'];
    detailsItemImage.src = item['画像URL'] || '';
    detailsItemImage.alt = item['名称'];
    detailsStatsList.innerHTML = '';
    let hasStats = false;
    STAT_HEADERS.forEach(statName => {
        const value = parseFloat(item[statName]);
        if (value && !isNaN(value) && value !== 0) {
            hasStats = true;
            const statEntry = document.createElement('div');
            statEntry.className = 'stat-entry';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'stat-name';
            nameSpan.textContent = statName;
            const valueSpan = document.createElement('span');
            valueSpan.className = 'stat-value';
            if (value > 0 && value < 1) {
                const percentValue = value * 100;
                valueSpan.textContent = (Number.isInteger(percentValue) ? percentValue : percentValue.toFixed(1)) + '%';
            } else {
                valueSpan.textContent = Number.isInteger(value) ? value : value.toFixed(2);
            }
            statEntry.appendChild(nameSpan);
            statEntry.appendChild(valueSpan);
            detailsStatsList.appendChild(statEntry);
        }
    });
    if (!hasStats) {
        detailsStatsList.textContent = '表示するステータスがありません。';
    }
    const rect = clickedElement.getBoundingClientRect();
    let top = rect.bottom + window.scrollY + 5;
    let left = rect.left + window.scrollX;
    detailsPanel.style.display = 'block';
    const panelRect = detailsPanel.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    if (left + panelRect.width > viewportWidth) {
        left = viewportWidth - panelRect.width - 10;
    }
    if (left < 0) {
        left = 10;
    }
    detailsPanel.style.top = `${top}px`;
    detailsPanel.style.left = `${left}px`;
}
function hideItemDetails() {
    if (detailsPanel) {
        detailsPanel.style.display = 'none';
    }
}
function getCategoryFromType(typeString) {
    if (!typeString) return 'unknown';
    const prefix = parseInt(typeString.substring(0, 2), 10);
    if (prefix >= 1 && prefix <= 9) return 'weapon';
    if (prefix >= 11 && prefix <= 15) return 'armor';
    if ((prefix >= 16 && prefix <= 16) || (prefix >= 21 && prefix <= 28)) return 'accessory';
    return 'unknown';
}
function setupInventoryTabs() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelector('#inventory-tabs .active').classList.remove('active');
            e.currentTarget.classList.add('active');
            currentInventoryCategory = e.currentTarget.dataset.category;
            renderInventory(allInventoryItems);
        });
    });
}
function setupShareButton() {
    const shareButton = document.getElementById('share-button');
    if (!shareButton) return;

    shareButton.addEventListener('click', async () => {
        const inventoryToShare = JSON.parse(localStorage.getItem(INVENTORY_KEY)) || [];
        const equipmentToShare = JSON.parse(localStorage.getItem(EQUIPMENT_SET_KEY)) || {};

        const stateToShare = {
            inventory: inventoryToShare,
            equipment: equipmentToShare,
        };

        const jsonString = JSON.stringify(stateToShare);
        const compressed = pako.deflate(jsonString);
        const encodedData = btoa(String.fromCharCode.apply(null, compressed))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encodedData}`;

        try {
            await navigator.clipboard.writeText(shareUrl);
            const originalText = shareButton.textContent;
            shareButton.textContent = 'コピーしました！';
            setTimeout(() => {
                shareButton.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('クリップボードへのコピーに失敗しました:', err);
            alert('URLのコピーに失敗しました。');
        }
    });
}

// ▼▼▼【ここから追記】DBの存在チェックとセットアップを行う関数 ▼▼▼
/**
 * DBが存在し、データが入っているかを確認し、なければセットアップを実行する
 */
async function checkAndSetupDatabaseIfNeeded() {
    await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const countRequest = store.count();

        countRequest.onsuccess = () => {
            if (countRequest.result > 0) {
                console.log("データベースは既に存在し、データが含まれています。");
                resolve();
            } else {
                console.log("データベースが空です。セットアップ処理を実行します...");
                // db-setup.js内のsetupDatabase関数を呼び出す
                // この関数がグローバルスコープに存在することを前提としています
                if (typeof setupDatabase === 'function') {
                    setupDatabase()
                        .then(() => {
                            console.log("データベースのセットアップが完了しました。");
                            // セットアップ後、DB接続を再確立する必要がある場合があるため、再度openDatabaseを呼ぶ
                            openDatabase().then(resolve).catch(reject);
                        })
                        .catch(err => {
                            console.error("データベースのセットアップ中にエラーが発生しました。", err);
                            reject(err);
                        });
                } else {
                    reject('setupDatabase関数が見つかりません。db-setup.jsが正しく読み込まれているか確認してください。');
                }
            }
        };
        countRequest.onerror = (event) => {
            console.error("データベースのアイテム数確認中にエラーが発生しました。", event.target.error);
            reject(event.target.error);
        };
    });
}
// ▲▲▲【ここまで追記】▲▲▲