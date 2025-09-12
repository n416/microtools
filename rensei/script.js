// --- STEP 1: 2つのデータセットを定義 ---

// データセットA: 私たちの検証データ
const databaseA = {
  items: {
    purple_plus0: { name: '+0 紫装備', points: 75, rarity: 'purple' },
    purple_plus1: { name: '+1 紫装備', points: 75, rarity: 'purple' },
    purple_plus5: { name: '+5 紫装備', points: 75, rarity: 'purple' },
    purple_plus6: { name: '+6 紫装備', points: 127, rarity: 'purple' },
    purple_plus7: { name: '+7 紫装備', points: 197, rarity: 'purple' },
    purple_plus8: { name: '+8 紫装備', points: 400, rarity: 'purple' },
    purple_plus9: { name: '+9 紫装備', points: 413, rarity: 'purple' },
    purple_plus10: { name: '+10 紫装備', points: 426, rarity: 'purple' },
    purple_plus11: { name: '+11 紫装備', points: 476, rarity: 'purple' },
    blue_tradable_skill: { name: '青スキル本(可)', points: 15, rarity: 'blue' },
    blue_tradable_equip: { name: '青装備(可)', points: 15, rarity: 'blue' },
    blue_untradable_equip: { name: '青装備(不)', points: 12, rarity: 'blue' },
  },
  thresholds: [
    { stage: 10, requiredPoints: 1250 }, { stage: 9, requiredPoints: 1000 },
    { stage: 8, requiredPoints: 700 }, { stage: 7, requiredPoints: 450 },
    { stage: 6, requiredPoints: 400 }, { stage: 5, requiredPoints: 250 },
    { stage: 4, requiredPoints: 150 }, { stage: 3, requiredPoints: 100 },
    { stage: 2, requiredPoints: 75 }, { stage: 1, requiredPoints: 60 }
  ]
};

