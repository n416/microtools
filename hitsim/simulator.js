// ===============================================
// simulator.js : メイン画面用スクリプト (最終完成版)
// ===============================================

// --- グローバル定数・変数 ---
const DB_NAME = 'GameEquipmentDB';
const DB_VERSION = 9;
const STORE_NAME = 'equipment';
const INVENTORY_KEY = 'equipmentInventory_v2';
const EQUIPMENT_SETS_KEY = 'equipmentSets_v1';
const ACTIVE_SET_ID_KEY = 'activeEquipmentSet_v1';

let db;
let equippedItems = {};
let allEquipmentSets = {};
let activeSetId = '1';

let selectedInventoryItem = null;
let selectedSlotId = null;
let detailsPanel, detailsItemName, detailsItemImage, detailsStatsList;

let allInventoryItems = [];
let currentInventoryCategory = 'all';
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
    const sharedData = urlParams.get('d') || urlParams.get('share');

    if (sharedData) {
        handleSharedData(sharedData);
    } else {
        initializeApp();
    }
});


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
            const equipmentNames = JSON.parse(jsonString);

            const allItemNames = [];
            for (const setId in equipmentNames) {
                for (const slotId in equipmentNames[setId]) {
                    allItemNames.push(equipmentNames[setId][slotId]);
                }
            }

            const foundItems = await getItemsFromDBByNames(allItemNames);
            const itemsMap = new Map(foundItems.map(item => [item['名称'], item]));

            const newEquipmentSets = { '1': {}, '2': {}, '3': {}, '4': {} };
            for (const setId in equipmentNames) {
                newEquipmentSets[setId] = {};
                for (const slotId in equipmentNames[setId]) {
                    const itemName = equipmentNames[setId][slotId];
                    if (itemsMap.has(itemName)) {
                        newEquipmentSets[setId][slotId] = itemsMap.get(itemName);
                    }
                }
            }

            localStorage.setItem(EQUIPMENT_SETS_KEY, JSON.stringify(newEquipmentSets));

            // ▼▼▼【今回の追加機能】▼▼▼
            // 復元したアイテムをインベントリにも追加する
            const currentInventory = JSON.parse(localStorage.getItem(INVENTORY_KEY)) || [];
            // 現在のインベントリと復元されたアイテム名を結合し、重複を削除
            const newInventorySet = new Set([...currentInventory, ...allItemNames]);
            const newInventory = Array.from(newInventorySet);
            // 新しいインベントリをlocalStorageに保存
            localStorage.setItem(INVENTORY_KEY, JSON.stringify(newInventory));
            console.log("復元された装備アイテムをインベントリに自動追加しました。");
            // ▲▲▲【今回の追加機能】▲▲▲

        } catch (e) {
            console.error('共有データの処理中にエラーが発生しました:', e);
            alert('データの読み込みに失敗しました。URLが破損している可能性があります。');
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


async function initializeApp() {
    try {
        detailsPanel = document.getElementById('item-details-panel');
        detailsItemName = document.getElementById('details-item-name');
        detailsItemImage = document.getElementById('details-item-image');
        detailsStatsList = document.getElementById('details-stats-list');

        await openDatabase();
        loadAllEquipmentSets();
        await loadAndRenderInventory();
        setupGlobalClickListener();
        setupInventoryTabs();
        setupShareButton();
        setupSetControls();
        calculateAndRenderStats();
    } catch (error) { console.error('初期化中にエラーが発生しました:', error); }
}

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
    const inventoryItems = await getItemsFromDBByNames(inventoryItemNames);
    allInventoryItems = inventoryItems.filter(item => item);
    renderInventory(allInventoryItems);
}

