// ===============================================
// simulator.js : メイン画面用スクリプト (強化機能追加版)
// ===============================================

// --- グローバル定数・変数 ---
const DB_NAME = 'GameEquipmentDB';
const DB_VERSION = 9;
const STORE_NAME = 'equipment';
const INVENTORY_KEY = 'equipmentInventory_v2';
const EQUIPMENT_SETS_KEY = 'equipmentSets_v2'; // データ構造変更のためバージョンアップ
const ACTIVE_SET_ID_KEY = 'activeEquipmentSet_v1';
const SORT_ORDERS_KEY = 'equipmentSortOrders_v1';
const ACTIVE_SORT_KEY = 'activeSortOrderKey_v1';

let db;
// ▼【変更点】equippedItemsのデータ構造を変更: itemオブジェクト -> {item: itemObject, enchantLevel: 0}
let equippedItems = {};
let allEquipmentSets = {};
let activeSetId = '1';
let comparisonSetId = null;

// 並び順変更機能用の変数
let sortOrders = {};
let activeSortKey = 'default';
let isSortMode = false;
let sortableInstance = null;

let selectedInventoryItem = null;
let selectedSlotId = null;
let detailsPanel, detailsItemName, detailsItemImage, detailsStatsList;

// ▼【変更点】強化値操作UIのDOM要素を格納する変数を追加
let enchantControls, enchantDownButton, enchantUpButton, detailsItemEnchant;

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

            // ▼【変更点】共有データの形式変更に対応
            const sharedSets = JSON.parse(jsonString);

            const allItemNames = new Set();
            for (const setId in sharedSets) {
                for (const slotId in sharedSets[setId]) {
                    allItemNames.add(sharedSets[setId][slotId].n); // name
                }
            }

            const foundItems = await getItemsFromDBByNames(Array.from(allItemNames));
            const itemsMap = new Map(foundItems.map(item => [item['名称'], item]));

            const newEquipmentSets = { '1': {}, '2': {}, '3': {}, '4': {} };
            for (const setId in sharedSets) {
                newEquipmentSets[setId] = {};
                for (const slotId in sharedSets[setId]) {
                    const itemName = sharedSets[setId][slotId].n;
                    const enchantLevel = sharedSets[setId][slotId].e || 0;
                    if (itemsMap.has(itemName)) {
                        newEquipmentSets[setId][slotId] = {
                            item: itemsMap.get(itemName),
                            enchantLevel: enchantLevel
                        };
                    }
                }
            }

            localStorage.setItem(EQUIPMENT_SETS_KEY, JSON.stringify(newEquipmentSets));

            const currentInventory = JSON.parse(localStorage.getItem(INVENTORY_KEY)) || [];
            const newInventorySet = new Set([...currentInventory, ...allItemNames]);
            localStorage.setItem(INVENTORY_KEY, JSON.stringify(Array.from(newInventorySet)));
            console.log("復元された装備アイテムをインベントリに自動追加しました。");

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

        // ▼【変更点】強化値UIの要素を取得
        enchantControls = document.getElementById('enchant-controls');
        enchantDownButton = document.getElementById('enchant-down-button');
        enchantUpButton = document.getElementById('enchant-up-button');
        detailsItemEnchant = document.getElementById('details-item-enchant');

        await openDatabase();
        loadSortOrders();
        loadAllEquipmentSets(); // データ構造の変換処理も内包
        await loadAndRenderInventory();
        setupGlobalClickListener();
        setupInventoryTabs();
        setupShareButton();
        setupSetControls();
        setupEnchantControls(); // ▼【変更点】強化ボタンのリスナーを設定
        calculateAndRenderStats();
    } catch (error) { console.error('初期化中にエラーが発生しました:', error); }
}

// ▼【新規追加】強化ボタンのイベントリスナーをまとめる関数
function setupEnchantControls() {
    enchantDownButton.addEventListener('click', (e) => {
        e.stopPropagation();
        updateEnchantLevel(-1);
    });
    enchantUpButton.addEventListener('click', (e) => {
        e.stopPropagation();
        updateEnchantLevel(1);
    });
}