// データセットB: 提供された新しいデータ
const databaseB = {
    items: {
        purple_plus1: { name: '+1 紫装備', points: 150, rarity: 'purple' },
        purple_plus2: { name: '+2 紫装備', points: 150, rarity: 'purple' },
        purple_plus3: { name: '+3 紫装備', points: 150, rarity: 'purple' },
        purple_plus4: { name: '+4 紫装備', points: 180, rarity: 'purple' },
        purple_plus5: { name: '+5 紫装備', points: 200, rarity: 'purple' },
        purple_plus6: { name: '+6 紫装備', points: 250, rarity: 'purple' },
        purple_plus7: { name: '+7 紫装備', points: 350, rarity: 'purple' },
        purple_plus8: { name: '+8 紫装備', points: 600, rarity: 'purple' },
        purple_plus9: { name: '+9 紫装備', points: 825, rarity: 'purple' },
        purple_plus10: { name: '+10 紫装備', points: 1125, rarity: 'purple' },
        purple_plus11: { name: '+11 紫装備', points: 1500, rarity: 'purple' },
        purple_plus12: { name: '+12 紫装備', points: 1950, rarity: 'purple' },
        blue_tradable_plus1: { name: '+1 青(可)', points: 30, rarity: 'blue' },
        blue_tradable_plus2: { name: '+2 青(可)', points: 30, rarity: 'blue' },
        blue_tradable_plus3: { name: '+3 青(可)', points: 30, rarity: 'blue' },
        blue_tradable_plus4: { name: '+4 青(可)', points: 36, rarity: 'blue' },
        blue_tradable_plus5: { name: '+5 青(可)', points: 40, rarity: 'blue' },
        blue_tradable_plus6: { name: '+6 青(可)', points: 60, rarity: 'blue' },
        blue_tradable_plus7: { name: '+7 青(可)', points: 90, rarity: 'blue' },
        blue_tradable_plus8: { name: '+8 青(可)', points: 120, rarity: 'blue' },
        blue_tradable_plus9: { name: '+9 青(可)', points: 165, rarity: 'blue' },
        blue_tradable_plus10: { name: '+10 青(可)', points: 225, rarity: 'blue' },
        blue_tradable_plus11: { name: '+11 青(可)', points: 300, rarity: 'blue' },
        blue_tradable_plus12: { name: '+12 青(可)', points: 390, rarity: 'blue' },
        blue_untradable_plus1: { name: '+1 青(不)', points: 15, rarity: 'blue' },
        blue_untradable_plus2: { name: '+2 青(不)', points: 15, rarity: 'blue' },
        blue_untradable_plus3: { name: '+3 青(不)', points: 15, rarity: 'blue' },
        blue_untradable_plus4: { name: '+4 青(不)', points: 18, rarity: 'blue' },
        blue_untradable_plus5: { name: '+5 青(不)', points: 20, rarity: 'blue' },
        blue_untradable_plus6: { name: '+6 青(不)', points: 30, rarity: 'blue' },
        blue_untradable_plus7: { name: '+7 青(不)', points: 45, rarity: 'blue' },
        blue_untradable_plus8: { name: '+8 青(不)', points: 60, rarity: 'blue' },
        blue_untradable_plus9: { name: '+9 青(不)', points: 82.5, rarity: 'blue' },
        blue_untradable_plus10: { name: '+10 青(不)', points: 112.5, rarity: 'blue' },
        blue_untradable_plus11: { name: '+11 青(不)', points: 150, rarity: 'blue' },
        blue_untradable_plus12: { name: '+12 青(不)', points: 195, rarity: 'blue' },
        green_tradable_plus1: { name: '+1 緑(可)', points: 10, rarity: 'green' },
        green_tradable_plus2: { name: '+2 緑(可)', points: 10, rarity: 'green' },
        green_tradable_plus3: { name: '+3 緑(可)', points: 10, rarity: 'green' },
        green_tradable_plus4: { name: '+4 緑(可)', points: 12, rarity: 'green' },
        green_tradable_plus5: { name: '+5 緑(可)', points: 15, rarity: 'green' },
        green_tradable_plus6: { name: '+6 緑(可)', points: 20, rarity: 'green' },
        green_tradable_plus7: { name: '+7 緑(可)', points: 30, rarity: 'green' },
        green_tradable_plus8: { name: '+8 緑(可)', points: 40, rarity: 'green' },
        green_tradable_plus9: { name: '+9 緑(可)', points: 55, rarity: 'green' },
        green_tradable_plus10: { name: '+10 緑(可)', points: 75, rarity: 'green' },
        green_tradable_plus11: { name: '+11 緑(可)', points: 100, rarity: 'green' },
        green_tradable_plus12: { name: '+12 緑(可)', points: 130, rarity: 'green' },
        green_untradable_plus1: { name: '+1 緑(不)', points: 5, rarity: 'green' },
        green_untradable_plus2: { name: '+2 緑(不)', points: 5, rarity: 'green' },
        green_untradable_plus3: { name: '+3 緑(不)', points: 5, rarity: 'green' },
        green_untradable_plus4: { name: '+4 緑(不)', points: 6, rarity: 'green' },
        green_untradable_plus5: { name: '+5 緑(不)', points: 7.5, rarity: 'green' },
        green_untradable_plus6: { name: '+6 緑(不)', points: 10, rarity: 'green' },
        green_untradable_plus7: { name: '+7 緑(不)', points: 15, rarity: 'green' },
        green_untradable_plus8: { name: '+8 緑(不)', points: 20, rarity: 'green' },
        green_untradable_plus9: { name: '+9 緑(不)', points: 27.5, rarity: 'green' },
        green_untradable_plus10: { name: '+10 緑(不)', points: 37.5, rarity: 'green' },
        green_untradable_plus11: { name: '+11 緑(不)', points: 50, rarity: 'green' },
        green_untradable_plus12: { name: '+12 緑(不)', points: 65, rarity: 'green' },
    },
    thresholds: [
        { stage: 13, requiredPoints: 9500 }, { stage: 12, requiredPoints: 7500 },
        { stage: 11, requiredPoints: 5500 }, { stage: 10, requiredPoints: 4000 },
        { stage: 9, requiredPoints: 3000 }, { stage: 8, requiredPoints: 2200 },
        { stage: 7, requiredPoints: 1500 }, { stage: 6, requiredPoints: 900 },
        { stage: 5, requiredPoints: 700 }, { stage: 4, requiredPoints: 330 },
        { stage: 3, requiredPoints: 190 }, { stage: 2, requiredPoints: 150 },
        { stage: 1, requiredPoints: 1 }
    ]
};

// インベントリ表示用に全アイテムを統合 (重複はBを優先)
const allItems = { ...databaseA.items, ...databaseB.items };


