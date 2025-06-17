// ===============================================
// simulator.js : メイン画面用スクリプト (強化機能追加版)
// ===============================================

// --- グローバル定数・変数 ---
const DB_NAME = 'GameEquipmentDB';
const DB_VERSION = 12;
const STORE_NAME = 'equipment';
const INVENTORY_KEY = 'equipmentInventory_v2';
const INVENTORY_ENHANCEMENTS_KEY = 'inventoryEnhancements_v1';
const EQUIPMENT_SETS_KEY = 'equipmentSets_v2';
const ACTIVE_SET_ID_KEY = 'activeEquipmentSet_v1';
const SORT_ORDERS_KEY = 'equipmentSortOrders_v1';
const ACTIVE_SORT_KEY = 'activeSortOrderKey_v1';
const CUSTOM_TABS_KEY = 'customInventoryTabs_v1';

let db;
let allEnhancementData = {};
let inventoryEnhancements = {};
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
let selectedInstanceId = null;
let selectedSlotId = null;

let detailsPanel, detailsItemName, detailsItemImage, detailsStatsList;
let enchantControls, enchantDownButton, enchantUpButton, detailsItemEnchant;

let allInventoryItems = [];
let activeTabInfo = { type: 'category', value: 'all' };

let customTabs = [];
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
            const sharedSets = JSON.parse(jsonString);

            const allItemNames = new Set();
            for (const setId in sharedSets) {
                for (const slotId in sharedSets[setId]) {
                    // sharedSets[setId][slotId].n が undefined の可能性がある
                    allItemNames.add(sharedSets[setId][slotId].n); // name
                }
            }

            const validItemNames = Array.from(allItemNames).filter(name => name);
            const foundItems = await getItemsFromDBByNames(validItemNames);
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
            const newInventorySet = new Set([...currentInventory, ...validItemNames]);
            localStorage.setItem(INVENTORY_KEY, JSON.stringify(Array.from(newInventorySet)));
            console.log("復元された装備アイテムをインベントリに自動追加しました。");

        } catch (e) {
            console.error('共有データの処理中にエラーが発生しました:', e);
            alert('データの読み込みに失敗しました。URLが破損しているか、非対応のデータ形式の可能性があります。');
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

        enchantControls = document.getElementById('enchant-controls');
        enchantDownButton = document.getElementById('enchant-down-button');
        enchantUpButton = document.getElementById('enchant-up-button');
        detailsItemEnchant = document.getElementById('details-item-enchant');

        await openDatabase();

        try {
            const transaction = db.transaction(['enhancementData'], 'readonly');
            const store = transaction.objectStore('enhancementData');
            const request = store.getAll();

            await new Promise((resolve) => {
                request.onsuccess = (event) => {
                    const results = event.target.result;
                    results.forEach(item => {
                        allEnhancementData[item.rank] = item.data;
                    });
                    resolve();
                };
                request.onerror = (event) => {
                    console.error('強化データの読み込みに失敗しました:', event.target.error);
                    resolve();
                };
            });
        } catch (e) {
            console.error("強化データキャッシュ中にエラーが発生しました（処理は続行）:", e);
        }

        loadSortOrders();
        loadInventoryEnhancements();
        await loadAllEquipmentSets();
        loadCustomTabs();
        await loadAndRenderInventory();
        setupGlobalClickListener();
        setupInventoryTabs();
        setupInventorySearch(); // 検索機能の初期化を追加
        setupShareButton();
        setupSetControls();
        setupEnchantControls();
        setupDetailsActionButtons();
        calculateAndRenderStats();
    } catch (error) { console.error('初期化中にエラーが発生しました:', error); }
}

function setupDetailsActionButtons() {
    document.getElementById('details-action-set').addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedInventoryItem && selectedInstanceId) {
            equipInstance(selectedInventoryItem, selectedInstanceId);
            clearAllSelections();
        }
    });

    document.getElementById('details-action-duplicate').addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedInventoryItem && selectedInstanceId) {
            const itemName = selectedInventoryItem['名称'];
            const instances = inventoryEnhancements[itemName];
            const sourceInstance = instances?.find(inst => inst.instanceId === selectedInstanceId);

            if (sourceInstance) {
                const newInstance = {
                    instanceId: Date.now() + Math.random(),
                    Lv: sourceInstance.Lv
                };
                instances.push(newInstance);
                saveInventoryEnhancements();
                renderInventory(allInventoryItems);
            }
            clearAllSelections();
        }
    });

    document.getElementById('details-action-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedInventoryItem && selectedInstanceId) {
            deleteInstance(selectedInventoryItem, selectedInstanceId);
        }
    });
}

function deleteInstance(item, instanceId) {
    const itemName = item['名称'];
    const instances = inventoryEnhancements[itemName];
    if (!instances) return;

    const instanceIndex = instances.findIndex(inst => inst.instanceId === instanceId);
    if (instanceIndex === -1) return;

    const instanceLv = instances[instanceIndex].Lv;
    if (!confirm(`${itemName} (+${instanceLv}) を削除します。よろしいですか？`)) {
        return;
    }

    instances.splice(instanceIndex, 1);

    if (instances.length === 0) {
        delete inventoryEnhancements[itemName];

        let masterInventory = JSON.parse(localStorage.getItem(INVENTORY_KEY)) || [];
        masterInventory = masterInventory.filter(name => name !== itemName);
        localStorage.setItem(INVENTORY_KEY, JSON.stringify(masterInventory));

        allInventoryItems = allInventoryItems.filter(i => i['名称'] !== itemName);
    }

    saveInventoryEnhancements();
    renderInventory(allInventoryItems);
    clearAllSelections();
}


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

