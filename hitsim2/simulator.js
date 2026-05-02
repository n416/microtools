// ===============================================
// simulator.js : メイン画面用スクリプト (強化機能追加版)
// ===============================================

// --- グローバル定数・変数 ---
import { DB_NAME, DB_VERSION, STORE_NAME, ENHANCEMENT_STORE_NAME, SET_BONUS_STORE_NAME } from './db-setup.js';
import { runSimulatorTutorial, setupTutorialResetButton } from './tutorial.js';
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
let layoutMode = 1; // 1, 2, or 4
let comparisonSetId = null;

// 並び順変更機能用の変数
let sortOrders = {};
let activeSortKey = 'default';
let isSortMode = false;
let sortableInstance = null;

let selectedInventoryItem = null;
let selectedInstanceId = null;
let selectedSlotId = null;
let selectedSetId = null;

let detailsPanel, detailsItemName, detailsItemImage, detailsStatsList;
let enchantControls, enchantDownButton, enchantUpButton, detailsItemEnchant;

let allInventoryItems = [];
let activeTabInfo = { type: 'category', value: 'all' };

let customTabs = [];
let statRates = [];
const STAT_HEADERS = [
  '評価数値',
  '基本攻撃力',
  '攻撃力増幅',
  'クリティカルダメージ増幅',
  '一般攻撃力',
  'スキルダメージ増幅',
  '近距離攻撃力',
  '防御力',
  '武力',
  'ガード貫通',
  '一般ダメージ増幅',
  '気絶的中',
  '気絶抵抗',
  '絶対回避',
  'クリティカル発生率',
  '状態異常抵抗',
  'MP回復',
  '防御貫通',
  '状態異常的中',
  'PvP攻撃力',
  'PvPクリティカル発生率',
  '治癒量増加',
  '硬直',
  '近距離クリティカル発生率',
  '魔法クリティカル発生率',
  '活力',
  '忍耐',
  '聡明',
  '硬直耐性',
  '武器攻撃力',
  '命中',
  'ガード',
  'クリティカル抵抗',
  'クリティカルダメージ耐性',
  'HP回復',
  '最大HP',
  'ポーション回復量',
  'スキルダメージ耐性',
  '一般ダメージ耐性',
  '水属性追加ダメージ',
  '風属性追加ダメージ',
  '土属性追加ダメージ',
  '火属性追加ダメージ',
  '詠唱速度',
  '武器攻撃力増幅',
];

const TYPE_TO_SLOT_CATEGORY = {
  '大剣': 'weapon',
  '宝珠': 'weapon',
  '鈍器': 'weapon',
  '弓': 'weapon',
  '杖': 'weapon',
  '双剣': 'weapon',
  '鎌': 'weapon',
  '双拳銃': 'weapon',
  '御剣': 'weapon',
  '拳甲': 'weapon',
  '洋弓銃': 'weapon',
  'ヘルム': 'head',
  'グローブ': 'hands',
  '上衣': 'top',
  '下衣': 'bottom',
  'ブーツ': 'feet',
  '靴': 'feet',
  'マント': 'cloak',
  'ベルト': 'belt',
  'ブレスレット': 'bracelet',
  'リング': 'ring',
  'スペシャルリング': 'ring',
  'RING_PAID': 'ring',
  'O': 'ring',
  'ネックレス': 'necklace',
  '勲章': 'medal',
  '守護具': 'guardian',
  'カンパネラ': 'campanella',
  'アミュレッタ': 'amulet',
};
const SLOT_CATEGORY_TO_IDS = {
  weapon: ['slot-weapon'],
  head: ['slot-head'],
  top: ['slot-top'],
  hands: ['slot-hands'],
  feet: ['slot-feet'],
  bottom: ['slot-bottom'],
  cloak: ['slot-cloak'],
  belt: ['slot-belt'],
  necklace: ['slot-necklace'],
  bracelet: ['slot-bracelet'],
  ring: ['slot-ring1', 'slot-ring2', 'slot-ring3', 'slot-ring4', 'slot-ring5'],
  medal: ['slot-medal'],
  guardian: ['slot-guardian'],
  amulet: ['slot-amulet'],
  campanella: ['slot-campanella'],
};
const SLOT_ID_TO_JAPANESE_NAME = {
  'slot-weapon': '武器',
  'slot-head': '頭',
  'slot-top': '上装備',
  'slot-hands': '手',
  'slot-feet': '足',
  'slot-bottom': '下装備',
  'slot-cloak': 'マント',
  'slot-belt': 'ベルト',
  'slot-necklace': 'ネックレス',
  'slot-bracelet': 'ブレスレット',
  'slot-ring1': 'リング',
  'slot-ring2': 'リング',
  'slot-ring3': 'リング',
  'slot-ring4': 'リング',
  'slot-ring5': 'リング',
  'slot-medal': '勲章',
  'slot-guardian': '守護具',
  'slot-amulet': 'アミュレッタ',
  'slot-campanella': 'カンパネラ',
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

      const compressedData = atob(
        encodedData.replace(/-/g, '+').replace(/_/g, '/')
      );
      const uint8Array = new Uint8Array(
        compressedData.split('').map((c) => c.charCodeAt(0))
      );
      const jsonString = pako.inflate(uint8Array, { to: 'string' });
      const sharedSets = JSON.parse(jsonString);

      const allItemNames = new Set();
      for (const setId in sharedSets) {
        for (const slotId in sharedSets[setId]) {
          // sharedSets[setId][slotId].n が undefined の可能性がある
          allItemNames.add(sharedSets[setId][slotId].n); // name
        }
      }

      const validItemNames = Array.from(allItemNames).filter((name) => name);
      const foundItems = await getItemsFromDBByNames(validItemNames);
      const itemsMap = new Map(foundItems.map((item) => [item['名称'], item]));

      const newEquipmentSets = { 1: {}, 2: {}, 3: {}, 4: {} };
      for (const setId in sharedSets) {
        newEquipmentSets[setId] = {};
        for (const slotId in sharedSets[setId]) {
          const itemName = sharedSets[setId][slotId].n;
          const enchantLevel = sharedSets[setId][slotId].e || 0;

          if (itemsMap.has(itemName)) {
            newEquipmentSets[setId][slotId] = {
              item: itemsMap.get(itemName),
              enchantLevel: enchantLevel,
            };
          }
        }
      }

      localStorage.setItem(
        EQUIPMENT_SETS_KEY,
        JSON.stringify(newEquipmentSets)
      );

      const currentInventory =
        JSON.parse(localStorage.getItem(INVENTORY_KEY)) || [];
      const newInventorySet = new Set([...currentInventory, ...validItemNames]);
      localStorage.setItem(
        INVENTORY_KEY,
        JSON.stringify(Array.from(newInventorySet))
      );
      console.log('復元された装備アイテムをインベントリに自動追加しました。');
    } catch (e) {
      console.error('共有データの処理中にエラーが発生しました:', e);
      alert(
        'データの読み込みに失敗しました。URLが破損しているか、非対応のデータ形式の可能性があります。'
      );
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
    try {
      const response = await fetch('./stat_rates.json');
      if (response.ok) {
        statRates = await response.json();
      }
    } catch (e) {
      console.error('stat_rates.jsonの読み込みに失敗しました', e);
    }

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
      const request = store.openCursor();

      await new Promise((resolve) => {
        request.onsuccess = (event) => {
          const enhCursor = event.target.result;
          if (enhCursor) {
            const item = enhCursor.value;
            allEnhancementData[item.groupId] = item.data;
            enhCursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = (event) => {
          console.error(
            '強化データの読み込みに失敗しました:',
            event.target.error
          );
          resolve();
        };
      });
    } catch (e) {
      console.error(
        '強化データキャッシュ中にエラーが発生しました（処理は続行）:',
        e
      );
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
    
    // レイアウトの初期化
    updateLayoutMode(1);
    
    setupEnchantControls();
    setupDetailsActionButtons();
    setupAIPromptButton();
    setupSettingsButton();
    calculateAndRenderStats();

    // チュートリアルの初期化とリセットボタン設定
    setupTutorialResetButton('reset-tutorial-btn');
    runSimulatorTutorial();
  } catch (error) {
    console.error('初期化中にエラーが発生しました:', error);
  }
}

function setupDetailsActionButtons() {
  document
    .getElementById('details-action-set')
    .addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectedInventoryItem && selectedInstanceId) {
        equipInstance(selectedInventoryItem, selectedInstanceId);
        clearAllSelections();
      }
    });

  document
    .getElementById('details-action-duplicate')
    .addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectedInventoryItem && selectedInstanceId) {
        const itemName = selectedInventoryItem['名称'];
        const instances = inventoryEnhancements[itemName];
        const sourceInstance = instances?.find(
          (inst) => inst.instanceId === selectedInstanceId
        );

        if (sourceInstance) {
          const newInstance = {
            instanceId: Date.now() + Math.random(),
            Lv: sourceInstance.Lv,
          };
          instances.push(newInstance);
          saveInventoryEnhancements();
          refreshInventoryView();
        }
        clearAllSelections();
      }
    });

  document
    .getElementById('details-action-delete')
    .addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectedInventoryItem && selectedInstanceId) {
        deleteInstance(selectedInventoryItem, selectedInstanceId);
      } else if (selectedSlotId && selectedSetId) {
        unequipItem(selectedSlotId, selectedSetId);
        clearAllSelections();
      }
    });
}