// ▼【新規追加】強化レベルを変更する関数
function updateEnchantLevel(change) {
    if (!selectedSlotId || !equippedItems[selectedSlotId]) return;

    const equipped = equippedItems[selectedSlotId];
    let newLevel = equipped.enchantLevel + change;

    // 0から12の範囲に収める
    if (newLevel < 0) newLevel = 0;
    if (newLevel > 12) newLevel = 12;

    if (newLevel !== equipped.enchantLevel) {
        equipped.enchantLevel = newLevel;

        // 装備スロットの表示更新 (例: +1 武神の剣)
        renderSlot(selectedSlotId);

        // 合計ステータスの再計算
        calculateAndRenderStats();

        // 変更を保存
        saveAllEquipmentSets();

        // 詳細パネルの再表示（内容更新のため）
        displayItemDetails(equipped.item, document.getElementById(selectedSlotId));
    }
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
        let completed = 0;

        uniqueNames.forEach(name => {
            const request = objectStore.get(name);
            request.onsuccess = () => {
                if (request.result) {
                    results.push(request.result);
                }
                completed++;
                if (completed === uniqueNames.length) {
                    resolve(results);
                }
            };
            request.onerror = (e) => {
                console.error(`Error fetching item by name: ${name}`, e.target.error);
                completed++;
                if (completed === uniqueNames.length) {
                    resolve(results); // エラーがあっても処理を続ける
                }
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
    const equipped = equippedItems[slotId]; // item -> equipped
    if (equipped) { // item -> equipped
        if (selectedSlotId === slotId) {
            unequipItem(slotId);
            clearAllSelections();
        } else {
            clearAllSelections();
            selectedSlotId = slotId;
            element.classList.add('selected');
            displayItemDetails(equipped.item, element); // item -> equipped.item
        }
    }
}


function equipItem(item) {
    const itemType = item['タイプ'];
    const slotCategory = TYPE_TO_SLOT_CATEGORY[itemType];
    if (!slotCategory) return;

    const possibleSlotIds = SLOT_CATEGORY_TO_IDS[slotCategory];
    const isRing = (slotCategory === 'ring');

    // ▼【変更点】ユニークチェックを新しいデータ構造に対応
    if (!isRing) {
        if (Object.values(equippedItems).some(equipped => equipped && equipped.item['名称'] === item['名称'])) {
            console.log(`ユニークアイテム「${item['名称']}」はすでに装備されています。`);
            return;
        }
    }

    const emptySlotId = possibleSlotIds.find(id => !equippedItems[id]);

    if (emptySlotId) {
        // ▼【変更点】強化値を含めたオブジェクトを保存
        equippedItems[emptySlotId] = { item: item, enchantLevel: 0 };
        renderSlot(emptySlotId);

    } else {
        if (isRing) {
            // ▼【変更点】リングの押し出し処理を新しいデータ構造に対応
            const pushedOutItemName = equippedItems[possibleSlotIds[4]].item['名称'];
            console.log(`リング枠が満杯のため、「${pushedOutItemName}」が押し出されます。`);

            for (let i = possibleSlotIds.length - 2; i >= 0; i--) {
                const currentSlotId = possibleSlotIds[i];
                const nextSlotId = possibleSlotIds[i + 1];
                equippedItems[nextSlotId] = equippedItems[currentSlotId];
            }
            equippedItems[possibleSlotIds[0]] = { item: item, enchantLevel: 0 };
            possibleSlotIds.forEach(id => renderSlot(id));

        } else {
            const targetSlotId = possibleSlotIds[0];

            if (equippedItems[targetSlotId] && equippedItems[targetSlotId].item['名称'] === item['名称']) {
                return;
            }

            unequipItem(targetSlotId, false);
            equippedItems[targetSlotId] = { item: item, enchantLevel: 0 };
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

    // ▼【変更点】新しいデータ構造からアイテム情報を取得し、強化値を表示
    const equipped = equippedItems[slotId];
    if (equipped) {
        const item = equipped.item;
        const enchantText = equipped.enchantLevel > 0 ? `+${equipped.enchantLevel}` : '';

        newSlotElement.title = `${item['名称']} ${enchantText}\nタイプ: ${item['タイプ']}`;
        const img = document.createElement('img');
        img.src = item['画像URL'] || '';
        img.alt = item['名称'];
        img.className = 'item-icon';
        newSlotElement.appendChild(img);

        // アイコンの上に強化値を表示する要素を追加（任意）
        if (enchantText) {
            const enchantDiv = document.createElement('div');
            enchantDiv.textContent = enchantText;
            enchantDiv.style.position = 'absolute';
            enchantDiv.style.right = '2px';
            enchantDiv.style.bottom = '2px';
            enchantDiv.style.color = 'yellow';
            enchantDiv.style.fontWeight = 'bold';
            enchantDiv.style.fontSize = '12px';
            enchantDiv.style.textShadow = '1px 1px 2px black';
            newSlotElement.appendChild(enchantDiv);
        }

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
        // ▼【変更点】古いデータ構造との互換性維持
        for (const setId in allEquipmentSets) {
            for (const slotId in allEquipmentSets[setId]) {
                const equipped = allEquipmentSets[setId][slotId];
                if (equipped && !equipped.item && equipped['名称']) { // itemプロパティがなく、名称プロパティがある場合は旧形式
                    allEquipmentSets[setId][slotId] = {
                        item: equipped,
                        enchantLevel: 0
                    };
                }
            }
        }
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
    const { totalStats, percentStats } = calculateStatsForSet(equippedItems);
    const { totalStats: comparisonTotalStats } = calculateStatsForSet(allEquipmentSets[comparisonSetId]);

    const statsPanel = document.getElementById('stats-panel');
    statsPanel.innerHTML = '';

    const comparisonContainer = document.createElement('div');
    comparisonContainer.id = 'comparison-controls';
    statsPanel.appendChild(comparisonContainer);
    renderComparisonSelector();

    const title = document.createElement('h2');
    title.textContent = 'ステータス合計';
    statsPanel.appendChild(title);

    const statsList = document.createElement('div');
    statsList.className = 'stats-list';
    statsPanel.appendChild(statsList);

    const currentSortOrder = sortOrders[activeSortKey] || STAT_HEADERS;
    const statsToRender = Object.keys(totalStats)
        .filter(stat => totalStats[stat] !== 0)
        .sort((a, b) => {
            const indexA = currentSortOrder.indexOf(a);
            const indexB = currentSortOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return STAT_HEADERS.indexOf(a) - STAT_HEADERS.indexOf(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

    if (statsToRender.length === 0) {
        statsList.textContent = '装備がありません。';
    } else {
        statsToRender.forEach((statName, index) => {
            const value = totalStats[statName];
            const statEntry = document.createElement('div');
            statEntry.className = 'stat-entry';
            statEntry.dataset.statName = statName;

            const numberSpan = document.createElement('span');
            numberSpan.className = 'stat-number';
            numberSpan.textContent = `${index + 1}.`;
            statEntry.appendChild(numberSpan);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'stat-name';
            nameSpan.textContent = statName;

            const valueSpan = document.createElement('span');
            valueSpan.className = 'stat-value';

            let displayValueText;
            if (percentStats.has(statName)) {
                const percentValue = value * 100;
                displayValueText = (Number.isInteger(percentValue) ? percentValue : percentValue.toFixed(2)) + '%';
            } else {
                displayValueText = Number.isInteger(value) ? value : value.toFixed(2);
            }

            let diffHtml = '';
            if (comparisonSetId) {
                const comparisonValue = comparisonTotalStats[statName] || 0;
                const diff = value - comparisonValue;

                if (diff !== 0) {
                    const diffClass = diff > 0 ? 'positive' : 'negative';
                    const diffSign = diff > 0 ? '+' : '';

                    let diffDisplayValue;
                    if (percentStats.has(statName)) {
                        const percentDiff = diff * 100;
                        diffDisplayValue = (Number.isInteger(percentDiff) ? percentDiff : percentDiff.toFixed(2)) + '%';
                    } else {
                        diffDisplayValue = Number.isInteger(diff) ? diff : diff.toFixed(2);
                    }
                    diffHtml = ` <span class="diff ${diffClass}">(${diffSign}${diffDisplayValue})</span>`;
                }
            }

            valueSpan.innerHTML = `${displayValueText}${diffHtml}`;
            statEntry.appendChild(nameSpan);
            statEntry.appendChild(valueSpan);
            statsList.appendChild(statEntry);
        });
    }

    const sortControlsContainer = document.createElement('div');
    sortControlsContainer.id = 'sort-order-controls';
    statsPanel.appendChild(sortControlsContainer);
    renderSortOrderControls();
}


function displayItemDetails(item, clickedElement) {
    if (!item || !detailsPanel || !clickedElement) return;

    const enchantLevel = selectedSlotId && equippedItems[selectedSlotId] ? equippedItems[selectedSlotId].enchantLevel : 0;

    detailsItemName.textContent = item['名称'];
    detailsItemImage.src = item['画像URL'] || '';
    detailsItemImage.alt = item['名称'];
    detailsStatsList.innerHTML = '';

    // ▼【変更点】強化値UIの表示制御
    if (selectedSlotId) { // 装備スロットのアイテムの場合のみ強化UIを表示
        enchantControls.classList.remove('hidden');
        detailsItemEnchant.textContent = enchantLevel > 0 ? `+${enchantLevel}` : '無強化';
        enchantDownButton.disabled = enchantLevel <= 0;
        enchantUpButton.disabled = enchantLevel >= 12;
    } else {
        enchantControls.classList.add('hidden');
    }

    // ▼【変更点】強化ボーナスを加味してステータスを表示
    const baseStats = {};
    STAT_HEADERS.forEach(statName => {
        const value = parseFloat(item[statName]);
        if (value && !isNaN(value) && value !== 0) {
            baseStats[statName] = value;
        }
    });

    const enchantBonus = getEnchantBonus(item, enchantLevel);
    const allStatKeys = new Set([...Object.keys(baseStats), ...Object.keys(enchantBonus)]);

    if (allStatKeys.size === 0) {
        detailsStatsList.textContent = '表示するステータスがありません。';
    } else {
        allStatKeys.forEach(statName => {
            const baseValue = baseStats[statName] || 0;
            const bonusValue = enchantBonus[statName] || 0;
            const totalValue = baseValue + bonusValue;

            const statEntry = document.createElement('div');
            statEntry.className = 'stat-entry';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'stat-name';
            nameSpan.textContent = statName;

            const valueSpan = document.createElement('span');
            valueSpan.className = 'stat-value';

            let valueText = '';
            if (totalValue > 0 && totalValue < 1 && !Number.isInteger(totalValue)) {
                const percentValue = totalValue * 100;
                valueText = (Number.isInteger(percentValue) ? percentValue : percentValue.toFixed(1)) + '%';
            } else {
                valueText = Number.isInteger(totalValue) ? totalValue : totalValue.toFixed(2);
            }

            if (bonusValue > 0) {
                let bonusText = Number.isInteger(bonusValue) ? bonusValue : bonusValue.toFixed(2);
                if (baseStats[statName] > 0 && baseStats[statName] < 1) { // 元が%表記の場合
                    bonusText = (bonusValue * 100).toFixed(1) + '%';
                }
                valueText += ` <span class="enchant-bonus">(+${bonusText})</span>`;
            }

            valueSpan.innerHTML = valueText;
            statEntry.appendChild(nameSpan);
            statEntry.appendChild(valueSpan);
            detailsStatsList.appendChild(statEntry);
        });
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
    enchantControls.classList.add('hidden');
}
function getCategoryFromType(typeString) {
    if (!typeString) return 'unknown';
    const prefix = parseInt(typeString.substring(0, 2), 10);
    if (prefix >= 1 && prefix <= 9) return 'weapon';
    if (prefix >= 11 && prefix <= 16) return 'armor';
    if (prefix >= 21 && prefix <= 28) return 'accessory';
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
        // ▼【変更点】共有データに強化値を含める
        const equipmentDataToShare = {};
        for (const setId in allEquipmentSets) {
            if (Object.keys(allEquipmentSets[setId]).length === 0) continue;

            equipmentDataToShare[setId] = {};
            for (const slotId in allEquipmentSets[setId]) {
                const equipped = allEquipmentSets[setId][slotId];
                if (equipped && equipped.item && equipped.item['名称']) {
                    equipmentDataToShare[setId][slotId] = {
                        n: equipped.item['名称'], // name
                        e: equipped.enchantLevel  // enchantLevel
                    };
                }
            }
        }

        if (Object.keys(equipmentDataToShare).length === 0) {
            alert('共有できる装備データがありません。');
            return;
        }

        const jsonString = JSON.stringify(equipmentDataToShare);
        const compressed = pako.deflate(jsonString);
        const encodedData = btoa(String.fromCharCode.apply(null, compressed))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

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
                // グローバルスコープの `setupDatabase` (from db-setup.js) を呼び出す
                if (typeof window.setupDatabase === 'function') {
                    window.setupDatabase()
                        .then(() => {
                            console.log("データベースのセットアップが完了しました。");
                            // 再度DBを開きなおす
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
        const button = document.createElement('button');
        button.textContent = `${setId}`;
        button.className = 'copy-source-button';
        if (setId === activeSetId) {
            button.classList.add('disabled');
            button.disabled = true;
        } else {
            button.onclick = () => copySetFrom(setId);
        }
        optionsContainer.appendChild(button);
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

function calculateStatsForSet(items) {
    const totalStats = {};
    const percentStats = new Set();
    if (!items) return { totalStats, percentStats };

    for (const slotId in items) {
        // ▼【変更点】新しいデータ構造に対応
        const equipped = items[slotId];
        if (!equipped || !equipped.item) continue;

        const item = equipped.item;
        const enchantLevel = equipped.enchantLevel || 0;
        const enchantBonus = getEnchantBonus(item, enchantLevel);

        for (const statName of STAT_HEADERS) {
            const baseValue = parseFloat(item[statName]) || 0;
            const bonusValue = enchantBonus[statName] || 0;
            const value = baseValue + bonusValue;

            if (value !== 0) {
                // パーセント表記のステータスかを判定
                if (String(item[statName]).includes('%') || (baseValue > 0 && baseValue < 1 && !Number.isInteger(baseValue))) {
                    percentStats.add(statName);
                }
                totalStats[statName] = (totalStats[statName] || 0) + value;
            }
        }
    }
    return { totalStats, percentStats };
}

// ▼【新規追加】強化ボーナスを計算する関数
function getEnchantBonus(item, enchantLevel) {
    const bonus = {};
    if (!item || enchantLevel <= 0) return bonus;

    const itemCategory = getCategoryFromType(item['タイプ']);

    // 武器は「基本攻撃力」、防具は「防御力」が、元の値の5% x 強化値分、加算されるルール
    if (itemCategory === 'weapon') {
        const baseAttack = parseFloat(item['基本攻撃力']) || 0;
        if (baseAttack > 0) {
            bonus['基本攻撃力'] = Math.round(baseAttack * 0.05 * enchantLevel);
        }
    } else if (itemCategory === 'armor') {
        const baseDefense = parseFloat(item['防御力']) || 0;
        if (baseDefense > 0) {
            bonus['防御力'] = Math.round(baseDefense * 0.05 * enchantLevel);
        }
    }

    return bonus;
}

function renderComparisonSelector() {
    const container = document.getElementById('comparison-controls');
    if (!container) return;

    container.innerHTML = '<label class="comparison-label">比較対象:</label>';

    const selectorDiv = document.createElement('div');
    selectorDiv.id = 'comparison-set-selector';

    const noneId = `comp-none`;
    const noneInput = document.createElement('input');
    noneInput.type = 'radio';
    noneInput.id = noneId;
    noneInput.name = 'comparison-set';
    noneInput.value = 'none';
    noneInput.checked = comparisonSetId === null;
    const noneLabel = document.createElement('label');
    noneLabel.htmlFor = noneId;
    noneLabel.textContent = 'なし';
    selectorDiv.appendChild(noneInput);
    selectorDiv.appendChild(noneLabel);

    for (let i = 1; i <= 4; i++) {
        const setId = String(i);
        const radioId = `comp-${setId}`;
        const input = document.createElement('input');
        input.type = 'radio';
        input.id = radioId;
        input.name = 'comparison-set';
        input.value = setId;
        input.checked = comparisonSetId === setId;
        input.disabled = setId === activeSetId;
        const label = document.createElement('label');
        label.htmlFor = radioId;
        label.textContent = `${setId}`;
        selectorDiv.appendChild(input);
        selectorDiv.appendChild(label);
    }

    container.appendChild(selectorDiv);

    selectorDiv.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', (event) => {
            comparisonSetId = event.target.value === 'none' ? null : event.target.value;
            calculateAndRenderStats();
        });
    });
}

function renderSortOrderControls() {
    const container = document.getElementById('sort-order-controls');
    if (!container) return;
    container.innerHTML = '';

    const button = document.createElement('button');
    button.id = 'toggle-sort-mode-button';
    button.textContent = isSortMode ? '確定' : '順番変更';
    button.onclick = handleToggleSortMode;
    container.appendChild(button);

    const managementDiv = document.createElement('div');
    managementDiv.id = 'sort-order-management';

    Object.keys(sortOrders).forEach(key => {
        const setDiv = document.createElement('div');
        setDiv.className = 'sort-order-set';

        const link = document.createElement('a');
        link.href = '#';
        link.textContent = key;
        link.className = 'sort-order-link';
        if (key === activeSortKey) {
            link.classList.add('active');
        }
        link.onclick = (e) => {
            e.preventDefault();
            if (isSortMode) return;
            activeSortKey = key;
            localStorage.setItem(ACTIVE_SORT_KEY, activeSortKey);
            calculateAndRenderStats();
        };
        setDiv.appendChild(link);

        const renameButton = document.createElement('button');
        renameButton.textContent = '✏️';
        renameButton.className = 'sort-order-action rename-button';
        renameButton.title = '名称変更';
        renameButton.onclick = (e) => {
            e.preventDefault();
            if (isSortMode) return;
            handleRenameSortOrder(key);
        };
        setDiv.appendChild(renameButton);

        if (key !== 'default') {
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '❌';
            deleteButton.className = 'sort-order-action delete-button';
            deleteButton.title = '削除';
            deleteButton.onclick = (e) => {
                e.preventDefault();
                if (isSortMode) return;
                handleDeleteSortOrder(key);
            };
            setDiv.appendChild(deleteButton);
        }

        managementDiv.appendChild(setDiv);
    });

    container.appendChild(managementDiv);
}

function handleToggleSortMode() {
    const statsList = document.querySelector('.stats-list');
    if (!statsList) return;

    // isSortMode の状態を切り替える前に、現在のstat-entryのリストを取得
    const currentStatNames = Array.from(statsList.querySelectorAll('.stat-entry')).map(el => el.dataset.statName);

    if (!isSortMode && !sortOrders.default) {
        sortOrders.default = currentStatNames; // 初回は現在の表示順をdefaultとして保存
    }

    if (isSortMode) { // 確定時
        const newOrder = Array.from(statsList.querySelectorAll('.stat-entry')).map(el => el.dataset.statName);
        sortOrders[activeSortKey] = newOrder;
        saveSortOrders();
        toggleSortModeUI(false);
    } else { // 変更開始時
        if (sortOrders.default) {
            const content = document.createElement('p');
            content.textContent = `「${activeSortKey}」を編集しますか、それとも新しい並び順を追加しますか？`;

            const buttons = [
                {
                    text: `「${activeSortKey}」を変更`,
                    class: 'secondary',
                    onClick: () => {
                        toggleSortModeUI(true);
                        closeModal();
                    }
                },
                {
                    text: '新規作成',
                    class: 'primary',
                    onClick: () => {
                        closeModal();
                        handleCreateNewSortOrder();
                    }
                },
            ];
            showModal('並び順の編集', content, buttons);
        } else { // 初回のみ
            toggleSortModeUI(true);
        }
    }
}


function handleCreateNewSortOrder() {
    const content = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = '新しい並び順セットの名前を入力してください。';
    p.style.marginBottom = '10px';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '例: 火力重視';
    content.appendChild(p);
    content.appendChild(input);

    const buttons = [
        {
            text: 'キャンセル',
            class: 'secondary',
            onClick: () => closeModal()
        },
        {
            text: '作成',
            class: 'primary',
            onClick: () => {
                let newName = input.value.trim();
                if (!newName) {
                    alert('名前を入力してください。');
                    return;
                }
                if (sortOrders[newName]) {
                    alert('同じ名前のセットが既に存在します。');
                    return;
                }
                const baseOrder = sortOrders.default || Array.from(document.querySelectorAll('.stats-list .stat-entry')).map(el => el.dataset.statName);
                sortOrders[newName] = [...baseOrder];
                activeSortKey = newName;
                saveSortOrders();
                isSortMode = true;
                toggleSortModeUI(true);
                closeModal();
            }
        }
    ];
    showModal('新しい並び順セット', content, buttons);
}


function handleRenameSortOrder(oldName) {
    const content = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = `「${oldName}」の新しい名前を入力してください。`;
    p.style.marginBottom = '10px';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
    content.appendChild(p);
    content.appendChild(input);

    const buttons = [
        {
            text: 'キャンセル',
            class: 'secondary',
            onClick: () => closeModal()
        },
        {
            text: '変更',
            class: 'primary',
            onClick: () => {
                const newName = input.value.trim();
                if (!newName) {
                    alert('名前を入力してください。');
                    return;
                }
                if (newName !== oldName && sortOrders[newName]) {
                    alert('同じ名前のセットが既に存在します。');
                    return;
                }
                if (newName === oldName) {
                    closeModal();
                    return;
                }

                sortOrders[newName] = sortOrders[oldName];
                delete sortOrders[oldName];

                if (activeSortKey === oldName) {
                    activeSortKey = newName;
                }
                saveSortOrders();
                calculateAndRenderStats();
                closeModal();
            }
        }
    ];
    showModal('名称変更', content, buttons);
}

function handleDeleteSortOrder(keyToDelete) {
    const content = document.createElement('p');
    content.textContent = `並び順セット「${keyToDelete}」を本当に削除しますか？`;

    const buttons = [
        {
            text: 'キャンセル',
            class: 'secondary',
            onClick: () => closeModal()
        },
        {
            text: '削除',
            class: 'primary',
            onClick: () => {
                delete sortOrders[keyToDelete];
                if (activeSortKey === keyToDelete) {
                    activeSortKey = 'default';
                }
                saveSortOrders();
                calculateAndRenderStats();
                closeModal();
            }
        }
    ];
    showModal('削除の確認', content, buttons);
}

function toggleSortModeUI(enable) {
    const statsList = document.querySelector('.stats-list');
    const button = document.getElementById('toggle-sort-mode-button');

    if (enable) {
        isSortMode = true;
        button.textContent = '確定';
        statsList.classList.add('is-sorting');

        if (sortableInstance) sortableInstance.destroy();
        sortableInstance = new Sortable(statsList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
        });

    } else {
        isSortMode = false;
        button.textContent = '順番変更';
        statsList.classList.remove('is-sorting');

        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
        }
        calculateAndRenderStats();
    }
}

function saveSortOrders() {
    localStorage.setItem(SORT_ORDERS_KEY, JSON.stringify(sortOrders));
    localStorage.setItem(ACTIVE_SORT_KEY, activeSortKey);
}
function loadSortOrders() {
    sortOrders = JSON.parse(localStorage.getItem(SORT_ORDERS_KEY)) || {};
    activeSortKey = localStorage.getItem(ACTIVE_SORT_KEY) || 'default';
    if (!sortOrders[activeSortKey]) {
        activeSortKey = 'default';
    }
}

function showModal(title, contentElement, buttons) {
    const modal = document.getElementById('generic-modal-overlay');
    if (!modal) return;

    document.getElementById('generic-modal-title').textContent = title;

    const contentContainer = document.getElementById('generic-modal-content');
    contentContainer.innerHTML = '';
    contentContainer.appendChild(contentElement);

    const buttonsContainer = document.getElementById('generic-modal-buttons');
    buttonsContainer.innerHTML = '';
    buttons.forEach(btnInfo => {
        const button = document.createElement('button');
        button.textContent = btnInfo.text;
        button.className = btnInfo.class;
        button.onclick = btnInfo.onClick;
        buttonsContainer.appendChild(button);
    });

    modal.classList.remove('hidden');
    const firstInput = contentContainer.querySelector('input');
    if (firstInput) {
        firstInput.focus();
    }
}

function closeModal() {
    const modal = document.getElementById('generic-modal-overlay');
    if (modal) modal.classList.add('hidden');
}