function updateEnchantLevel(change) {
    let newLevel;
    let currentLevel;

    if (selectedSlotId && equippedItems[selectedSlotId]) {
        const equipped = equippedItems[selectedSlotId];
        currentLevel = equipped.enchantLevel;
        newLevel = currentLevel + change;

        if (newLevel < 0) newLevel = 0;
        if (newLevel > 12) newLevel = 12;

        if (newLevel !== currentLevel) {
            equipped.enchantLevel = newLevel;
            renderSlot(selectedSlotId);
            displayItemDetails(equipped.item, document.getElementById(selectedSlotId));
            saveAllEquipmentSets();
        }

    } else if (selectedInventoryItem && selectedInstanceId) {
        const itemName = selectedInventoryItem['名称'];
        const instance = inventoryEnhancements[itemName]?.find(inst => inst.instanceId === selectedInstanceId);
        if (!instance) return;

        currentLevel = instance.Lv;
        newLevel = currentLevel + change;

        if (newLevel < 0) newLevel = 0;
        if (newLevel > 12) newLevel = 12;

        if (newLevel !== currentLevel) {
            instance.Lv = newLevel;
            saveInventoryEnhancements();
            refreshInventoryView();

            const targetElement = document.getElementById(`inv-instance-${selectedInstanceId}`);
            if (targetElement) {
                targetElement.classList.add('selected');
                displayItemDetails(selectedInventoryItem, targetElement);
            } else {
                hideItemDetails();
            }
        }
    } else {
        return;
    }

    if (newLevel !== undefined && newLevel !== currentLevel) {
        calculateAndRenderStats();
    }
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: '名称' });
            }
            if (!db.objectStoreNames.contains('enhancementData')) {
                db.createObjectStore('enhancementData', { keyPath: 'rank' });
            }
            if (!db.objectStoreNames.contains('setBonuses')) {
                db.createObjectStore('setBonuses', { keyPath: 'setName' });
            }
        };

        request.onerror = (e) => {
            reject('DBオープン失敗:', e.target.error);
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
    });
}

async function loadAndRenderInventory() {
    const inventoryItemNames = JSON.parse(localStorage.getItem(INVENTORY_KEY)) || [];
    if (inventoryItemNames.length === 0) {
        document.getElementById('inventory-list').innerHTML = '<p style="padding: 10px;">インベントリにアイテムがありません。<br><a href="data.html">インベントリ編集ページ</a>でアイテムを追加してください。</p>';
        allInventoryItems = [];
        return;
    }

    const inventoryItems = await getItemsFromDBByNames(inventoryItemNames);
    allInventoryItems = inventoryItems.filter(item => item);

    let enhancementsModified = false;
    allInventoryItems.forEach(item => {
        const itemName = item['名称'];
        if (!inventoryEnhancements[itemName] || inventoryEnhancements[itemName].length === 0) {
            inventoryEnhancements[itemName] = [{ instanceId: Date.now() + Math.random(), Lv: 0 }];
            enhancementsModified = true;
        }
    });

    if (enhancementsModified) {
        saveInventoryEnhancements();
    }

    refreshInventoryView();
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
                    resolve(results);
                }
            };
        });
    });
}

function renderInventory(itemsToDisplay) {
    const inventoryListDiv = document.getElementById('inventory-list');
    inventoryListDiv.innerHTML = '';

    itemsToDisplay.forEach(item => {
        const itemName = item['名称'];
        const instances = inventoryEnhancements[itemName] || [];

        const itemInstancesToRender = instances.filter(instance =>
            itemsToDisplay.some(displayItem => displayItem['名称'] === itemName)
        );

        if (itemInstancesToRender.length > 0) {
            itemInstancesToRender.forEach(instance => {
                const itemDiv = createInventoryItemElement(item, instance);
                inventoryListDiv.appendChild(itemDiv);
            });
        }
    });
}

function createInventoryItemElement(item, instance) {
    const enchantLevel = instance.Lv;
    const enchantText = enchantLevel > 0 ? `+${enchantLevel}` : '';

    const itemDiv = document.createElement('div');
    itemDiv.className = 'inventory-item';
    itemDiv.id = `inv-instance-${instance.instanceId}`;
    itemDiv.title = `${item['名称']} ${enchantText}\nタイプ: ${item['タイプ']}`;
    itemDiv.style.position = 'relative';

    const img = document.createElement('img');
    img.src = item['画像URL'] || '';
    img.alt = item['名称'];
    img.className = 'item-icon';
    itemDiv.appendChild(img);

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
        itemDiv.appendChild(enchantDiv);
    }

    itemDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        handleInventoryClick(item, instance, e.currentTarget);
    });

    return itemDiv;
}