function deleteInstance(item, instanceId) {
  const itemName = item['名称'];
  const instances = inventoryEnhancements[itemName];
  if (!instances) return;

  const instanceIndex = instances.findIndex(
    (inst) => inst.instanceId === instanceId
  );
  if (instanceIndex === -1) return;

  const instanceLv = instances[instanceIndex].Lv;

  const contentElement = document.createElement('p');
  contentElement.textContent = `${itemName} (+${instanceLv}) を削除します。よろしいですか？`;

  showModal('削除の確認', contentElement, [
    {
      text: '削除する',
      class: 'modal-ok-button button-like',
      onClick: () => {
        closeModal();
        instances.splice(instanceIndex, 1);

        if (instances.length === 0) {
          delete inventoryEnhancements[itemName];

          let masterInventory = JSON.parse(localStorage.getItem(INVENTORY_KEY)) || [];
          masterInventory = masterInventory.filter((name) => name !== itemName);
          localStorage.setItem(INVENTORY_KEY, JSON.stringify(masterInventory));

          allInventoryItems = allInventoryItems.filter((i) => i['名称'] !== itemName);
        }

        saveInventoryEnhancements();
        refreshInventoryView();
        clearAllSelections();
      }
    },
    {
      text: 'キャンセル',
      class: 'modal-cancel-button button-like',
      onClick: () => {
        closeModal();
      }
    }
  ]);
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

  if (selectedSlotId && selectedSetId && allEquipmentSets[selectedSetId] && allEquipmentSets[selectedSetId][selectedSlotId]) {
    const equipped = allEquipmentSets[selectedSetId][selectedSlotId];
    currentLevel = equipped.enchantLevel;
    newLevel = currentLevel + change;

    if (newLevel < 0) newLevel = 0;
    if (newLevel > 12) newLevel = 12;

    if (newLevel !== currentLevel) {
      equipped.enchantLevel = newLevel;
      renderSlot(selectedSlotId, selectedSetId);
      if (selectedSetId === activeSetId || selectedSetId === comparisonSetId) {
        calculateAndRenderStats();
      }
      displayItemDetails(
        equipped.item,
        document.getElementById(`dom-${selectedSetId}-${selectedSlotId}`)
      );
      saveAllEquipmentSets();
    }
  } else if (selectedInventoryItem && selectedInstanceId) {
    const itemName = selectedInventoryItem['名称'];
    const instance = inventoryEnhancements[itemName]?.find(
      (inst) => inst.instanceId === selectedInstanceId
    );
    if (!instance) return;

    currentLevel = instance.Lv;
    newLevel = currentLevel + change;

    if (newLevel < 0) newLevel = 0;
    if (newLevel > 12) newLevel = 12;

    if (newLevel !== currentLevel) {
      instance.Lv = newLevel;
      saveInventoryEnhancements();
      refreshInventoryView();

      const targetElement = document.getElementById(
        `inv-instance-${selectedInstanceId}`
      );
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

    request.onerror = (event) =>
      reject(`DBオープンエラー: ${event.target.error}`);
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
  });
}

