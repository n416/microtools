// --- STEP 1: 我々の分析結果をデータとして定義 ---

// アイテムのデータベース (名前、ポイント、アイコン画像、レアリティなど)
const items = {
  // 紫装備
  purple_plus0: { name: '+0 紫装備', points: 75, icon: '仮', rarity: 'purple' },
  purple_plus1: { name: '+1 紫装備', points: 75, icon: '仮', rarity: 'purple' },
  purple_plus5: { name: '+5 紫装備', points: 75, icon: '仮', rarity: 'purple' },
  purple_plus6: { name: '+6 紫装備', points: 127, icon: '仮', rarity: 'purple' },
  purple_plus7: { name: '+7 紫装備', points: 197, icon: '仮', rarity: 'purple' },
  purple_plus8: { name: '+8 紫装備', points: 400, icon: '仮', rarity: 'purple' },
  // ▼▼▼ 誤っていたポイントを修正 ▼▼▼
  purple_plus9: { name: '+9 紫装備', points: 413, icon: '仮', rarity: 'purple' },
  purple_plus10: { name: '+10 紫装備', points: 426, icon: '仮', rarity: 'purple' },
  purple_plus11: { name: '+11 紫装備', points: 476, icon: '仮', rarity: 'purple' },

  // 青・取引可能品
  blue_tradable_skill: { name: '青スキル本(可)', points: 15, icon: '仮', rarity: 'blue' },
  blue_tradable_equip: { name: '青装備(可)', points: 15, icon: '仮', rarity: 'blue' },

  // 青・取引不能品
  blue_untradable_equip: { name: '青装備(不)', points: 12, icon: '仮', rarity: 'blue' },
};

// 段階のしきい値
// ▼▼▼ 7段階以上のデータを追加 ▼▼▼
const thresholds = [
  { stage: 10, requiredPoints: 1250 },
  { stage: 9, requiredPoints: 1000 },
  { stage: 8, requiredPoints: 700 },
  { stage: 7, requiredPoints: 450 },
  { stage: 6, requiredPoints: 400 },
  { stage: 5, requiredPoints: 250 },
  { stage: 4, requiredPoints: 150 },
  { stage: 3, requiredPoints: 100 },
  { stage: 2, requiredPoints: 75 },
  { stage: 1, requiredPoints: 60 }
];


// --- STEP 2: シミュレーターの動作を定義 ---

const slots = document.querySelectorAll('.slot');
const inventoryGrid = document.getElementById('inventory-grid');
const resultDisplay = document.getElementById('result-display');
const resetButton = document.getElementById('reset-button');

// 現在スロットに入っているアイテムの状態を管理
let equippedItems = [null, null, null, null, null];

// 計算と表示を更新するメインの関数
function updateSimulation() {
  let totalPoints = 0;
  let equippedCount = 0;

  equippedItems.forEach(itemId => {
    if (itemId) {
      totalPoints += items[itemId].points;
      equippedCount++;
    }
  });

  let currentStage = 0;
  // 3つ以上装備している場合のみ段階を計算
  if (equippedCount >= 3) {
    for (const threshold of thresholds) {
      if (totalPoints >= threshold.requiredPoints) {
        currentStage = threshold.stage;
        break;
      }
    }
  }

  // 結果を表示に反映
  resultDisplay.innerHTML = `
        <h2>${currentStage} 段階!</h2>
        <p>合計ポイント: ${totalPoints}</p>
    `;
}

// インベントリを動的に生成する
function populateInventory() {
  for (const itemId in items) {
    const item = items[itemId];
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('inventory-item');

    // レアリティに応じたクラスを追加
    if (item.rarity) {
      itemDiv.classList.add(`item-${item.rarity}`);
    }

    itemDiv.dataset.itemId = itemId;
    itemDiv.textContent = item.name;
    inventoryGrid.appendChild(itemDiv);
  }
}

// スロットにアイテムを表示する関数
function renderSlotItem(slotElement, itemId) {
  slotElement.innerHTML = ''; // スロットの中身を一度クリア

  if (itemId) {
    const item = items[itemId];
    const slotContent = document.createElement('div');
    slotContent.classList.add('slot-content');
    slotContent.textContent = item.name;

    // スロット自体の回転角度を取得し、コンテンツを逆回転させる
    const slotStyle = window.getComputedStyle(slotElement);
    const transformValue = slotStyle.getPropertyValue('transform');

    // transform行列から回転角度を計算 (簡易版、正確にはより複雑な計算が必要な場合がある)
    // ここでは、CSSで設定したrotate(XXdeg)を直接利用する
    const slotRotations = {
      'slot-1': 0,
      'slot-2': 72,
      'slot-3': 144,
      'slot-4': 216,
      'slot-5': 288
    };
    const slotId = slotElement.id;
    const rotationDeg = slotRotations[slotId] || 0;

    slotContent.style.transform = `rotate(${-rotationDeg}deg)`;

    slotElement.appendChild(slotContent);

    // スロットの背景色もアイテムに合わせる
    slotElement.className = 'slot'; // Reset classes
    if (item.rarity) {
      slotElement.classList.add(`item-${item.rarity}`);
    }
  } else {
    // アイテムがない場合は、背景色クラスをリセット
    slotElement.className = 'slot';
  }
}


// --- STEP 3: クリック操作などのイベントを設定 ---

// インベントリアイテムがクリックされた時の処理
inventoryGrid.addEventListener('click', (event) => {
  const clickedItem = event.target.closest('.inventory-item');
  if (!clickedItem) return;

  const itemId = clickedItem.dataset.itemId;
  const emptySlotIndex = equippedItems.findIndex(item => item === null);

  if (emptySlotIndex !== -1) {
    equippedItems[emptySlotIndex] = itemId;
    const slotElement = document.getElementById(`slot-${emptySlotIndex + 1}`);
    renderSlotItem(slotElement, itemId); // 新しい表示関数を呼び出し
    updateSimulation();
  } else {
    alert('スロットに空きがありません。');
  }
});

// スロットがクリックされた時の処理 (アイテムを外す)
slots.forEach(slot => {
  slot.addEventListener('click', () => {
    const slotIndex = parseInt(slot.dataset.slotIndex);
    if (equippedItems[slotIndex]) {
      equippedItems[slotIndex] = null;
      renderSlotItem(slot, null); // 新しい表示関数を呼び出し (アイテムなし)
      updateSimulation();
    }
  });
});

// リセットボタンが押された時の処理
resetButton.addEventListener('click', () => {
  equippedItems = [null, null, null, null, null];
  slots.forEach(slot => {
    renderSlotItem(slot, null); // 新しい表示関数を呼び出し (アイテムなし)
  });
  updateSimulation();
});


// --- 初期化 ---
populateInventory();
updateSimulation();