function handleInventoryClick(item, instance, element) {
    if (selectedInstanceId === instance.instanceId) {
        equipInstance(item, instance.instanceId);
        clearAllSelections();
    } else {
        clearAllSelections();
        selectedInventoryItem = item;
        selectedInstanceId = instance.instanceId;
        element.classList.add('selected');
        displayItemDetails(item, element);
    }
}

function handleSlotClick(slotId, element) {
    const equipped = equippedItems[slotId];
    if (equipped) {
        if (selectedSlotId === slotId) {
            unequipItem(slotId);
            clearAllSelections();
        } else {
            clearAllSelections();
            selectedSlotId = slotId;
            element.classList.add('selected');
            displayItemDetails(equipped.item, element);
        }
    }
}

function equipInstance(item, instanceId) {
    const itemType = item['タイプ'];
    const slotCategory = TYPE_TO_SLOT_CATEGORY[itemType];
    if (!slotCategory) return;

    const sourceInstance = inventoryEnhancements[item['名称']]?.find(inst => inst.instanceId === instanceId) || { Lv: 0 };

    const itemToEquip = {
        item: item,
        enchantLevel: sourceInstance.Lv,
        instanceId: Date.now() + Math.random()
    };

    const possibleSlotIds = SLOT_CATEGORY_TO_IDS[slotCategory];
    const emptySlotId = possibleSlotIds.find(id => !equippedItems[id]);

    if (emptySlotId) {
        equippedItems[emptySlotId] = itemToEquip;
        renderSlot(emptySlotId);
    } else {
        if (slotCategory === 'ring') {
            const lastRingSlotId = possibleSlotIds[possibleSlotIds.length - 1];
            if (equippedItems[lastRingSlotId]) {
                unequipItem(lastRingSlotId, false);
            }
            for (let i = possibleSlotIds.length - 2; i >= 0; i--) {
                const currentSlotId = possibleSlotIds[i];
                const nextSlotId = possibleSlotIds[i + 1];
                if (equippedItems[currentSlotId]) {
                    equippedItems[nextSlotId] = equippedItems[currentSlotId];
                    delete equippedItems[currentSlotId];
                }
            }
            equippedItems[possibleSlotIds[0]] = itemToEquip;
            possibleSlotIds.forEach(id => renderSlot(id));
        } else {
            const targetSlotId = possibleSlotIds[0];
            unequipItem(targetSlotId, false);
            equippedItems[targetSlotId] = itemToEquip;
            renderSlot(targetSlotId);
        }
    }

    saveAllEquipmentSets();
    calculateAndRenderStats();
}