async function loadAndRenderInventory() {
  const inventoryItemNames =
    JSON.parse(localStorage.getItem(INVENTORY_KEY)) || [];
  if (inventoryItemNames.length === 0) {
    document.getElementById('inventory-list').innerHTML =
      '<p style="padding: 10px;">インベントリにアイテムがありません。<br><a href="data.html">インベントリ編集ページ</a>でアイテムを追加してください。</p>';
    allInventoryItems = [];
    return;
  }

  const inventoryItems = await getItemsFromDBByNames(inventoryItemNames);
  allInventoryItems = inventoryItems.filter((item) => item);

  let enhancementsModified = false;
  allInventoryItems.forEach((item) => {
    const itemName = item['名称'];
    if (
      !inventoryEnhancements[itemName] ||
      inventoryEnhancements[itemName].length === 0
    ) {
      inventoryEnhancements[itemName] = [
        { instanceId: Date.now() + Math.random(), Lv: 0 },
      ];
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
    if (!db) {
      resolve(null);
      return;
    }
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
        reject('Database connection failed');
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

    uniqueNames.forEach((name) => {
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

  itemsToDisplay.forEach((item) => {
    const itemName = item['名称'];
    const instances = inventoryEnhancements[itemName] || [];

    const itemInstancesToRender = instances.filter((instance) =>
      itemsToDisplay.some((displayItem) => displayItem['名称'] === itemName)
    );

    if (itemInstancesToRender.length > 0) {
      itemInstancesToRender.forEach((instance) => {
        const itemDiv = createInventoryItemElement(item, instance);
        inventoryListDiv.appendChild(itemDiv);
      });
    }
  });
}

function getGradeClass(gradeStr) {
  if (!gradeStr) return '';
  if (gradeStr.includes('一般')) return 'grade-common';
  if (gradeStr.includes('高級')) return 'grade-uncommon';
  if (gradeStr.includes('希少')) return 'grade-rare';
  if (gradeStr.includes('英雄')) return 'grade-heroic';
  if (gradeStr.includes('古代')) return 'grade-ancient';
  if (gradeStr.includes('伝説')) return 'grade-legendary';
  if (gradeStr.includes('SPECIAL')) return 'grade-special';
  return '';
}

function createInventoryItemElement(item, instance) {
  const enchantLevel = instance.Lv;
  const enchantText = enchantLevel > 0 ? `+${enchantLevel}` : '';

  const itemDiv = document.createElement('div');
  itemDiv.className = 'inventory-item';
  itemDiv.dataset.category = TYPE_TO_SLOT_CATEGORY[item['タイプ']] || 'unknown';
  const gradeClass = getGradeClass(item['ランク']);
  if (gradeClass) {
    itemDiv.classList.add(gradeClass);
  }
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
  if (selectedSlotId) {
    const itemCategory = TYPE_TO_SLOT_CATEGORY[item['タイプ']];
    let targetSlotCategory = null;
    for (const [category, ids] of Object.entries(SLOT_CATEGORY_TO_IDS)) {
      if (ids.includes(selectedSlotId)) {
        targetSlotCategory = category;
        break;
      }
    }
    
    // If the item matches the category of the currently selected slot, equip it directly to that slot
    if (itemCategory === targetSlotCategory) {
      equipInstance(item, instance.instanceId, selectedSlotId);
      clearAllSelections();
    } else {
      // Clicked a dimmed/invalid item: cancel the selection mode
      clearAllSelections();
    }
    // Return early to prevent the detail panel from opening during slot selection mode
    return;
  }

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

function updateInventoryDimming() {
  const inventoryItemsDom = document.querySelectorAll('.inventory-item');
  if (!selectedSlotId) {
    inventoryItemsDom.forEach(el => el.classList.remove('dimmed-item'));
    return;
  }
  
  let targetCategory = null;
  for (const [category, ids] of Object.entries(SLOT_CATEGORY_TO_IDS)) {
    if (ids.includes(selectedSlotId)) {
      targetCategory = category;
      break;
    }
  }
  
  inventoryItemsDom.forEach(el => {
    if (el.dataset.category !== targetCategory) {
      el.classList.add('dimmed-item');
    } else {
      el.classList.remove('dimmed-item');
    }
  });
}

function handleSlotClick(slotId, setId, element) {
  if (String(setId) !== activeSetId) {
    switchEquipmentSet(setId);
    element = document.getElementById(`dom-${setId}-${slotId}`);
    if (!element) return;
  }

  const equipped = allEquipmentSets[setId][slotId];
  if (equipped) {
    if (selectedSlotId === slotId && selectedSetId === String(setId)) {
      unequipItem(slotId, setId);
      clearAllSelections();
    } else {
      clearAllSelections();
      selectedSlotId = slotId;
      selectedSetId = String(setId);
      element.classList.add('selected');
      displayItemDetails(equipped.item, element);
      updateInventoryDimming();
    }
  } else {
    if (selectedSlotId === slotId && selectedSetId === String(setId)) {
      clearAllSelections();
    } else {
      clearAllSelections();
      selectedSlotId = slotId;
      selectedSetId = String(setId);
      element.classList.add('selected');
      hideItemDetails();
      updateInventoryDimming();
    }
  }
}

function equipInstance(item, instanceId, specificSlotId = null) {
  const itemType = item['タイプ'];
  const slotCategory = TYPE_TO_SLOT_CATEGORY[itemType];
  if (!slotCategory) return;

  const sourceInstance = inventoryEnhancements[item['名称']]?.find(
    (inst) => inst.instanceId === instanceId
  ) || { Lv: 0 };

  const itemToEquip = {
    item: item,
    enchantLevel: sourceInstance.Lv,
    instanceId: Date.now() + Math.random(),
  };

  const possibleSlotIds = SLOT_CATEGORY_TO_IDS[slotCategory];

  if (specificSlotId && possibleSlotIds.includes(specificSlotId)) {
    if (equippedItems[specificSlotId]) {
      unequipItem(specificSlotId, activeSetId, false);
    }
    equippedItems[specificSlotId] = itemToEquip;
    renderSlot(specificSlotId, activeSetId);
  } else {
    const emptySlotId = possibleSlotIds.find((id) => !equippedItems[id]);

    if (emptySlotId) {
      equippedItems[emptySlotId] = itemToEquip;
      renderSlot(emptySlotId, activeSetId);
    } else {
      if (slotCategory === 'ring') {
        const lastRingSlotId = possibleSlotIds[possibleSlotIds.length - 1];
        if (equippedItems[lastRingSlotId]) {
          unequipItem(lastRingSlotId, activeSetId, false);
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
        possibleSlotIds.forEach((id) => renderSlot(id, activeSetId));
      } else {
        const targetSlotId = possibleSlotIds[0];
        unequipItem(targetSlotId, activeSetId, false);
        equippedItems[targetSlotId] = itemToEquip;
        renderSlot(targetSlotId, activeSetId);
      }
    }
  }

  saveAllEquipmentSets();
  calculateAndRenderStats();
}

function unequipItem(slotId, setId = activeSetId, doSaveAndRecalculate = true) {
  const setEquipped = allEquipmentSets[setId];
  if (setEquipped && setEquipped[slotId]) {
    const unequipped = setEquipped[slotId];
    const itemName = unequipped.item['名称'];
    const enchantLevel = unequipped.enchantLevel;

    if (!inventoryEnhancements[itemName]) {
      inventoryEnhancements[itemName] = [];
    }
    const instances = inventoryEnhancements[itemName];

    const alreadyExists = instances.some((inst) => inst.Lv === enchantLevel);

    if (!alreadyExists) {
      instances.push({
        instanceId: unequipped.instanceId,
        Lv: enchantLevel,
      });
    }

    delete setEquipped[slotId];

    if (doSaveAndRecalculate) {
      saveInventoryEnhancements();
      saveAllEquipmentSets();
      refreshInventoryView();
      renderSlot(slotId, setId);
      if (setId === activeSetId || setId === comparisonSetId) {
        calculateAndRenderStats();
      }
    } else {
      renderSlot(slotId, setId);
    }
  }
}

function renderSlot(slotId, setId = activeSetId) {
  const domId = `dom-${setId}-${slotId}`;
  const slotElement = document.getElementById(domId);
  if (!slotElement) return;
  slotElement.classList.remove('selected');
  const newSlotElement = slotElement.cloneNode(true);
  slotElement.parentNode.replaceChild(newSlotElement, slotElement);
  newSlotElement.addEventListener('click', (e) => {
    e.stopPropagation();
    handleSlotClick(slotId, setId, e.currentTarget);
  });
  newSlotElement.innerHTML = '';

  const setEquipped = allEquipmentSets[setId] || {};
  const equipped = setEquipped[slotId];
  if (equipped) {
    const item = equipped.item;
    const enchantLevel = equipped.enchantLevel;
    const enchantText = enchantLevel > 0 ? `+${enchantLevel}` : '';

    const gradeClass = getGradeClass(item['ランク']);
    if (gradeClass) {
      newSlotElement.classList.add(gradeClass);
    }

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
    newSlotElement.className = 'slot';
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
  localStorage.setItem(
    INVENTORY_ENHANCEMENTS_KEY,
    JSON.stringify(inventoryEnhancements)
  );
}

function loadInventoryEnhancements() {
  let enhancements =
    JSON.parse(localStorage.getItem(INVENTORY_ENHANCEMENTS_KEY)) || {};
  let needsSave = false;

  for (const itemName in enhancements) {
    if (Object.prototype.hasOwnProperty.call(enhancements, itemName)) {
      const instances = enhancements[itemName];
      if (Array.isArray(instances)) {
        instances.forEach((instance) => {
          if (
            typeof instance === 'object' &&
            instance !== null &&
            !Object.prototype.hasOwnProperty.call(instance, 'instanceId')
          ) {
            console.warn(
              `「${itemName}」のインスタンスにIDがありません。新しいIDを付与します。`,
              instance
            );
            instance.instanceId = Date.now() + Math.random();
            needsSave = true;
          }
        });
      }
    }
  }

  if (needsSave) {
    console.log('破損したインスタンスデータを修正し、保存しました。');
    localStorage.setItem(
      INVENTORY_ENHANCEMENTS_KEY,
      JSON.stringify(enhancements)
    );
  }

  inventoryEnhancements = enhancements;
}

async function loadAllEquipmentSets() {
  activeSetId = localStorage.getItem(ACTIVE_SET_ID_KEY) || '1';
  const savedSets = JSON.parse(localStorage.getItem(EQUIPMENT_SETS_KEY)) || {
    1: {},
    2: {},
    3: {},
    4: {},
  };

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
    const freshItems = await getItemsFromDBByNames(
      Array.from(allEquippedItemNames)
    );
    const freshItemsMap = new Map(
      freshItems.map((item) => [item['名称'], item])
    );

    for (const setId in savedSets) {
      for (const slotId in savedSets[setId]) {
        const equipped = savedSets[setId][slotId];
        if (
          equipped &&
          equipped.item &&
          freshItemsMap.has(equipped.item['名称'])
        ) {
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
  document.querySelectorAll('.slot').forEach((slotElement) => {
    const id = slotElement.id;
    if (id === 'slot-placeholder') return;
    
    // id format: dom-{setId}-{slotId}
    const match = id.match(/^dom-(\d+)-(.+)$/);
    if (match) {
      const setId = match[1];
      const slotId = match[2];
      renderSlot(slotId, setId);
    }
  });
}

function clearAllSelections() {
  if (selectedInventoryItem) {
    const selectedElem = document.getElementById(
      `inv-instance-${selectedInstanceId}`
    );
    if (selectedElem) selectedElem.classList.remove('selected');
    selectedInventoryItem = null;
    selectedInstanceId = null;
  }
  if (selectedSlotId && selectedSetId) {
    const domId = `dom-${selectedSetId}-${selectedSlotId}`;
    const selectedElem = document.getElementById(domId);
    if (selectedElem) selectedElem.classList.remove('selected');
    selectedSlotId = null;
    selectedSetId = null;
  }
  hideItemDetails();
  if (typeof updateInventoryDimming === 'function') {
    updateInventoryDimming();
  }
}

function setupGlobalClickListener() {
  document.body.addEventListener('click', (event) => {
    if (
      event.target.closest('.slot') ||
      event.target.closest('.inventory-item') ||
      event.target.closest('#item-details-panel')
    ) {
      return;
    }
    clearAllSelections();
  });
}

async function calculateAndRenderStats() {
  const { totalStats, percentStats, activeSetBonuses, activeSetInfo } =
    await calculateStatsForSet(equippedItems);
  const { totalStats: comparisonTotalStats } = await calculateStatsForSet(
    allEquipmentSets[comparisonSetId] || {}
  );
  const statsPanel = document.getElementById('stats-panel');
  statsPanel.innerHTML = '';

  document.querySelectorAll('.slot').forEach((slot) => {
    for (let i = 1; i <= 4; i++) {
      slot.classList.remove(`set-highlight-${i}`);
    }
  });

  if (activeSetInfo) {
    let highlightCounter = 1;
    for (const setName in activeSetInfo) {
      const info = activeSetInfo[setName];
      if (info.slots && highlightCounter <= 4) {
        info.slots.forEach((slotId) => {
          const slotElement = document.getElementById(`dom-${activeSetId}-${slotId}`);
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
    .filter((stat) => totalStats[stat] !== 0)
    .sort((a, b) => {
      const indexA = currentSortOrder.indexOf(a);
      const indexB = currentSortOrder.indexOf(b);
      if (indexA === -1 && indexB === -1)
        return STAT_HEADERS.indexOf(a) - STAT_HEADERS.indexOf(b);
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
        displayValueText =
          (Number.isInteger(percentValue)
            ? percentValue
            : percentValue.toFixed(2)) + '%';
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
            diffDisplayValue =
              (Number.isInteger(percentDiff)
                ? percentDiff
                : percentDiff.toFixed(2)) + '%';
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
    activeSetBonuses.forEach((b) => {
      const key = `${b.setName}-${b.count}`;
      uniqueBonuses[key] = b;
    });

    Object.values(uniqueBonuses).forEach((bonus) => {
      const effectDiv = document.createElement('div');
      effectDiv.style.fontSize = '14px';
      effectDiv.style.padding = '2px 0';
      const setNameSpan = document.createElement('strong');
      setNameSpan.textContent = `[${bonus.setName}] (${bonus.count}セット): `;
      const statsText = Object.entries(bonus.stats)
        .map(
          ([name, value]) =>
            `${name} +${statRates.includes(name)
              ? (value * 100).toFixed(1).replace(/\.0$/, '') + '%'
              : value
            }`
        )
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

  if (selectedSlotId && selectedSetId && allEquipmentSets[selectedSetId] && allEquipmentSets[selectedSetId][selectedSlotId]) {
    enchantLevel = allEquipmentSets[selectedSetId][selectedSlotId].enchantLevel;
  } else if (selectedInventoryItem && selectedInstanceId) {
    const instances = inventoryEnhancements[selectedInventoryItem['名称']];
    const instance = instances?.find(
      (inst) => inst.instanceId === selectedInstanceId
    );
    if (instance) {
      enchantLevel = instance.Lv;
    }
  }

  detailsItemName.textContent = item['名称'];
  detailsItemImage.src = item['画像URL'] || '';
  detailsItemImage.alt = item['名称'];
  detailsStatsList.innerHTML = '';

  const detailsActions = document.getElementById('details-actions');
  const setBtn = document.getElementById('details-action-set');
  const dupBtn = document.getElementById('details-action-duplicate');
  const delBtn = document.getElementById('details-action-delete');

  if (selectedInstanceId) {
    detailsActions.classList.remove('hidden');
    setBtn.style.display = '';
    dupBtn.style.display = '';
    delBtn.textContent = '削除する';
  } else if (selectedSlotId) {
    detailsActions.classList.remove('hidden');
    setBtn.style.display = 'none';
    dupBtn.style.display = 'none';
    delBtn.textContent = '外す';
  } else {
    detailsActions.classList.add('hidden');
  }

  if (selectedSlotId || selectedInstanceId) {
    enchantControls.classList.remove('hidden');
    detailsItemEnchant.textContent =
      enchantLevel > 0 ? `+${enchantLevel}` : '無強化';
    enchantDownButton.disabled = enchantLevel <= 0;
    enchantUpButton.disabled = enchantLevel >= 12;
  } else {
    enchantControls.classList.add('hidden');
  }

  const baseStats = {};
  STAT_HEADERS.forEach((statName) => {
    const value = parseFloat(item[statName]);
    if (value && !isNaN(value) && value !== 0) {
      baseStats[statName] = value;
    }
  });

  const enchantBonus = getEnchantBonus(item, enchantLevel);
  const allStatKeys = new Set([
    ...Object.keys(baseStats),
    ...Object.keys(enchantBonus),
  ]);

  if (allStatKeys.size === 0) {
    detailsStatsList.textContent = '表示するステータスがありません。';
  } else {
    allStatKeys.forEach((statName) => {
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
        valueText =
          (Number.isInteger(percentValue)
            ? percentValue
            : percentValue.toFixed(1)) + '%';
      } else {
        valueText = Number.isInteger(totalValue)
          ? totalValue
          : totalValue.toFixed(2);
      }

      if (bonusValue > 0) {
        let bonusText = Number.isInteger(bonusValue)
          ? bonusValue
          : bonusValue.toFixed(2);
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

  const slotCat = TYPE_TO_SLOT_CATEGORY[typeString];
  if (!slotCat) return 'unknown';

  if (slotCat === 'weapon') return 'weapon';

  const armorCats = ['head', 'top', 'bottom', 'hands', 'feet', 'cloak'];
  if (armorCats.includes(slotCat)) return 'armor';

  const accessoryCats = ['belt', 'necklace', 'bracelet', 'ring', 'medal', 'guardian', 'amulet', 'campanella'];
  if (accessoryCats.includes(slotCat)) return 'accessory';

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
  document
    .querySelectorAll('#inventory-tabs .tab-button[data-category]')
    .forEach((button) => {
      button.addEventListener('click', handleTabClick);
    });
  document
    .getElementById('add-custom-tab-button')
    .addEventListener('click', handleAddCustomTab);
  renderCustomTabs();
}

function handleTabClick(event) {
  document
    .querySelectorAll('#inventory-tabs .active')
    .forEach((b) => b.classList.remove('active'));

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
      itemsToRender = itemsToRender.filter(
        (item) => getCategoryFromType(item['タイプ']) === category
      );
    }
  } else if (activeTabInfo.type === 'custom') {
    const tab = customTabs.find((t) => t.id === activeTabInfo.value);
    if (tab) {
      if (tab.filters.length > 0) {
        itemsToRender = itemsToRender.filter((item) =>
          tab.filters.includes(getCategoryFromType(item['タイプ']))
        );
      } else {
        itemsToRender = []; // フィルターが空ならアイテムも空
      }
      if (tab.hideZeroStat) {
        itemsToRender = itemsToRender.filter(
          (item) => (parseFloat(item[tab.sortStat]) || 0) > 0
        );
      }
      // ソートは検索フィルタの後に行う
    }
  }

  // 1.5 設定によるフィルタリング
  const alwaysShowSpecial = localStorage.getItem('setting-always-show-special') === 'true';
  const isSpecialItem = (item) => {
    if (!alwaysShowSpecial) return false;
    const cat = TYPE_TO_SLOT_CATEGORY[item['タイプ']];
    return cat === 'campanella' || cat === 'amulet';
  };

  const isAncientOnly = localStorage.getItem('setting-ancient-only') === 'true';
  if (isAncientOnly) {
    const targetRanks = ['古代', '伝説', 'SPECIAL'];
    itemsToRender = itemsToRender.filter(item => targetRanks.includes(item['ランク']) || isSpecialItem(item));
  }

  const isHideLegendary = localStorage.getItem('setting-hide-legendary') === 'true';
  if (isHideLegendary) {
    itemsToRender = itemsToRender.filter(item => item['ランク'] !== '伝説' || isSpecialItem(item));
  }

  const selectedClasses = JSON.parse(localStorage.getItem('setting-classes')) || [];
  if (selectedClasses.length > 0) {
    itemsToRender = itemsToRender.filter(item => {
      const type = item['タイプ'];
      const isWeapon = TYPE_TO_SLOT_CATEGORY && TYPE_TO_SLOT_CATEGORY[type] === 'weapon';
      return !isWeapon || selectedClasses.includes(type);
    });
  }

  // 2. 装備名検索によるフィルタリング
  const searchInput = document.getElementById('inventory-search-input');
  if (searchInput) {
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (searchTerm) {
      itemsToRender = itemsToRender.filter((item) =>
        item['名称'].toLowerCase().includes(searchTerm)
      );
    }
  }

  // 3. カスタムタブのソートを適用
  if (activeTabInfo.type === 'custom') {
    const tab = customTabs.find((t) => t.id === activeTabInfo.value);
    if (tab) {
      // tabが存在する場合のみソート
      itemsToRender.sort((a, b) => {
        const valA = parseFloat(a[tab.sortStat]) || 0;
        const valB = parseFloat(b[tab.sortStat]) || 0;
        return valB - valA;
      });
    }
  }

  renderInventory(itemsToRender);
  
  // フィルタリングや再描画後にディミング状態を復元する
  if (typeof updateInventoryDimming === 'function') {
    updateInventoryDimming();
  }
}

// ▼▼▼【ここから変更】▼▼▼
function handleAddCustomTab() {
  const content = document.createElement('div');
  const p = document.createElement('p');
  p.textContent = '新しい「自動モード」のタブを追加しますか？';
  p.style.lineHeight = '1.5';

  const small = document.createElement('small');
  small.textContent =
    'タブ名は「評価数値」として自動設定されます。後から設定で自由に変更できます。';
  small.style.display = 'block';
  small.style.marginTop = '8px';
  small.style.color = '#ccc';

  content.appendChild(p);
  content.appendChild(small);

  const buttons = [
    {
      text: 'キャンセル',
      class: 'secondary',
      onClick: () => closeModal(),
    },
    {
      text: '追加',
      class: 'primary',
      onClick: () => {
        const defaultSortStat = '評価数値';
        const newTab = {
          id: `custom_${Date.now()}`,
          name: defaultSortStat,
          sortStat: defaultSortStat,
          filters: ['weapon', 'armor', 'accessory'],
          hideZeroStat: false,
          isNameAutomatic: true,
        };
        customTabs.push(newTab);
        saveCustomTabs();

        // 新しいタブをアクティブにしてUIを更新
        document
          .querySelectorAll('#inventory-tabs .active')
          .forEach((b) => b.classList.remove('active'));
        activeTabInfo = { type: 'custom', value: newTab.id };
        renderCustomTabs();
        refreshInventoryView();

        closeModal();
      },
    },
  ];

  showModal('新しいタブの追加', content, buttons);
}
// ▲▲▲【ここまで変更】▲▲▲

function handleDeleteCustomTab(tabId) {
  const tabToDelete = customTabs.find((t) => t.id === tabId);
  if (!tabToDelete) return;

  if (confirm(`タブ「${tabToDelete.name}」を削除しますか？`)) {
    const wasActive =
      activeTabInfo.type === 'custom' && activeTabInfo.value === tabId;

    // データとlocalStorageから削除
    customTabs = customTabs.filter((t) => t.id !== tabId);
    saveCustomTabs();

    // 先にカスタムタブのUIを再描画して、削除したタブを画面から消す
    renderCustomTabs();

    // もし削除したタブがアクティブだった場合は、「全て」タブに切り替える
    if (wasActive) {
      // .click()を呼ぶことで、アクティブ状態の管理とインベントリ更新を
      // handleTabClick関数に一任できる
      const allButton = document.querySelector(
        '.tab-button[data-category="all"]'
      );
      if (allButton) {
        allButton.click();
      }
    }
    // 削除したタブがアクティブでなかった場合は、再描画だけでOK。
    // activeTabInfoは変わらないので、他のタブのアクティブ状態は維持される。
  }
}

function loadCustomTabs() {
  const savedTabs = localStorage.getItem(CUSTOM_TABS_KEY);
  if (savedTabs) {
    const loadedTabs = JSON.parse(savedTabs);
    // 後方互換性のため、isNameAutomaticがないタブにはfalseをセット
    customTabs = loadedTabs.map((tab) => ({
      ...tab,
      isNameAutomatic:
        tab.isNameAutomatic === undefined ? false : tab.isNameAutomatic,
    }));
  } else {
    // デフォルトタブの定義にも isNameAutomatic を追加
    customTabs = [
      {
        id: `custom_default_weapon`,
        name: '武器',
        sortStat: '評価数値',
        filters: ['weapon'],
        hideZeroStat: false,
        isNameAutomatic: false, // 手動設定
      },
      {
        id: `custom_default_armor`,
        name: '防具',
        sortStat: '評価数値',
        filters: ['armor'],
        hideZeroStat: false,
        isNameAutomatic: false, // 手動設定
      },
      {
        id: `custom_default_accessory`,
        name: 'アクセ',
        sortStat: '評価数値',
        filters: ['accessory'],
        hideZeroStat: false,
        isNameAutomatic: false, // 手動設定
      },
    ];
    saveCustomTabs();
  }
}

function saveCustomTabs() {
  localStorage.setItem(CUSTOM_TABS_KEY, JSON.stringify(customTabs));
}

function renderCustomTabs() {
  document
    .querySelectorAll('.custom-tab-container')
    .forEach((el) => el.remove());

  const addButton = document.getElementById('add-custom-tab-button');

  customTabs.forEach((tab) => {
    const container = document.createElement('button');
    container.className = 'custom-tab-container tab-button';
    container.dataset.tabId = tab.id;
    container.addEventListener('click', handleTabClick);

    if (
      activeTabInfo &&
      activeTabInfo.type === 'custom' &&
      activeTabInfo.value === tab.id
    ) {
      container.classList.add('active');
    }

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
  const tab = customTabs.find((t) => t.id === tabId);
  if (!tab) return;

  // --- ヘルパー関数: 自動タブ名生成ロジック ---
  const generateAutomaticName = (sortStat, filters) => {
    let suffix = '';
    const allFilterKeys = ['weapon', 'armor', 'accessory'];
    const onFilterKeys = allFilterKeys.filter((f) => filters.includes(f));

    if (onFilterKeys.length === 3 || onFilterKeys.length === 0) {
      suffix = '';
    } else if (onFilterKeys.length === 1) {
      const filterMap = {
        weapon: '武器',
        armor: '防具',
        accessory: 'アクセ',
      };
      suffix = filterMap[onFilterKeys[0]];
    } else if (onFilterKeys.length === 2) {
      const offFilterKey = allFilterKeys.find((f) => !filters.includes(f));
      const filterMap = {
        weapon: '武器',
        armor: '防具',
        accessory: 'アクセ',
      };
      suffix = `${filterMap[offFilterKey]}以外`;
    }
    return `${sortStat}${suffix}`;
  };

  const content = document.createElement('div');
  content.className = 'tab-settings-modal';

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
  nameInput.value = tab.name;
  content.appendChild(createSettingGroup('タブ名:', nameInput));

  // --- 0.5 「自動」チェックボックス ---
  const autoNameWrapper = document.createElement('div');
  autoNameWrapper.className = 'toggle-switch-wrapper';
  autoNameWrapper.style.paddingLeft = '5px'; // 見た目の調整
  const autoNameLabelText = document.createElement('span');
  autoNameLabelText.className = 'label-text';
  autoNameLabelText.textContent = 'タブ名を自動で設定する';
  const autoNameToggleSwitch = document.createElement('label');
  autoNameToggleSwitch.className = 'toggle-switch';
  const autoNameCheckbox = document.createElement('input');
  autoNameCheckbox.type = 'checkbox';
  autoNameCheckbox.checked = tab.isNameAutomatic;
  const autoNameSlider = document.createElement('span');
  autoNameSlider.className = 'slider';
  autoNameToggleSwitch.appendChild(autoNameCheckbox);
  autoNameToggleSwitch.appendChild(autoNameSlider);
  autoNameWrapper.appendChild(autoNameLabelText);
  autoNameWrapper.appendChild(autoNameToggleSwitch);
  nameInput.parentElement.appendChild(autoNameWrapper); // タブ名グループに追加

  // --- 1. ソート設定 ---
  const sortSelect = document.createElement('select');
  STAT_HEADERS.forEach((stat) => {
    const option = new Option(stat, stat);
    if (stat === tab.sortStat) option.selected = true;
    sortSelect.appendChild(option);
  });
  content.appendChild(createSettingGroup('ソート基準 (降順):', sortSelect));

  // --- 2. フィルター設定 ---
  const filterContainer = document.createElement('div');
  const filterOptionsWrapper = document.createElement('div');
  filterOptionsWrapper.className = 'filter-options';
  const filterOptions = {
    weapon: '武器',
    armor: '防具',
    accessory: 'アクセサリー',
  };
  const filterCheckboxes = [];

  for (const key in filterOptions) {
    const wrapper = document.createElement('div');
    wrapper.className = 'toggle-switch-wrapper';
    const labelText = document.createElement('span');
    labelText.textContent = filterOptions[key];
    const toggleSwitch = document.createElement('label');
    toggleSwitch.className = 'toggle-switch';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = key;
    if (tab.filters.includes(key)) checkbox.checked = true;
    const slider = document.createElement('span');
    slider.className = 'slider';
    toggleSwitch.appendChild(checkbox);
    toggleSwitch.appendChild(slider);
    wrapper.appendChild(labelText);
    wrapper.appendChild(toggleSwitch);
    filterOptionsWrapper.appendChild(wrapper);
    filterCheckboxes.push(checkbox);
  }
  filterContainer.appendChild(filterOptionsWrapper);
  content.appendChild(
    createSettingGroup('カテゴリーフィルター:', filterContainer)
  );

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
  hideZeroCheckbox.checked = tab.hideZeroStat;
  const hideZeroSlider = document.createElement('span');
  hideZeroSlider.className = 'slider';
  hideZeroToggleSwitch.appendChild(hideZeroCheckbox);
  hideZeroToggleSwitch.appendChild(hideZeroSlider);
  hideZeroToggleWrapper.appendChild(hideZeroLabelText);
  hideZeroToggleWrapper.appendChild(hideZeroToggleSwitch);
  hideZeroWrapper.appendChild(hideZeroToggleWrapper);
  content.appendChild(createSettingGroup('追加フィルター:', hideZeroWrapper));

  // --- 連動処理 ---
  const updateAutomaticName = () => {
    if (autoNameCheckbox.checked) {
      const currentFilters = filterCheckboxes
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
      nameInput.value = generateAutomaticName(sortSelect.value, currentFilters);
    }
  };
  const toggleNameInput = () => {
    nameInput.disabled = autoNameCheckbox.checked;
    if (autoNameCheckbox.checked) {
      updateAutomaticName();
    }
  };

  autoNameCheckbox.addEventListener('change', toggleNameInput);
  sortSelect.addEventListener('change', updateAutomaticName);
  filterCheckboxes.forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const checkedCount = filterCheckboxes.filter((c) => c.checked).length;
      if (checkedCount === 0) {
        e.target.checked = true; // チェックを戻す
        alert('カテゴリーフィルターは最低1つ選択してください。');
        return;
      }
      updateAutomaticName();
    });
  });
  toggleNameInput(); // 初期状態を設定

  // --- モーダルのボタン ---
  const buttons = [
    { text: 'キャンセル', class: 'secondary', onClick: () => closeModal() },
    {
      text: '保存',
      class: 'primary',
      onClick: () => {
        // タブオブジェクトの情報を更新
        tab.name = nameInput.value;
        tab.isNameAutomatic = autoNameCheckbox.checked;
        tab.sortStat = sortSelect.value;
        tab.hideZeroStat = hideZeroCheckbox.checked;
        tab.filters = filterCheckboxes
          .filter((cb) => cb.checked)
          .map((cb) => cb.value);

        saveCustomTabs();
        renderCustomTabs();
        closeModal();

        // アクティブ状態の更新
        document
          .querySelectorAll('#inventory-tabs .active')
          .forEach((b) => b.classList.remove('active'));
        const savedTabElement = document.querySelector(
          `.custom-tab-container[data-tab-id="${tab.id}"]`
        );
        if (savedTabElement) {
          savedTabElement.classList.add('active');
          activeTabInfo = { type: 'custom', value: tab.id };
          refreshInventoryView();
        } else {
          document.querySelector('button[data-category="all"]').click();
        }
      },
    },
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
            e: equipped.enchantLevel,
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
        console.log('データベースは既に存在し、データが含まれています。');
        resolve();
      } else {
        console.log('データベースが空です。セットアップ処理を実行します...');
        if (typeof window.setupDatabase === 'function') {
          window
            .setupDatabase()
            .then(() => {
              console.log('データベースのセットアップが完了しました。');
              openDatabase().then(resolve).catch(reject);
            })
            .catch((err) => {
              console.error(
                'データベースのセットアップ中にエラーが発生しました。',
                err
              );
              reject(err);
            });
        } else {
          reject(
            'setupDatabase関数が見つかりません。db-setup.jsが正しく読み込まれているか確認してください。'
          );
        }
      }
    };
    countRequest.onerror = (event) => {
      console.error(
        'データベースのアイテム数確認中にエラーが発生しました。',
        event.target.error
      );
      reject(event.target.error);
    };
  });
}

function setupSetControls() {
  document.querySelectorAll('.layout-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = parseInt(btn.dataset.layout, 10);
      if (mode !== layoutMode) {
        updateLayoutMode(mode);
      }
    });
  });

  // Switcher initialization happens in updateLayoutMode

  document
    .getElementById('copy-set-button')
    .addEventListener('click', openCopyModal);
  document
    .getElementById('clear-set-button')
    .addEventListener('click', clearCurrentSet);
}

function updateLayoutMode(mode) {
  layoutMode = mode;
  
  // Toggle button active state
  document.querySelectorAll('.layout-button').forEach(btn => {
    if (parseInt(btn.dataset.layout, 10) === mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const switchersContainer = document.getElementById('set-switchers');
  switchersContainer.innerHTML = '';
  switchersContainer.style.display = mode === 4 ? 'none' : 'flex';

  if (mode === 1) {
    [1, 2, 3, 4].forEach(id => {
      const btn = document.createElement('button');
      btn.className = 'set-button';
      btn.dataset.setId = id;
      btn.textContent = String.fromCharCode(64 + id); // 1->A, 2->B, 3->C, 4->D
      switchersContainer.appendChild(btn);
    });
  } else if (mode === 2) {
    [{id: '1', text: 'A&B'}, {id: '3', text: 'C&D'}].forEach(group => {
      const btn = document.createElement('button');
      btn.className = 'set-button';
      btn.dataset.setId = group.id;
      btn.textContent = group.text;
      switchersContainer.appendChild(btn);
    });
    // Ensure activeSetId is 1 or 3
    if (activeSetId === '2') activeSetId = '1';
    if (activeSetId === '4') activeSetId = '3';
  } else if (mode === 4) {
    activeSetId = '1';
  }

  // Re-bind set-button events
  document.querySelectorAll('.set-button').forEach((button) => {
    button.addEventListener('click', () => {
      const newSetId = button.dataset.setId;
      if (newSetId !== activeSetId) {
        switchEquipmentSet(newSetId);
      }
    });
  });

  renderSetsLayout();
  switchEquipmentSet(activeSetId);
}

function renderSetsLayout() {
  const container = document.getElementById('sets-container');
  container.innerHTML = '';
  container.className = `sets-layout-${layoutMode}`;

  let setsToRender = [];
  if (layoutMode === 1) {
    setsToRender = [activeSetId];
  } else if (layoutMode === 2) {
    setsToRender = (activeSetId === '1' || activeSetId === '2') ? ['1', '2'] : ['3', '4'];
  } else if (layoutMode === 4) {
    setsToRender = ['1', '2', '3', '4'];
  }

  const columnsDef1 = [
    { id: 'weapon', name: '武器' },
    { id: 'top', name: '上装備' },
    { id: 'bottom', name: '下装備' },
    { id: 'cloak', name: 'マント' },
    { id: 'necklace', name: 'ネックレス' },
    { id: 'ring1', name: 'リング' },
    { id: 'ring3', name: 'リング' },
    { id: 'ring5', name: 'リング' },
    { id: 'guardian', name: '守護具' },
    { id: 'campanella', name: 'カンパネラ' }
  ];

  const columnsDef2 = [
    { id: 'head', name: '頭' },
    { id: 'hands', name: '手' },
    { id: 'feet', name: '足' },
    { id: 'belt', name: 'ベルト' },
    { id: 'bracelet', name: 'ブレスレット' },
    { id: 'ring2', name: 'リング' },
    { id: 'ring4', name: 'リング' },
    { id: 'medal', name: '勲章' },
    { id: 'amulet', name: 'アミュレッタ' },
    { id: 'placeholder', name: '' }
  ];

  setsToRender.forEach((setId) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'set-wrapper';
    wrapper.dataset.setId = setId;

    // ヘッダー（2セット以上表示の場合のみ表示するとわかりやすいかも）
    if (layoutMode > 1) {
      const title = document.createElement('div');
      title.style.textAlign = 'center';
      title.style.fontSize = '12px';
      title.style.color = setId === activeSetId ? '#ffdd00' : '#888';
      title.style.fontWeight = 'bold';
      title.style.cursor = 'pointer';
      title.style.padding = '4px 0';
      title.style.borderRadius = '4px';
      if (setId === activeSetId) {
        title.style.backgroundColor = '#444';
      }
      title.textContent = `SET ${String.fromCharCode(64 + parseInt(setId, 10))}` + (setId === activeSetId ? ' (MAIN)' : '');
      title.title = 'クリックしてこのセットをメイン(装備先)に設定';
      title.onclick = () => {
        if (setId !== activeSetId) {
          switchEquipmentSet(setId);
        }
      };
      wrapper.appendChild(title);
    }

    const colsContainer = document.createElement('div');
    colsContainer.className = 'set-columns-container';

    const col1 = document.createElement('div');
    col1.className = 'equipment-column';
    columnsDef1.forEach(slotDef => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      if (slotDef.id === 'placeholder') slot.id = 'slot-placeholder';
      else slot.id = `dom-${setId}-slot-${slotDef.id}`;
      if (slotDef.name) {
        const span = document.createElement('span');
        span.textContent = slotDef.name;
        slot.appendChild(span);
      }
      col1.appendChild(slot);
    });

    const col2 = document.createElement('div');
    col2.className = 'equipment-column';
    columnsDef2.forEach(slotDef => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      if (slotDef.id === 'placeholder') slot.id = 'slot-placeholder';
      else slot.id = `dom-${setId}-slot-${slotDef.id}`;
      if (slotDef.name) {
        const span = document.createElement('span');
        span.textContent = slotDef.name;
        slot.appendChild(span);
      }
      col2.appendChild(slot);
    });

    colsContainer.appendChild(col1);
    colsContainer.appendChild(col2);
    wrapper.appendChild(colsContainer);
    container.appendChild(wrapper);
  });
}

function switchEquipmentSet(newSetId) {
  allEquipmentSets[activeSetId] = equippedItems;
  activeSetId = String(newSetId);
  equippedItems = allEquipmentSets[activeSetId] || {};
  saveAllEquipmentSets();
  clearAllSelections();
  
  // 常にDOMの再描画が必要（タイトルや表示対象、DOMのIDが変わるため）
  renderSetsLayout();
  
  renderAllSlots();
  calculateAndRenderStats();
  updateSetButtonsUI();
}

function updateSetButtonsUI() {
  document.querySelectorAll('.set-button').forEach((button) => {
    if (layoutMode === 2) {
      const isGroupAB = (activeSetId === '1' || activeSetId === '2');
      if ((isGroupAB && button.dataset.setId === '1') || (!isGroupAB && button.dataset.setId === '3')) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    } else {
      if (button.dataset.setId === activeSetId) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    }
  });
}

function clearCurrentSet() {
  const letter = String.fromCharCode(64 + parseInt(activeSetId, 10));
  if (
    confirm(`セット ${letter} の装備を全てクリアします。よろしいですか？`)
  ) {
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
    button.textContent = String.fromCharCode(64 + i);
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
  if (
    confirm(
      `セット${sourceSetId} の内容を、現在のセット${activeSetId} に上書きコピーします。よろしいですか？`
    )
  ) {
    const sourceData = JSON.parse(
      JSON.stringify(allEquipmentSets[sourceSetId] || {})
    );
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

  if (!items)
    return { totalStats, percentStats, activeSetBonuses, activeSetInfo };

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
        if (statRates.includes(statName)) {
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
    if (
      equipped &&
      equipped.item &&
      equipped.item['セット名'] &&
      equipped.item['セット名'] !== '-'
    ) {
      const setName = equipped.item['セット名'];
      // 装備のカテゴリ（'weapon', 'ring'など）を取得
      const slotCategory = TYPE_TO_SLOT_CATEGORY[equipped.item['タイプ']];

      if (!setCounts[setName]) {
        // 一時的にカテゴリを保存する 'categories' を Set として用意
        setCounts[setName] = {
          count: 0,
          slots: [],
          categories: new Set(),
        };
      }

      if (slotCategory) {
        setCounts[setName].categories.add(slotCategory);
      }
      setCounts[setName].slots.push(slotId);
    }
  }

  // ループの後、ユニークなカテゴリの数（.size）を本来の .count に代入する
  for (const setName in setCounts) {
    setCounts[setName].count = setCounts[setName].categories.size;
    // 不要になった一時プロパティは削除しておく
    delete setCounts[setName].categories;
  }
  if (Object.keys(setCounts).length > 0) {
    try {
      console.log(
        '[シミュレータ診断] setBonusesストアのトランザクションを開始します。'
      );
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

        console.log(
          `[シミュレータ診断] DBから取得した「${setName}」のルール:`,
          setData
        );

        if (setData) {
          // 発動条件を満たすボーナスの中から、最大のセット数を持つものを探し出す
          let bestBonus = null;
          setData.bonuses.forEach((bonus) => {
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
              if (statRates.includes(statName)) {
                percentStats.add(statName);
              }
            }
            // 表示用の配列にも、この最大の効果だけを追加する
            activeSetBonuses.push({
              setName: setName,
              count: bestBonus.count,
              stats: bestBonus.stats,
            });
            activeSetInfo[setName] = {
              slots: setCounts[setName].slots,
            };
          }
        }
      }
    } catch (e) {
      console.error(
        '[シミュレータ診断] セット効果の計算中にエラーが発生しました:',
        e
      );
    }
  }

  return { totalStats, percentStats, activeSetBonuses, activeSetInfo };
}

function getEnchantBonus(item, enchantLevel) {
  const bonus = {};
  if (!item || enchantLevel <= 0) {
    return bonus;
  }

  const groupId = item.EnhanceGroupId;
  if (!groupId || !allEnhancementData || !allEnhancementData[groupId]) {
    return bonus;
  }

  const groupData = allEnhancementData[groupId];
  if (groupData[enchantLevel]) {
    return { ...groupData[enchantLevel] };
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
    label.textContent = String.fromCharCode(64 + i);
    selectorDiv.appendChild(input);
    selectorDiv.appendChild(label);
  }

  container.appendChild(selectorDiv);

  selectorDiv.querySelectorAll('input[type="radio"]').forEach((radio) => {
    radio.addEventListener('change', (event) => {
      comparisonSetId =
        event.target.value === 'none' ? null : event.target.value;
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

  Object.keys(sortOrders).forEach((key) => {
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

  const currentStatNames = Array.from(
    statsList.querySelectorAll('.stat-entry')
  ).map((el) => el.dataset.statName);

  if (!isSortMode && !sortOrders.default) {
    sortOrders.default = currentStatNames;
  }

  if (isSortMode) {
    const newOrder = Array.from(statsList.querySelectorAll('.stat-entry')).map(
      (el) => el.dataset.statName
    );
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
          },
        },
        {
          text: '新規作成',
          class: 'primary',
          onClick: () => {
            closeModal();
            handleCreateNewSortOrder();
          },
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
      onClick: () => closeModal(),
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
        const baseOrder =
          sortOrders.default ||
          Array.from(document.querySelectorAll('.stats-list .stat-entry')).map(
            (el) => el.dataset.statName
          );
        sortOrders[newName] = [...baseOrder];
        activeSortKey = newName;
        saveSortOrders();
        isSortMode = true;
        toggleSortModeUI(true);
        closeModal();
      },
    },
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
      onClick: () => closeModal(),
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
      },
    },
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
      onClick: () => closeModal(),
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
      },
    },
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
  buttons.forEach((btnInfo) => {
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
    28: 'アミュレッタ',
  };

  return typeMapping[prefix] || null;
}

// --- AIプロンプト生成機能 ---
function setupAIPromptButton() {
  const aiButton = document.getElementById('ai-prompt-button');
  const aiModalOverlay = document.getElementById('ai-modal-overlay');
  const aiCloseBtn = document.getElementById('ai-close-btn');
  const aiGenerateBtn = document.getElementById('ai-generate-btn');
  const aiConfigInput = document.getElementById('ai-config-input');
  const aiResultContainer = document.getElementById('ai-result-container');
  const aiPromptOutput = document.getElementById('ai-prompt-output');
  const aiCopyBtn = document.getElementById('ai-copy-btn');

  if (!aiButton) return;

  aiButton.addEventListener('click', () => {
    aiModalOverlay.classList.remove('hidden');
    aiConfigInput.value = '';
    aiPromptOutput.value = '';
    aiResultContainer.classList.add('hidden');
  });

  aiCloseBtn.addEventListener('click', () => {
    aiModalOverlay.classList.add('hidden');
  });

  aiModalOverlay.addEventListener('click', (e) => {
    if (e.target === aiModalOverlay) {
      aiModalOverlay.classList.add('hidden');
    }
  });

  aiGenerateBtn.addEventListener('click', async () => {
    const userInput = aiConfigInput.value.trim();
    if (!userInput) {
      alert('構成について入力してください。');
      return;
    }

    const proposalModeObj = document.querySelector('input[name="ai-proposal-mode"]:checked');
    const proposalMode = proposalModeObj ? proposalModeObj.value : '1';

    aiGenerateBtn.disabled = true;
    aiGenerateBtn.textContent = '生成中...';

    try {

      // Helper function to format stats
      function getItemStatsString(item, enchantLevel) {
        const baseStats = {};
        STAT_HEADERS.forEach((statName) => {
          const value = parseFloat(item[statName]);
          if (value && !isNaN(value) && value !== 0 && statName !== '評価数値') {
            baseStats[statName] = value;
          }
        });

        const enchantBonus = typeof getEnchantBonus === 'function' ? getEnchantBonus(item, enchantLevel) : {};
        const allStatKeys = new Set([...Object.keys(baseStats), ...Object.keys(enchantBonus)]);

        if (allStatKeys.size === 0) return '';

        const statStrings = [];
        allStatKeys.forEach(statName => {
          if (statName === '評価数値') return;
          const baseValue = baseStats[statName] || 0;
          const bonusValue = enchantBonus[statName] || 0;
          const totalValue = baseValue + bonusValue;
          if (totalValue !== 0) {
            let valStr = Number.isInteger(totalValue) ? totalValue : totalValue.toFixed(2);
            statStrings.push(`${statName}: ${valStr}`);
          }
        });
        return statStrings.length > 0 ? ` [${statStrings.join(', ')}]` : '';
      }

      // Helper function to apply settings filters
      const applySettingsFilter = (item) => {
        const alwaysShowSpecial = localStorage.getItem('setting-always-show-special') === 'true';
        const isSpecialItem = (it) => {
          if (!alwaysShowSpecial) return false;
          const cat = TYPE_TO_SLOT_CATEGORY[it['タイプ']];
          return cat === 'campanella' || cat === 'amulet';
        };

        const isAncientOnly = localStorage.getItem('setting-ancient-only') === 'true';
        if (isAncientOnly) {
          const targetRanks = ['古代', '伝説', 'SPECIAL'];
          if (!targetRanks.includes(item['ランク']) && !isSpecialItem(item)) return false;
        }

        const isHideLegendary = localStorage.getItem('setting-hide-legendary') === 'true';
        if (isHideLegendary) {
          if (item['ランク'] === '伝説' && !isSpecialItem(item)) return false;
        }

        const selectedClasses = JSON.parse(localStorage.getItem('setting-classes')) || [];
        if (selectedClasses.length > 0) {
          const type = item['タイプ'];
          const isWeapon = TYPE_TO_SLOT_CATEGORY && TYPE_TO_SLOT_CATEGORY[type] === 'weapon';
          if (isWeapon && !selectedClasses.includes(type)) return false;
        }

        return true;
      };

      // Format current equipment
      let currentEquipStr = '';
      for (const [slotId, itemData] of Object.entries(equippedItems)) {
        if (!applySettingsFilter(itemData.item)) continue;
        const jpName = SLOT_ID_TO_JAPANESE_NAME[slotId] || slotId;
        const enchant = itemData.enchantLevel > 0 ? `+${itemData.enchantLevel}` : '';
        const statsStr = getItemStatsString(itemData.item, itemData.enchantLevel);
        currentEquipStr += `  - ${jpName}: ${itemData.item['名称']} ${enchant}${statsStr}\n`;
      }
      if (!currentEquipStr) currentEquipStr = '  なし\n';

      // Format set info
      let setsStr = '';
      for (let i = 1; i <= 1; i++) {
        const setObj = allEquipmentSets[i];
        if (!setObj || Object.keys(setObj).length === 0) continue;
        let setContentStr = '';
        for (const [slotId, itemData] of Object.entries(setObj)) {
          if (!applySettingsFilter(itemData.item)) continue;
          const jpName = SLOT_ID_TO_JAPANESE_NAME[slotId] || slotId;
          const enchant = itemData.enchantLevel > 0 ? `+${itemData.enchantLevel}` : '';
          const statsStr = getItemStatsString(itemData.item, itemData.enchantLevel);
          setContentStr += `    - ${jpName}: ${itemData.item['名称']} ${enchant}${statsStr}\n`;
        }
        if (setContentStr) {
          setsStr += `  [セット${i}]\n` + setContentStr;
        }
      }
      if (!setsStr) setsStr = '  なし\n';

      // Format inventory
      let invStr = '';
      const invItemsList = [];
      for (const item of allInventoryItems) {
        if (!applySettingsFilter(item)) continue;
        const name = item['名称'];
        const type = item['タイプ'];
        const instances = inventoryEnhancements[name] || [];
        instances.forEach(inst => {
          const enchant = inst.Lv > 0 ? `+${inst.Lv}` : '';
          const statsStr = getItemStatsString(item, inst.Lv);
          invItemsList.push(`    - ${name} ${enchant} (${type})${statsStr}`);
        });
      }
      if (invItemsList.length > 0) {
        invStr = invItemsList.join('\n') + '\n';
      } else {
        invStr = '  なし\n';
      }

      // Item list
      const allItems = await new Promise((resolve, reject) => {
        if (!db) { resolve([]); return; }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      const itemListFormatted = [];
      if (proposalMode === '2' || proposalMode === '3') {
        for (const item of allItems) {
          if (!applySettingsFilter(item)) continue;
          const name = item['名称'];
          const type = item['タイプ'];
          const statsStr = getItemStatsString(item, 0); // show base stats
          if (statsStr) {
            itemListFormatted.push(`- ${name} (${type})${statsStr}`);
          }
        }
      }
      let itemListStr = itemListFormatted.join('\n') || 'アイテム情報がありません';

      let proposalConditionText = '';
      if (proposalMode === '1') {
        proposalConditionText = 'インベントリの情報（手持ちのアイテム）を最大限使って構成を作成してください。';
      } else if (proposalMode === '2') {
        proposalConditionText = 'インベントリの情報を最大限使いますが、3つのアイテムは全アイテム一覧から作成（新規調達）するように構成してください。';
      } else if (proposalMode === '3') {
        proposalConditionText = '既存のインベントリに縛られず、全アイテム一覧を最大限使って理想的な構成を作成してください。';
      }

      const promptTemplate = `あなたはゲームの装備構成の専門家です。
以下のユーザーの要望と条件に基づいて、装備構成を１つ提案してください。

【思考・選定プロセス】
構成を提案する前に、以下の手順で必ず思考プロセスを出力してください。
1. ユーザーの要望を分析し、今回の構成においてどのステータス（複数可）が重要になるかを解釈して記述してください。
2. 該当するアイテムをリストアップし、重視すべきステータスの値が高い順にソートしてください。複数のステータスが該当する場合は、それらのステータス値の合計値が高い順にソートしてください。
3. そのソート結果に基づいて、上位のアイテムからピックアップして構成を作成してください。

【ゲームの装備構成のルール（各スロットの装着可能数）】
- 武器 x 1
- 頭 x 1
- 上装備 x 1
- 下装備 x 1
- 手 x 1
- 足 x 1
- マント x 1
- ベルト x 1
- ネックレス x 1
- ブレスレット x 1
- リング x 5
- 勲章 x 1
- 守護具 x 1
- アミュレッタ x 1
- カンパネラ x 1
※必ずこのスロット数に収まるように構成してください。
※リング枠（5枠）については、全く同じ名前のリングを複数個（最大5個まで）重複して装備することが可能です。リング以外の部位はそれぞれ1つずつしか装備できません。

【ユーザーの要望】
${userInput}

【現在の状態】
・現在の装備状態:
${currentEquipStr}
・セット情報:
${setsStr}
・インベントリの情報:
${invStr}
${proposalMode !== '1' ? `・全アイテム一覧（新規調達や理想構成の検討に使用）:\n${itemListStr}\n` : ''}
【提案の条件】
${proposalConditionText}`;

      aiPromptOutput.value = promptTemplate;
      aiResultContainer.classList.remove('hidden');
    } catch (e) {
      console.error('AIプロンプト生成エラー:', e);
      alert('アイテム情報の取得に失敗しました。');
    } finally {
      aiGenerateBtn.disabled = false;
      aiGenerateBtn.textContent = 'OK';
    }
  });

  aiCopyBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(aiPromptOutput.value);
        alert('クリップボードにコピーしました！');
      } else {
        // Fallback for older browsers
        aiPromptOutput.select();
        document.execCommand('copy');
        alert('クリップボードにコピーしました！(フォールバック)');
      }
    } catch (err) {
      console.error('Copy failed:', err);
      // Fallback
      aiPromptOutput.select();
      document.execCommand('copy');
      alert('クリップボードにコピーしました！(フォールバック)');
    }
  });
}

// --- 設定画面機能 ---
function setupSettingsButton() {
  const settingsBtn = document.getElementById('settings-button');
  const overlay = document.getElementById('settings-modal-overlay');
  const closeBtn = document.getElementById('settings-close-btn');

  if (!settingsBtn || !overlay || !closeBtn) return;

  settingsBtn.addEventListener('click', () => {
    overlay.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  // 古代以上のみ表示設定の初期化とイベント
  const ancientOnlyCheckbox = document.getElementById('setting-ancient-only');
  if (ancientOnlyCheckbox) {
    ancientOnlyCheckbox.checked = localStorage.getItem('setting-ancient-only') === 'true';
    ancientOnlyCheckbox.addEventListener('change', (e) => {
      localStorage.setItem('setting-ancient-only', e.target.checked);
      if (typeof refreshInventoryView === 'function') {
        refreshInventoryView();
      }
    });
  }

  // 伝説は表示しない設定の初期化とイベント
  const hideLegendaryCheckbox = document.getElementById('setting-hide-legendary');
  if (hideLegendaryCheckbox) {
    hideLegendaryCheckbox.checked = localStorage.getItem('setting-hide-legendary') === 'true';
    hideLegendaryCheckbox.addEventListener('change', (e) => {
      localStorage.setItem('setting-hide-legendary', e.target.checked);
      if (typeof refreshInventoryView === 'function') {
        refreshInventoryView();
      }
    });
  }

  // カンパネラとアミュレッタは全て表示する設定の初期化とイベント
  const alwaysShowSpecialCheckbox = document.getElementById('setting-always-show-special');
  if (alwaysShowSpecialCheckbox) {
    alwaysShowSpecialCheckbox.checked = localStorage.getItem('setting-always-show-special') === 'true';
    alwaysShowSpecialCheckbox.addEventListener('change', (e) => {
      localStorage.setItem('setting-always-show-special', e.target.checked);
      if (typeof refreshInventoryView === 'function') {
        refreshInventoryView();
      }
    });
  }

  // 職選択設定の初期化とイベント
  const classCheckboxes = document.querySelectorAll('#setting-class-grid input[type="checkbox"]');
  const savedClasses = JSON.parse(localStorage.getItem('setting-classes')) || [];
  
  classCheckboxes.forEach(cb => {
    cb.checked = savedClasses.includes(cb.value);
    cb.addEventListener('change', () => {
      const selected = Array.from(classCheckboxes)
        .filter(c => c.checked)
        .map(c => c.value);
      localStorage.setItem('setting-classes', JSON.stringify(selected));
      if (typeof refreshInventoryView === 'function') {
        refreshInventoryView();
      }
    });
  });
}
