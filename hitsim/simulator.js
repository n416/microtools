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
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await openDatabase();
        await loadEquippedItems(); // awaitを追加して完了を待つ
        await loadAndRenderInventory();
        setupGlobalClickListener();
        calculateAndRenderStats(); // ★★★ 初期表示時にもステータスを計算
    } catch (error) { console.error('初期化中にエラーが発生しました:', error); }
});

// --- 関数定義 ---
// (openDatabase, getItemFromDB, renderInventory, handleInventoryClick, handleSlotClick は変更なし)
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => { const db = e.target.result; if (!db.objectStoreNames.contains(STORE_NAME)) { db.createObjectStore(STORE_NAME, { keyPath: '名称' }); } };
        request.onerror = (e) => reject('DBオープン失敗:', e.target.error);
        request.onsuccess = (e) => { db = e.target.result; resolve(); };
    });
}
async function loadAndRenderInventory() {
    const inventoryItemNames = JSON.parse(localStorage.getItem(INVENTORY_KEY)) || [];
    if (inventoryItemNames.length === 0) { document.getElementById('inventory-list').innerHTML = '<p style="padding: 10px;">インベントリにアイテムがありません。<br><a href="data.html">インベントリ編集ページ</a>でアイテムを追加してください。</p>'; return; }
    const itemPromises = inventoryItemNames.map(name => getItemFromDB(name));
    const inventoryItems = (await Promise.all(itemPromises)).filter(item => item);
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
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'inventory-item';
        itemDiv.id = `inv-${item['名称']}`;
        itemDiv.title = `${item['名称']}\nタイプ: ${item['タイプ']}`;
        const img = document.createElement('img');
        img.src = item['画像URL'] || '';
        img.alt = item['名称'];
        img.className = 'item-icon';
        itemDiv.appendChild(img);
        itemDiv.addEventListener('click', (e) => { e.stopPropagation(); handleInventoryClick(item); });
        inventoryListDiv.appendChild(itemDiv);
    });
}
function handleInventoryClick(item) {
    if (selectedInventoryItem && selectedInventoryItem['名称'] === item['名称']) {
        equipItem(item);
        clearAllSelections();
    } else {
        clearAllSelections();
        selectedInventoryItem = item;
        document.getElementById(`inv-${item['名称']}`).classList.add('selected');
    }
}
function handleSlotClick(slotId) {
    if (equippedItems[slotId]) {
        if (selectedSlotId === slotId) {
            unequipItem(slotId);
            clearAllSelections();
        } else {
            clearAllSelections();
            selectedSlotId = slotId;
            document.getElementById(slotId).classList.add('selected');
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

    // リング以外の場合、すでに同じ名前のユニークアイテムが装備されていないかチェック
    if (!isRing) {
        if (Object.values(equippedItems).some(equipped => equipped && equipped['名称'] === item['名称'])) {
            console.log(`ユニークアイテム「${item['名称']}」はすでに装備されています。`);
            return;
        }
    }

    // 1. まず、そのアイテム種別が装備できるスロットに空きがあるかを探す
    const emptySlotId = possibleSlotIds.find(id => !equippedItems[id]);

    if (emptySlotId) {
        // --- ケースA: 空きスロットがある場合 (全アイテム共通) ---
        // 見つかった最初の空きスロットに装備する
        equippedItems[emptySlotId] = item;
        renderSlot(emptySlotId);

    } else {
        // --- ケースB: 該当スロットが全て埋まっている場合 ---
        if (isRing) {
            // --- リングが満杯の場合：FIFOロジックを実行 ---
            // 5番目のアイテムを覚えておく
            const pushedOutItem = equippedItems[possibleSlotIds[4]];
            console.log(`リング枠が満杯のため、「${pushedOutItem['名称']}」が押し出されます。`);

            // 4→5, 3→4, 2→3, 1→2 へと装備情報をずらす
            for (let i = possibleSlotIds.length - 2; i >= 0; i--) {
                const currentSlotId = possibleSlotIds[i];
                const nextSlotId = possibleSlotIds[i + 1];
                equippedItems[nextSlotId] = equippedItems[currentSlotId];
            }
            // 1番目に新しいリングを装備
            equippedItems[possibleSlotIds[0]] = item;

            // 全てのリングスロットを再描画
            possibleSlotIds.forEach(id => renderSlot(id));

        } else {
            // --- リング以外が満杯の場合：最初のスロットを上書き ---
            const targetSlotId = possibleSlotIds[0];

            if (equippedItems[targetSlotId] && equippedItems[targetSlotId]['名称'] === item['名称']) {
                return;
            }

            unequipItem(targetSlotId, false); // 元のアイテムを外す
            equippedItems[targetSlotId] = item; // 新しいアイテムを装備
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
    newSlotElement.addEventListener('click', (e) => { e.stopPropagation(); handleSlotClick(slotId); });
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

    // 1. 全ての装備アイテムのステータスを合計する
    for (const slotId in equippedItems) {
        const item = equippedItems[slotId];
        for (const statName of STAT_HEADERS) {
            const value = parseFloat(item[statName]) || 0;
            if (value !== 0) {
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
            // 値が0より大きく1未満の場合、パーセントに変換して表示
            if (value > 0 && value < 1) {
                const percentValue = value * 100;
                // パーセントにした結果が整数なら小数点以下を表示しない
                valueSpan.textContent = (Number.isInteger(percentValue) ? percentValue : percentValue.toFixed(1)) + '%';
            } else {
                // 1以上の値はそのまま表示（整数でない場合は小数点以下2桁まで）
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