function getItemFromDB(itemName) {
    return new Promise((resolve) => {
        if (!db) { resolve(null); return; }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(itemName);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}

function getItemsFromDBByNames(itemNames) {
    return new Promise(async (resolve, reject) => {
        if (!db) {
            try {
                await openDatabase();
            } catch (e) {
                reject("Database connection failed");
                return;
            }
        }
        const uniqueNames = [...new Set(itemNames)];
        if (uniqueNames.length === 0) {
            resolve([]);
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const results = [];
        let requestsPending = uniqueNames.length;

        const checkCompletion = () => {
            requestsPending--;
            if (requestsPending === 0) {
                // oncompleteを待たずに解決
            }
        };

        transaction.oncomplete = () => {
            resolve(results);
        };
        transaction.onerror = (event) => {
            reject('Transaction error: ' + event.target.error);
        };

        uniqueNames.forEach(name => {
            const request = objectStore.get(name);
            request.onsuccess = () => {
                if (request.result) {
                    results.push(request.result);
                }
                checkCompletion();
            };
            request.onerror = (e) => {
                console.error(`Error fetching item by name: ${name}`, e.target.error);
                checkCompletion();
            };
        });
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

    saveAllEquipmentSets();
    calculateAndRenderStats();
}

function unequipItem(slotId, doSaveAndRecalculate = true) {
    if (equippedItems[slotId]) {
        delete equippedItems[slotId];
        renderSlot(slotId);
        if (doSaveAndRecalculate) {
            saveAllEquipmentSets();
            calculateAndRenderStats();
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


function saveAllEquipmentSets() {
    allEquipmentSets[activeSetId] = equippedItems;
    localStorage.setItem(EQUIPMENT_SETS_KEY, JSON.stringify(allEquipmentSets));
    localStorage.setItem(ACTIVE_SET_ID_KEY, activeSetId);
}


function loadAllEquipmentSets() {
    activeSetId = localStorage.getItem(ACTIVE_SET_ID_KEY) || '1';
    const savedSets = JSON.parse(localStorage.getItem(EQUIPMENT_SETS_KEY));
    if (savedSets) {
        allEquipmentSets = savedSets;
    } else {
        allEquipmentSets = { '1': {}, '2': {}, '3': {}, '4': {} };
    }
    equippedItems = allEquipmentSets[activeSetId] || {};

    renderAllSlots();
    updateSetButtonsUI();
}

function renderAllSlots() {
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


function calculateAndRenderStats() {
    const totalStats = {};
    const percentStats = new Set();

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

    const statsPanel = document.getElementById('stats-panel');
    statsPanel.innerHTML = '<h2>ステータス合計</h2>';

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

            if (percentStats.has(statName)) {
                const percentValue = value * 100;
                valueSpan.textContent = (Number.isInteger(percentValue) ? percentValue : percentValue.toFixed(1)) + '%';
            } else {
                valueSpan.textContent = Number.isInteger(value) ? value : value.toFixed(2);
            }

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

/**
 * ▼▼▼【変更】共有URL生成ロジックを軽量化 ▼▼▼
 */
function setupShareButton() {
    const shareButton = document.getElementById('share-button');
    if (!shareButton) return;

    shareButton.addEventListener('click', async () => {
        // 1. 現在の全装備セットから「名称」だけを抽出する
        const equipmentNamesToShare = {};
        for (const setId in allEquipmentSets) {
            // 空のセットは共有データに含めない
            if (Object.keys(allEquipmentSets[setId]).length === 0) continue;

            equipmentNamesToShare[setId] = {};
            for (const slotId in allEquipmentSets[setId]) {
                const item = allEquipmentSets[setId][slotId];
                if (item && item['名称']) {
                    equipmentNamesToShare[setId][slotId] = item['名称'];
                }
            }
        }

        if (Object.keys(equipmentNamesToShare).length === 0) {
            alert('共有できる装備データがありません。');
            return;
        }

        // 2. 装備セットの「名称」情報のみをJSON化して圧縮・エンコード
        const jsonString = JSON.stringify(equipmentNamesToShare);
        const compressed = pako.deflate(jsonString);
        const encodedData = btoa(String.fromCharCode.apply(null, compressed))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        // 3. パラメータ名を 'd' (data) にしてURLを生成
        const shareUrl = `${window.location.origin}${window.location.pathname}?d=${encodedData}`;

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
                if (typeof setupDatabase === 'function') {
                    setupDatabase()
                        .then(() => {
                            console.log("データベースのセットアップが完了しました。");
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


function setupSetControls() {
    document.querySelectorAll('.set-button').forEach(button => {
        button.addEventListener('click', () => {
            const newSetId = button.dataset.setId;
            if (newSetId !== activeSetId) {
                switchEquipmentSet(newSetId);
            }
        });
    });

    document.getElementById('copy-set-button').addEventListener('click', openCopyModal);
    document.getElementById('clear-set-button').addEventListener('click', clearCurrentSet);
}


function switchEquipmentSet(newSetId) {
    allEquipmentSets[activeSetId] = equippedItems;
    activeSetId = newSetId;
    equippedItems = allEquipmentSets[activeSetId] || {};
    saveAllEquipmentSets();
    clearAllSelections();
    renderAllSlots();
    calculateAndRenderStats();
    updateSetButtonsUI();
}


function updateSetButtonsUI() {
    document.querySelectorAll('.set-button').forEach(button => {
        if (button.dataset.setId === activeSetId) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}


function clearCurrentSet() {
    if (confirm(`セット${activeSetId} の装備を全てクリアします。よろしいですか？`)) {
        equippedItems = {};
        saveAllEquipmentSets();
        renderAllSlots();
        calculateAndRenderStats();
    }
}


function openCopyModal() {
    const modalOverlay = document.getElementById('copy-modal-overlay');
    const optionsContainer = document.getElementById('copy-source-options');
    optionsContainer.innerHTML = '';

    for (let i = 1; i <= 4; i++) {
        const setId = String(i);
        if (setId !== activeSetId) {
            const button = document.createElement('button');
            button.textContent = `${setId}`;
            button.className = 'copy-source-button';
            button.onclick = () => {
                copySetFrom(setId);
            };
            optionsContainer.appendChild(button);
        }
        else {
            const button = document.createElement('button');
            button.textContent = `対象`;
            button.className = 'copy-source-button disabled';
            optionsContainer.appendChild(button);
        }

    }

    document.getElementById('copy-modal-cancel-button').onclick = () => {
        modalOverlay.classList.add('hidden');
    };

    modalOverlay.classList.remove('hidden');
}


function copySetFrom(sourceSetId) {
    if (confirm(`セット${sourceSetId} の内容を、現在のセット${activeSetId} に上書きコピーします。よろしいですか？`)) {
        const sourceData = JSON.parse(JSON.stringify(allEquipmentSets[sourceSetId] || {}));
        equippedItems = sourceData;
        saveAllEquipmentSets();
        clearAllSelections();
        renderAllSlots();
        calculateAndRenderStats();
        document.getElementById('copy-modal-overlay').classList.add('hidden');
    }
}