// --- STEP 2: シミュレーターの動作を定義 ---

const slots = document.querySelectorAll('.slot');
const inventoryGrid = document.getElementById('inventory-grid');
const resultDisplayA = document.getElementById('result-display-A');
const resultDisplayB = document.getElementById('result-display-B');
const resetButton = document.getElementById('reset-button');

let equippedItems = [null, null, null, null, null];

// 計算と表示を更新するメインの関数
function updateSimulation() {
  calculateAndDisplay(databaseA, resultDisplayA);
  calculateAndDisplay(databaseB, resultDisplayB);
}

// データセットに基づいて計算＆表示する共通関数
function calculateAndDisplay(db, displayElement) {
  let totalPoints = 0;
  let equippedCount = 0;

  equippedItems.forEach(itemId => {
    if (itemId && db.items[itemId]) {
      totalPoints += db.items[itemId].points;
      equippedCount++;
    }
  });

  let currentStage = 0;
  if (equippedCount >= 3) {
    for (const threshold of db.thresholds) {
      if (totalPoints >= threshold.requiredPoints) {
        currentStage = threshold.stage;
        break;
      }
    }
  }

  displayElement.querySelector('h2').textContent = `${currentStage} 段階`;
  displayElement.querySelector('p').textContent = `合計ポイント: ${totalPoints.toLocaleString()}`;
}

// インベントリを動的に生成する
function populateInventory() {
  inventoryGrid.innerHTML = '';
  for (const itemId in allItems) {
    const item = allItems[itemId];
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('inventory-item');
    if (item.rarity) {
      itemDiv.classList.add(`item-${item.rarity}`);
    }

    const inA = databaseA.items.hasOwnProperty(itemId);
    const inB = databaseB.items.hasOwnProperty(itemId);
    let prefix = '';
    let sourceClass = '';

    if (inA && inB) {
      prefix = '[共通] ';
      sourceClass = 'item-source-common';
    } else if (inA) {
      prefix = '[私達] ';
      sourceClass = 'item-source-a';
    } else if (inB) {
      prefix = '[提供] ';
      sourceClass = 'item-source-b';
    }
    itemDiv.classList.add(sourceClass);
    itemDiv.textContent = prefix + item.name;
    itemDiv.dataset.itemId = itemId;

    inventoryGrid.appendChild(itemDiv);
  }
}

// スロットにアイテムを表示する関数
function renderSlotItem(slotElement, itemId) {
  slotElement.innerHTML = '';
  if (itemId) {
    const item = allItems[itemId];
    const slotContent = document.createElement('div');
    slotContent.classList.add('slot-content');
    slotContent.textContent = item.name;
    const slotRotations = { 'slot-1': 0, 'slot-2': 72, 'slot-3': 144, 'slot-4': 216, 'slot-5': 288 };
    const rotationDeg = slotRotations[slotElement.id] || 0;
    slotContent.style.transform = `rotate(${-rotationDeg}deg)`;
    slotElement.appendChild(slotContent);
    slotElement.className = 'slot';
    if (item.rarity) {
      slotElement.classList.add(`item-${item.rarity}`);
    }
  } else {
    slotElement.className = 'slot';
  }
}

// --- STEP 3: イベント設定 ---

inventoryGrid.addEventListener('click', (event) => {
  const clickedItem = event.target.closest('.inventory-item');
  if (!clickedItem) return;
  const itemId = clickedItem.dataset.itemId;
  const emptySlotIndex = equippedItems.findIndex(item => item === null);
  if (emptySlotIndex !== -1) {
    equippedItems[emptySlotIndex] = itemId;
    const slotElement = document.getElementById(`slot-${emptySlotIndex + 1}`);
    renderSlotItem(slotElement, itemId);
    updateSimulation();
  } else {
    alert('スロットに空きがありません。');
  }
});

slots.forEach(slot => {
  slot.addEventListener('click', () => {
    const slotIndex = parseInt(slot.dataset.slotIndex);
    if (equippedItems[slotIndex]) {
      equippedItems[slotIndex] = null;
      renderSlotItem(slot, null);
      updateSimulation();
    }
  });
});

resetButton.addEventListener('click', () => {
  equippedItems = [null, null, null, null, null];
  slots.forEach(slot => renderSlotItem(slot, null));
  updateSimulation();
});

// --- 初期化 ---
populateInventory();
updateSimulation();