function unequipItem(slotId, doSaveAndRecalculate = true) {
    if (equippedItems[slotId]) {
        const unequipped = equippedItems[slotId];
        const itemName = unequipped.item['名称'];
        const enchantLevel = unequipped.enchantLevel;

        if (!inventoryEnhancements[itemName]) {
            inventoryEnhancements[itemName] = [];
        }
        const instances = inventoryEnhancements[itemName];

        const alreadyExists = instances.some(inst => inst.Lv === enchantLevel);

        if (!alreadyExists) {
            instances.push({
                instanceId: unequipped.instanceId,
                Lv: enchantLevel
            });
        }

        delete equippedItems[slotId];

        if (doSaveAndRecalculate) {
            saveInventoryEnhancements();
            saveAllEquipmentSets();
            renderInventory(allInventoryItems);
            renderSlot(slotId);
            calculateAndRenderStats();
        } else {
            renderSlot(slotId);
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

    const equipped = equippedItems[slotId];
    if (equipped) {
        const item = equipped.item;
        const enchantLevel = equipped.enchantLevel;
        const enchantText = enchantLevel > 0 ? `+${enchantLevel}` : '';

        newSlotElement.title = `${item['名称']} ${enchantText}\nタイプ: ${item['タイプ']}`;
        const img = document.createElement('img');
        img.src = item['画像URL'] || '';
        img.alt = item['名称'];
        img.className = 'item-icon';
        newSlotElement.appendChild(img);

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

function saveInventoryEnhancements() {
    localStorage.setItem(INVENTORY_ENHANCEMENTS_KEY, JSON.stringify(inventoryEnhancements));
}

function loadInventoryEnhancements() {
    let enhancements = JSON.parse(localStorage.getItem(INVENTORY_ENHANCEMENTS_KEY)) || {};
    let needsSave = false;

    for (const itemName in enhancements) {
        if (Object.prototype.hasOwnProperty.call(enhancements, itemName)) {
            const instances = enhancements[itemName];
            if (Array.isArray(instances)) {
                instances.forEach(instance => {
                    if (typeof instance === 'object' && instance !== null && !Object.prototype.hasOwnProperty.call(instance, 'instanceId')) {
                        console.warn(`「${itemName}」のインスタンスにIDがありません。新しいIDを付与します。`, instance);
                        instance.instanceId = Date.now() + Math.random();
                        needsSave = true;
                    }
                });
            }
        }
    }

    if (needsSave) {
        console.log('破損したインスタンスデータを修正し、保存しました。');
        localStorage.setItem(INVENTORY_ENHANCEMENTS_KEY, JSON.stringify(enhancements));
    }

    inventoryEnhancements = enhancements;
}

async function loadAllEquipmentSets() {
    activeSetId = localStorage.getItem(ACTIVE_SET_ID_KEY) || '1';
    const savedSets = JSON.parse(localStorage.getItem(EQUIPMENT_SETS_KEY)) || { '1': {}, '2': {}, '3': {}, '4': {} };

    const allEquippedItemNames = new Set();
    for (const setId in savedSets) {
        for (const slotId in savedSets[setId]) {
            const equipped = savedSets[setId][slotId];
            if (equipped && equipped.item && equipped.item['名称']) {
                allEquippedItemNames.add(equipped.item['名称']);
            }
        }
    }

    if (allEquippedItemNames.size > 0) {
        const freshItems = await getItemsFromDBByNames(Array.from(allEquippedItemNames));
        const freshItemsMap = new Map(freshItems.map(item => [item['名称'], item]));

        for (const setId in savedSets) {
            for (const slotId in savedSets[setId]) {
                const equipped = savedSets[setId][slotId];
                if (equipped && equipped.item && freshItemsMap.has(equipped.item['名称'])) {
                    equipped.item = freshItemsMap.get(equipped.item['名称']);
                }
            }
        }
    }
    allEquipmentSets = savedSets;
    equippedItems = allEquipmentSets[activeSetId] || {};

    renderAllSlots();
    updateSetButtonsUI();
}

function renderAllSlots() {
    document.querySelectorAll('.slot').forEach(slotElement => renderSlot(slotElement.id));
}

function clearAllSelections() {
    if (selectedInventoryItem) {
        const selectedElem = document.getElementById(`inv-instance-${selectedInstanceId}`);
        if (selectedElem) selectedElem.classList.remove('selected');
        selectedInventoryItem = null;
        selectedInstanceId = null;
    }
    if (selectedSlotId) {
        const selectedElem = document.getElementById(selectedSlotId);
        if (selectedElem) selectedElem.classList.remove('selected');
        selectedSlotId = null;
    }
    hideItemDetails();
}

function setupGlobalClickListener() {
    document.body.addEventListener('click', (event) => {
        if (event.target.closest('.slot') ||
            event.target.closest('.inventory-item') ||
            event.target.closest('#item-details-panel')) {
            return;
        }
        clearAllSelections();
    });
}

async function calculateAndRenderStats() {
    const { totalStats, percentStats, activeSetBonuses, activeSetInfo } = await calculateStatsForSet(equippedItems);
    const { totalStats: comparisonTotalStats } = await calculateStatsForSet(allEquipmentSets[comparisonSetId] || {});
    const statsPanel = document.getElementById('stats-panel');
    statsPanel.innerHTML = '';

    document.querySelectorAll('.slot').forEach(slot => {
        for (let i = 1; i <= 4; i++) {
            slot.classList.remove(`set-highlight-${i}`);
        }
    });

    if (activeSetInfo) {
        let highlightCounter = 1;
        for (const setName in activeSetInfo) {
            const info = activeSetInfo[setName];
            if (info.slots && highlightCounter <= 4) {
                info.slots.forEach(slotId => {
                    const slotElement = document.getElementById(slotId);
                    if (slotElement) {
                        slotElement.classList.add(`set-highlight-${highlightCounter}`);
                    }
                });
                highlightCounter++;
            }
        }
    }

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
            if (comparisonSetId && comparisonTotalStats) {
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

    if (activeSetBonuses && activeSetBonuses.length > 0) {
        const setBonusContainer = document.createElement('div');
        setBonusContainer.style.padding = '10px';
        setBonusContainer.style.borderRadius = '4px';

        const uniqueBonuses = {};
        activeSetBonuses.forEach(b => {
            const key = `${b.setName}-${b.count}`;
            uniqueBonuses[key] = b;
        });

        Object.values(uniqueBonuses).forEach(bonus => {
            const effectDiv = document.createElement('div');
            effectDiv.style.fontSize = '14px';
            effectDiv.style.padding = '2px 0';
            const setNameSpan = document.createElement('strong');
            setNameSpan.textContent = `[${bonus.setName}] (${bonus.count}セット): `;
            const statsText = Object.entries(bonus.stats)
                .map(([name, value]) => `${name} +${String(value).includes('.') && value < 1 ? (value * 100).toFixed(0) + '%' : value}`)
                .join(', ');
            effectDiv.appendChild(setNameSpan);
            effectDiv.append(statsText);
            setBonusContainer.appendChild(effectDiv);
        });
        statsPanel.appendChild(setBonusContainer);
    }

    const sortControlsContainer = document.createElement('div');
    sortControlsContainer.id = 'sort-order-controls';
    statsPanel.appendChild(sortControlsContainer);
    renderSortOrderControls();
}

function displayItemDetails(item, clickedElement) {
    if (!item || !detailsPanel || !clickedElement) return;

    let enchantLevel = 0;

    if (selectedSlotId && equippedItems[selectedSlotId]) {
        enchantLevel = equippedItems[selectedSlotId].enchantLevel;
    } else if (selectedInventoryItem && selectedInstanceId) {
        const instances = inventoryEnhancements[selectedInventoryItem['名称']];
        const instance = instances?.find(inst => inst.instanceId === selectedInstanceId);
        if (instance) {
            enchantLevel = instance.Lv;
        }
    }

    detailsItemName.textContent = item['名称'];
    detailsItemImage.src = item['画像URL'] || '';
    detailsItemImage.alt = item['名称'];
    detailsStatsList.innerHTML = '';

    const detailsActions = document.getElementById('details-actions');
    if (selectedInstanceId) {
        detailsActions.classList.remove('hidden');
    } else {
        detailsActions.classList.add('hidden');
    }

    if (selectedSlotId || selectedInstanceId) {
        enchantControls.classList.remove('hidden');
        detailsItemEnchant.textContent = enchantLevel > 0 ? `+${enchantLevel}` : '無強化';
        enchantDownButton.disabled = enchantLevel <= 0;
        enchantUpButton.disabled = enchantLevel >= 12;
    } else {
        enchantControls.classList.add('hidden');
    }

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
                if (baseStats[statName] > 0 && baseStats[statName] < 1) {
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

    if (item['セット名'] && item['セット名'] !== '-') {
        const setDiv = document.createElement('div');
        setDiv.className = 'details-set-name';
        setDiv.textContent = `セット：${item['セット名']}`;
        setDiv.style.fontWeight = 'bold';
        setDiv.style.paddingBottom = '8px';
        setDiv.style.marginTop = '5px';
        setDiv.style.borderBottom = '1px solid #555';
        detailsStatsList.appendChild(setDiv);
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

function setupInventorySearch() {
    const searchInput = document.getElementById('inventory-search-input');
    const searchButton = document.getElementById('inventory-search-button');

    if (!searchInput || !searchButton) {
        console.warn('検索用のUI要素が見つかりませんでした。');
        return;
    }

    const applyFilter = () => {
        // 表示更新関数を呼び出すだけ
        refreshInventoryView();
    };

    // 虫眼鏡ボタンクリックで検索実行
    searchButton.addEventListener('click', applyFilter);

    // テキストボックスでEnterキーを押したら検索実行
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            applyFilter();
        }
    });

    // テキストボックスが空になったらリアルタイムでフィルタ解除
    searchInput.addEventListener('input', () => {
        if (searchInput.value.trim() === '') {
            applyFilter();
        }
    });
}

// ▼▼▼【変更箇所】タブ関連の関数を修正・整理 ▼▼▼
function setupInventoryTabs() {
    document.querySelectorAll('#inventory-tabs .tab-button[data-category]').forEach(button => {
        button.addEventListener('click', handleTabClick);
    });
    document.getElementById('add-custom-tab-button').addEventListener('click', handleAddCustomTab);
    renderCustomTabs();
}


function handleTabClick(event) {
    document.querySelectorAll('#inventory-tabs .active').forEach(b => b.classList.remove('active'));

    const clickedElement = event.currentTarget;
    clickedElement.classList.add('active');

    const category = clickedElement.dataset.category;
    const tabId = clickedElement.dataset.tabId;

    if (category) {
        activeTabInfo = { type: 'category', value: category };
    } else if (tabId) {
        activeTabInfo = { type: 'custom', value: tabId };
    }

    refreshInventoryView();
}

function refreshInventoryView() {
    let itemsToRender = [...allInventoryItems];

    // 1. タブによるフィルタリング（ソートは後で）
    if (activeTabInfo.type === 'category') {
        const category = activeTabInfo.value;
        if (category !== 'all') {
            itemsToRender = itemsToRender.filter(item => getCategoryFromType(item['タイプ']) === category);
        }
    } else if (activeTabInfo.type === 'custom') {
        const tab = customTabs.find(t => t.id === activeTabInfo.value);
        if (tab) {
            if (tab.filters.length > 0) {
                itemsToRender = itemsToRender.filter(item =>
                    tab.filters.includes(getCategoryFromType(item['タイプ']))
                );
            } else {
                itemsToRender = []; // フィルターが空ならアイテムも空
            }
            if (tab.hideZeroStat) {
                itemsToRender = itemsToRender.filter(item => (parseFloat(item[tab.sortStat]) || 0) > 0);
            }
            // ソートは検索フィルタの後に行う
        }
    }

    // 2. 装備名検索によるフィルタリング
    const searchInput = document.getElementById('inventory-search-input');
    if (searchInput) {
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (searchTerm) {
            itemsToRender = itemsToRender.filter(item =>
                item['名称'].toLowerCase().includes(searchTerm)
            );
        }
    }

    // 3. カスタムタブのソートを適用
    if (activeTabInfo.type === 'custom') {
        const tab = customTabs.find(t => t.id === activeTabInfo.value);
        if (tab) { // tabが存在する場合のみソート
            itemsToRender.sort((a, b) => {
                const valA = parseFloat(a[tab.sortStat]) || 0;
                const valB = parseFloat(b[tab.sortStat]) || 0;
                return valB - valA;
            });
        }
    }

    renderInventory(itemsToRender);
}

function handleAddCustomTab() {
    const name = prompt('新しいタブの名前を入力してください:', '');
    if (name && name.trim()) {
        const newTab = {
            id: `custom_${Date.now()}`,
            name: name.trim(),
            sortStat: '評価数値',
            filters: ['weapon', 'armor', 'accessory'],
            hideZeroStat: false
        };
        customTabs.push(newTab);
        saveCustomTabs();

        // 新しいタブをアクティブにする
        document.querySelectorAll('#inventory-tabs .active').forEach(b => b.classList.remove('active'));
        activeTabInfo = { type: 'custom', value: newTab.id };

        renderCustomTabs(); // UIを再描画（ここで新しいタブに active クラスが付く）
        refreshInventoryView(); // 表示を更新
    }
}

function handleDeleteCustomTab(tabId) {
    const tabToDelete = customTabs.find(t => t.id === tabId);
    if (!tabToDelete) return;

    if (confirm(`タブ「${tabToDelete.name}」を削除しますか？`)) {
        customTabs = customTabs.filter(t => t.id !== tabId);
        saveCustomTabs();

        if (activeTabInfo.type === 'custom' && activeTabInfo.value === tabId) {
            document.querySelector('.tab-button[data-category="all"]').click();
        } else {
            renderCustomTabs();
        }
    }
}

function loadCustomTabs() {
    const savedTabs = localStorage.getItem(CUSTOM_TABS_KEY);
    if (savedTabs) {
        customTabs = JSON.parse(savedTabs);
    } else {
        customTabs = [
            {
                id: `custom_default_weapon`,
                name: '武器',
                sortStat: '評価数値',
                filters: ['weapon'],
                hideZeroStat: false
            },
            {
                id: `custom_default_armor`,
                name: '防具',
                sortStat: '評価数値',
                filters: ['armor'],
                hideZeroStat: false
            },
            {
                id: `custom_default_accessory`,
                name: 'アクセ',
                sortStat: '評価数値',
                filters: ['accessory'],
                hideZeroStat: false
            }
        ];
        saveCustomTabs();
    }
}

function saveCustomTabs() {
    localStorage.setItem(CUSTOM_TABS_KEY, JSON.stringify(customTabs));
}

function renderCustomTabs() {
    document.querySelectorAll('.custom-tab-container').forEach(el => el.remove());

    const addButton = document.getElementById('add-custom-tab-button');

    customTabs.forEach(tab => {
        const container = document.createElement('button');
        container.className = 'custom-tab-container tab-button';
        container.dataset.tabId = tab.id;
        container.addEventListener('click', handleTabClick);

        // ▼▼▼【修正箇所】アクティブ状態を正しく反映する ▼▼▼
        if (activeTabInfo && activeTabInfo.type === 'custom' && activeTabInfo.value === tab.id) {
            container.classList.add('active');
        }
        // ▲▲▲【修正箇所】▲▲▲

        const label = document.createElement('span');
        label.className = 'tab-label';
        label.textContent = tab.name;

        const actions = document.createElement('span');
        actions.className = 'tab-actions';

        const settingsIcon = document.createElement('span');
        settingsIcon.className = 'tab-action-icon';
        settingsIcon.textContent = '⚙️';
        settingsIcon.title = '設定';
        settingsIcon.onclick = (e) => {
            e.stopPropagation();
            openTabSettingsModal(tab.id);
        };

        const deleteIcon = document.createElement('span');
        deleteIcon.className = 'tab-action-icon';
        deleteIcon.textContent = '❌';
        deleteIcon.title = '削除';
        deleteIcon.onclick = (e) => {
            e.stopPropagation();
            handleDeleteCustomTab(tab.id);
        };

        actions.appendChild(settingsIcon);
        actions.appendChild(deleteIcon);

        container.appendChild(label);
        container.appendChild(actions);

        addButton.parentNode.insertBefore(container, addButton);
    });
}

function openTabSettingsModal(tabId) {
    const tab = customTabs.find(t => t.id === tabId);
    if (!tab) return;

    const content = document.createElement('div');
    content.className = 'tab-settings-modal';

    // --- ヘルパー: 設定グループを作成 ---
    const createSettingGroup = (labelText, childElement) => {
        const group = document.createElement('div');
        group.className = 'setting-group';
        const label = document.createElement('label');
        label.textContent = labelText;
        group.appendChild(label);
        group.appendChild(childElement);
        return group;
    };

    // --- 0. 名称変更 ---
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'tab-name-input';
    nameInput.value = tab.name;
    content.appendChild(createSettingGroup('タブ名:', nameInput));

    // --- 1. ソート設定 ---
    const sortSelect = document.createElement('select');
    sortSelect.id = 'sort-stat-select';
    STAT_HEADERS.forEach(stat => {
        const option = new Option(stat, stat);
        if (stat === tab.sortStat) {
            option.selected = true;
        }
        sortSelect.appendChild(option);
    });
    content.appendChild(createSettingGroup('ソート基準 (降順):', sortSelect));

    // --- 2. フィルター設定 ---
    const filterContainer = document.createElement('div');
    const filterOptionsWrapper = document.createElement('div');
    filterOptionsWrapper.className = 'filter-options';
    const filterOptions = { 'weapon': '武器', 'armor': '防具', 'accessory': 'アクセサリー' };

    for (const key in filterOptions) {
        const checkboxId = `filter-checkbox-${key}`;
        const wrapper = document.createElement('div');
        wrapper.className = 'toggle-switch-wrapper';
        const labelText = document.createElement('span');
        labelText.className = 'label-text';
        labelText.textContent = filterOptions[key];
        const toggleSwitch = document.createElement('label');
        toggleSwitch.className = 'toggle-switch';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.value = key;
        if (tab.filters.includes(key)) {
            checkbox.checked = true;
        }
        const slider = document.createElement('span');
        slider.className = 'slider';
        toggleSwitch.appendChild(checkbox);
        toggleSwitch.appendChild(slider);
        wrapper.appendChild(labelText);
        wrapper.appendChild(toggleSwitch);
        filterOptionsWrapper.appendChild(wrapper);
    }
    filterContainer.appendChild(filterOptionsWrapper);
    content.appendChild(createSettingGroup('カテゴリーフィルター:', filterContainer));

    // --- 3. 「基準0は非表示」フィルター ---
    const hideZeroWrapper = document.createElement('div');
    hideZeroWrapper.className = 'other-options';
    const hideZeroToggleWrapper = document.createElement('div');
    hideZeroToggleWrapper.className = 'toggle-switch-wrapper';
    const hideZeroLabelText = document.createElement('span');
    hideZeroLabelText.className = 'label-text';
    hideZeroLabelText.textContent = '基準０のアイテムは表示しない';
    const hideZeroToggleSwitch = document.createElement('label');
    hideZeroToggleSwitch.className = 'toggle-switch';
    const hideZeroCheckbox = document.createElement('input');
    hideZeroCheckbox.type = 'checkbox';
    hideZeroCheckbox.id = 'hide-zero-stat-toggle';
    hideZeroCheckbox.checked = tab.hideZeroStat;
    const hideZeroSlider = document.createElement('span');
    hideZeroSlider.className = 'slider';
    hideZeroToggleSwitch.appendChild(hideZeroCheckbox);
    hideZeroToggleSwitch.appendChild(hideZeroSlider);
    hideZeroToggleWrapper.appendChild(hideZeroLabelText);
    hideZeroToggleWrapper.appendChild(hideZeroToggleSwitch);
    hideZeroWrapper.appendChild(hideZeroToggleWrapper)
    content.appendChild(createSettingGroup('追加フィルター:', hideZeroWrapper));

    // --- モーダルのボタン ---
    const buttons = [
        { text: 'キャンセル', class: 'secondary', onClick: () => closeModal() },
        {
            text: '保存',
            class: 'primary',
            onClick: () => {
                const newName = nameInput.value.trim();
                if (!newName) {
                    alert('タブ名は空にできません。');
                    return;
                }

                // タブオブジェクトの情報を更新
                tab.name = newName;
                tab.sortStat = sortSelect.value;
                tab.hideZeroStat = hideZeroCheckbox.checked;

                const newFilters = [];
                content.querySelectorAll('.filter-options input[type="checkbox"]:checked').forEach(cb => {
                    newFilters.push(cb.value);
                });
                tab.filters = newFilters;

                saveCustomTabs();   // 変更をlocalStorageに保存
                renderCustomTabs(); // タブボタンのUIを再描画
                closeModal();       // モーダルを閉じる

                // ▼▼▼【ここからが新しい修正コードです】▼▼▼

                // 1. 念のため全てのタブのアクティブ状態を解除
                document.querySelectorAll('#inventory-tabs .active').forEach(b => b.classList.remove('active'));

                // 2. 保存したタブに対応する、"新しく作られた"ボタン要素を探す
                const savedTabElement = document.querySelector(`.custom-tab-container[data-tab-id="${tab.id}"]`);

                if (savedTabElement) {
                    // 3. 見つけたボタンをアクティブにする
                    savedTabElement.classList.add('active');

                    // 4. アプリケーションの状態変数を正しく設定
                    activeTabInfo = { type: 'custom', value: tab.id };

                    // 5. 新しいフィルタ設定でインベントリ表示を更新
                    refreshInventoryView();
                } else {
                    // 万が一要素が見つからなかった場合の安全策
                    document.querySelector('button[data-category="all"]').click();
                }
                // ▲▲▲【ここまでが新しい修正コードです】▲▲▲
            }
        }
    ];

    showModal(`タブ「${tab.name}」の設定`, content, buttons);
}


function setupShareButton() {
    const shareButton = document.getElementById('share-button');
    if (!shareButton) return;

    shareButton.addEventListener('click', async () => {
        const equipmentDataToShare = {};
        for (const setId in allEquipmentSets) {
            if (Object.keys(allEquipmentSets[setId]).length === 0) continue;

            equipmentDataToShare[setId] = {};
            for (const slotId in allEquipmentSets[setId]) {
                const equipped = allEquipmentSets[setId][slotId];
                if (equipped && equipped.item && equipped.item['名称']) {
                    equipmentDataToShare[setId][slotId] = {
                        n: equipped.item['名称'],
                        e: equipped.enchantLevel
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
                if (typeof window.setupDatabase === 'function') {
                    window.setupDatabase()
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

async function calculateStatsForSet(items) {
    const totalStats = {};
    const percentStats = new Set();
    const activeSetBonuses = [];
    const activeSetInfo = {};

    if (!items) return { totalStats, percentStats, activeSetBonuses, activeSetInfo };

    // アイテム個別のステータス計算 (変更なし)
    for (const slotId in items) {
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
                if (String(item[statName]).includes('%') || (baseValue > 0 && baseValue < 1 && !Number.isInteger(baseValue))) {
                    percentStats.add(statName);
                }
                totalStats[statName] = (totalStats[statName] || 0) + value;
            }
        }
    }

    // セット効果の計算ロジック
    const setCounts = {};
    for (const slotId in items) {
        const equipped = items[slotId];
        if (equipped && equipped.item && equipped.item['セット名'] && equipped.item['セット名'] !== '-') {
            const setName = equipped.item['セット名'];
            if (!setCounts[setName]) {
                setCounts[setName] = { count: 0, slots: [] };
            }
            setCounts[setName].count++;
            setCounts[setName].slots.push(slotId);
        }
    }

    if (Object.keys(setCounts).length > 0) {
        try {
            console.log('[シミュレータ診断] setBonusesストアのトランザクションを開始します。');
            const transaction = db.transaction(['setBonuses'], 'readonly');
            const store = transaction.objectStore('setBonuses');
            console.log('[シミュレータ診断] トランザクションとストアの取得に成功。');

            for (const setName in setCounts) {
                const count = setCounts[setName].count;
                const request = store.get(setName);
                const setData = await new Promise((resolve, reject) => {
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });

                console.log(`[シミュレータ診断] DBから取得した「${setName}」のルール:`, setData);

                if (setData) {
                    // 発動条件を満たすボーナスの中から、最大のセット数を持つものを探し出す
                    let bestBonus = null;
                    setData.bonuses.forEach(bonus => {
                        if (count >= bonus.count) {
                            if (!bestBonus || bonus.count > bestBonus.count) {
                                bestBonus = bonus;
                            }
                        }
                    });

                    // 最大のセット効果が存在する場合、その効果のみを適用する
                    if (bestBonus) {
                        for (const statName in bestBonus.stats) {
                            const value = bestBonus.stats[statName];
                            totalStats[statName] = (totalStats[statName] || 0) + value;
                            if (value > 0 && value < 1 && !Number.isInteger(value)) {
                                percentStats.add(statName);
                            }
                        }
                        // 表示用の配列にも、この最大の効果だけを追加する
                        activeSetBonuses.push({ setName: setName, count: bestBonus.count, stats: bestBonus.stats });
                        activeSetInfo[setName] = { slots: setCounts[setName].slots };
                    }

                }
            }
        } catch (e) {
            console.error('[シミュレータ診断] セット効果の計算中にエラーが発生しました:', e);
        }
    }

    return { totalStats, percentStats, activeSetBonuses, activeSetInfo };
}

function getEnchantBonus(item, enchantLevel) {
    const bonus = {};
    if (!item || enchantLevel <= 0) {
        return bonus;
    }

    const rankName = item['ランク'].replace(/^[0-9\s]+/, '');
    if (!allEnhancementData || !allEnhancementData[rankName]) {
        return bonus;
    }

    const enhancementTable = allEnhancementData[rankName];
    const itemCategory = getCategoryFromType(item['タイプ']);
    const itemEnhancementType = getEnhancementType(item['タイプ']);

    const categoryNameToTsv = {
        'weapon': '武器',
        'armor': '防具',
        'accessory': 'アクセサリー'
    }[itemCategory];

    enhancementTable.forEach(row => {
        let isApplicable = false;

        if (row.category === categoryNameToTsv) {
            if (row.type === itemEnhancementType) {
                isApplicable = true;
            }
            else if (row.type === '共通') {
                isApplicable = true;
            }
        }

        if (isApplicable) {
            const bonusValue = row.bonuses[enchantLevel - 1];
            if (bonusValue && bonusValue !== 0) {
                bonus[row.stat] = (bonus[row.stat] || 0) + bonusValue;
            }
        }
    });

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

    const currentStatNames = Array.from(statsList.querySelectorAll('.stat-entry')).map(el => el.dataset.statName);

    if (!isSortMode && !sortOrders.default) {
        sortOrders.default = currentStatNames;
    }

    if (isSortMode) {
        const newOrder = Array.from(statsList.querySelectorAll('.stat-entry')).map(el => el.dataset.statName);
        sortOrders[activeSortKey] = newOrder;
        saveSortOrders();
        toggleSortModeUI(false);
    } else {
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
        } else {
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

function getEnhancementType(itemType) {
    if (!itemType) return null;
    const prefix = parseInt(itemType.substring(0, 2), 10);

    if (prefix >= 1 && prefix <= 9) return '武器';

    const typeMapping = {
        11: '頭',
        12: '手',
        13: '上装備',
        14: '下装備',
        15: '足',
        16: 'マント',
        21: 'ベルト',
        22: 'ブレスレット',
        23: 'リング',
        24: 'ネックレス',
        25: '勲章',
        26: '守護具',
        27: 'カンパネラ',
        28: 'アミュレッタ'
    };

    return typeMapping[prefix] || null;
}