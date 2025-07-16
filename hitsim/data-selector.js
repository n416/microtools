// ===============================================
// data-selector.js : UI操作スクリプト (ソート機能修正版)
// ===============================================

const COLUMN_VISIBILITY_KEY = 'equipmentColumnVisibility_v1';
const ALL_STATS_HEADERS = [
  '画像URL',
  '名称',
  'ランク',
  'タイプ',
  'セット名',
  'ソーステキスト',
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
  '追加ダメージ',
  '遠距離攻撃力',
  'PvE攻撃力',
  '最大MP',
  '治癒量増幅',
  '魔法攻撃力',
  '攻撃力耐性',
  '武器ブロック',
  '追加ダメージ減少',
  '凍結抵抗',
  '鈍化抵抗',
  '失明抵抗',
  '武器攻撃力耐性',
  '麻痺抵抗',
  '沈黙抵抗',
  '受ける治癒量増加',
  'カバン最大重量',
  'HP絶対回復',
  'PvE防御力',
  'PvEクリティカル抵抗',
  '受ける治癒量増幅',
  'PvPクリティカル抵抗',
  'MP絶対回復',
  '遠距離クリティカル発生率',
  'PvP防御力',
  '一般防御力',
];
const COLUMN_GROUPS = {
  基本情報: ['画像URL', '名称', 'ランク', 'タイプ', '評価数値'],
  セット情報: ['セット名', 'ソーステキスト'],
  攻撃系: [
    '基本攻撃力',
    '攻撃力増幅',
    'クリティカルダメージ増幅',
    '一般攻撃力',
    'スキルダメージ増幅',
    '近距離攻撃力',
    '武器攻撃力',
    '命中',
    'PvP攻撃力',
    'PvE攻撃力',
    '遠距離攻撃力',
    '魔法攻撃力',
  ],
  防御系: [
    '防御力',
    'ガード',
    'クリティカル抵抗',
    'クリティカルダメージ耐性',
    'スキルダメージ耐性',
    '一般ダメージ耐性',
    '攻撃力耐性',
    '武器ブロック',
    '追加ダメージ減少',
    'PvP防御力',
    'PvE防御力',
    '武器攻撃力耐性',
    '一般防御力',
  ],
  '状態異常・CC': [
    '気絶的中',
    '気絶抵抗',
    '状態異常的中',
    '状態異常抵抗',
    '硬直',
    '硬直耐性',
    '凍結抵抗',
    '鈍化抵抗',
    '失明抵抗',
    '麻痺抵抗',
    '沈黙抵抗',
  ],
  クリティカル: [
    'クリティカル発生率',
    '近距離クリティカル発生率',
    '魔法クリティカル発生率',
    '遠距離クリティカル発生率',
    'PvPクリティカル発生率',
    'PvEクリティカル抵抗',
    'PvPクリティカル抵抗',
  ],
  'HP/MP/回復': [
    'HP回復',
    '最大HP',
    'MP回復',
    '最大MP',
    'ポーション回復量',
    '治癒量増加',
    '治癒量増幅',
    '受ける治癒量増加',
    '受ける治癒量増幅',
    'HP絶対回復',
    'MP絶対回復',
  ],
  属性ダメージ: [
    '水属性追加ダメージ',
    '風属性追加ダメージ',
    '土属性追加ダメージ',
    '火属性追加ダメージ',
    '追加ダメージ',
  ],
  その他: [
    '武力',
    'ガード貫通',
    '一般ダメージ増幅',
    '絶対回避',
    '活力',
    '忍耐',
    '聡明',
    '詠唱速度',
    '武器攻撃力増幅',
    'カバン最大重量',
  ],
};

// 文字列としてソートする列のリストを定義
const stringColumns = [
  '画像URL',
  '名称',
  'ランク',
  'タイプ',
  'セット名',
  'ソーステキスト',
];

let visibleColumns = [];
const DB_NAME = 'GameEquipmentDB';
const DB_VERSION = 12;
const STORE_NAME = 'equipment';
const INVENTORY_KEY = 'equipmentInventory_v2';
const FILTER_STATE_KEY = 'equipmentFilterState_v2';
const SORT_STATE_KEY = 'equipmentSortState_v1';

let allEquipment = [];
let currentInventory = [];
let uniqueTypes = [];
let uniqueRanks = [];

let filterState = {
  category: 'all',
  ranks: [],
  types: [],
  isInventoryOnly: false,
};
let sortState = {
  key: null,
  direction: 'none',
};

// === 初期化処理 ===
window.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  try {
    statusDiv.textContent = 'データベースを準備しています...';
    await setupDatabase();

    statusDiv.textContent = '装備データを読み込んでいます...';
    allEquipment = await getAllEquipmentFromDB();

    uniqueRanks = [...new Set(allEquipment.map(item => item['ランク']))].sort();
    uniqueTypes = [...new Set(allEquipment.map(item => item['タイプ']))].sort();

    currentInventory = loadInventory();
    loadFilterState();
    loadSortState();

    setupUpdateButton();
    initializeColumnSettings();
    initializeFilters();
  } catch (error) {
    console.error('初期化処理中にエラー:', error);
    statusDiv.textContent = `エラーが発生しました: ${error.message}`;
  }
});

// === 状態管理 ===
function loadInventory() {
  return JSON.parse(localStorage.getItem(INVENTORY_KEY)) || [];
}
function saveInventory(inventory) {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
}
function loadFilterState() {
  const stateJson = localStorage.getItem(FILTER_STATE_KEY);
  if (stateJson) filterState = {...filterState, ...JSON.parse(stateJson)};
}
function saveFilterState() {
  localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(filterState));
}
function loadSortState() {
  const stateJson = localStorage.getItem(SORT_STATE_KEY);
  if (stateJson) sortState = {...sortState, ...JSON.parse(stateJson)};
}
function saveSortState() {
  localStorage.setItem(SORT_STATE_KEY, JSON.stringify(sortState));
}

// === フィルタ・ソート処理 ===
function getCategoryFromType(typeString) {
  if (!typeString) return 'unknown';
  const prefix = parseInt(typeString.substring(0, 2), 10);
  if (prefix >= 1 && prefix <= 9) return 'weapon';
  if (prefix >= 11 && prefix <= 16) return 'armor';
  if (prefix >= 21 && prefix <= 28) return 'accessory';
  return 'unknown';
}

function initializeFilters() {
  populateOptions('#rank-filter', uniqueRanks);

  document.getElementById('category-filter').value = filterState.category;
  $('#rank-filter').val(filterState.ranks);
  document.getElementById('inventory-only-filter').checked =
    filterState.isInventoryOnly;

  $('#rank-filter').select2({
    placeholder: 'ランクで絞り込み',
    allowClear: true,
  });
  $('#type-filter').select2({
    placeholder: 'タイプで絞り込み',
    allowClear: true,
  });

  updateTypeFilterOptions();

  // --- イベントリスナー ---
  document.getElementById('category-filter').addEventListener('change', (e) => {
    filterState.category = e.target.value;
    updateTypeFilterOptions();
    saveStateAndRender();
  });
  $('#rank-filter').on('change', (e) => {
    filterState.ranks = ($(e.currentTarget).val() || []).filter((v) => v);
    saveStateAndRender();
  });
  $('#type-filter').on('change', (e) => {
    const newUiSelection = ($(e.currentTarget).val() || []).filter((v) => v);
    const visibleOptions = $('#type-filter option')
      .map((i, opt) => opt.value)
      .get();
    const unmanagedTypes = filterState.types.filter(
      (t) => !visibleOptions.includes(t)
    );
    const newMasterSelection = [
      ...new Set([...unmanagedTypes, ...newUiSelection]),
    ];
    filterState.types = newMasterSelection;
    saveStateAndRender();
  });
  document
    .getElementById('inventory-only-filter')
    .addEventListener('change', (e) => {
      filterState.isInventoryOnly = e.target.checked;
      saveStateAndRender();
    });

  setupFilterButtons();
  applyFiltersAndSortAndRender();
}

function saveStateAndRender() {
  saveFilterState();
  saveSortState();
  applyFiltersAndSortAndRender();
}

function updateTypeFilterOptions() {
  const typesForCategory =
    filterState.category === 'all'
      ? uniqueTypes
      : uniqueTypes.filter(
          (type) => getCategoryFromType(type) === filterState.category
        );

  populateOptions('#type-filter', typesForCategory);
  $('#type-filter').val(filterState.types);
  $('#type-filter').trigger('change.select2');
}

function populateOptions(selectId, optionsArray) {
  const selectElement = $(selectId);
  selectElement.empty();
  optionsArray.forEach((value) => {
    const option = new Option(value, value);
    selectElement.append(option);
  });
}

function setupFilterButtons() {
  $('#rank-select-all').on('click', () =>
    $('#rank-filter').val(uniqueRanks).trigger('change')
  );
  $('#rank-clear').on('click', () =>
    $('#rank-filter').val(null).trigger('change')
  );
  $('#type-select-all').on('click', () => {
    const allVisibleTypes = $('#type-filter option')
      .map((i, opt) => opt.value)
      .get();
    const newSelection = [
      ...new Set([...filterState.types, ...allVisibleTypes]),
    ];
    $('#type-filter').val(newSelection).trigger('change');
  });
  $('#type-clear').on('click', () => {
    const visibleTypes = $('#type-filter option')
      .map((i, opt) => opt.value)
      .get();
    const newSelection = filterState.types.filter(
      (t) => !visibleTypes.includes(t)
    );
    $('#type-filter').val(newSelection).trigger('change');
  });
}

function applyFiltersAndSortAndRender() {
  // 1. フィルタリング
  let processedData = allEquipment.filter(
    (item) =>
      (filterState.ranks.length === 0 ||
        filterState.ranks.includes(item['ランク'])) &&
      (filterState.types.length === 0 ||
        filterState.types.includes(item['タイプ'])) &&
      (filterState.category === 'all' ||
        getCategoryFromType(item['タイプ']) === filterState.category) &&
      (!filterState.isInventoryOnly || currentInventory.includes(item['名称']))
  );

  // ▼▼▼【ここから変更点 2/2】ソートロジックを全面的に置き換え ▼▼▼
  // 2. ソート
  if (sortState.key && sortState.direction !== 'none') {
    // 列名が stringColumns リストに含まれているかでソートタイプを決定
    const sortType = stringColumns.includes(sortState.key)
      ? 'string'
      : 'number';

    processedData.sort((a, b) => {
      const valA = a[sortState.key];
      const valB = b[sortState.key];
      let comparison = 0;

      if (sortType === 'number') {
        // 数値として比較
        const numA = parseFloat(valA) || -Infinity;
        const numB = parseFloat(valB) || -Infinity;
        comparison = numA - numB;
      } else {
        // 文字列として比較 (null/undefinedを空文字として扱う)
        comparison = String(valA || '').localeCompare(String(valB || ''), 'ja');
      }

      return sortState.direction === 'desc' ? comparison * -1 : comparison;
    });
  }
  // ▲▲▲【変更ここまで】▲▲▲

  // 3. 描画
  renderTable(processedData);
}

// --- DB関連 (変更なし) ---
function getAllEquipmentFromDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) =>
      reject(`DBオープンエラー: ${event.target.errorCode}`);
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const getAllRequest = objectStore.getAll();
      getAllRequest.onerror = (event) =>
        reject(`データ取得エラー: ${event.target.error}`);
      getAllRequest.onsuccess = (event) => resolve(event.target.result);
    };
  });
}

function renderTable(equipmentData) {
  const tableBody = document.querySelector('#equipment-table tbody');
  const tableHead = document.querySelector('#equipment-table thead');
  tableBody.innerHTML = '';
  tableHead.innerHTML = '';

  const statusDiv = document.getElementById('status');
  statusDiv.textContent = `${equipmentData.length}件の装備が見つかりました。`;

  if (!equipmentData) return;

  const displayHeaders = ['✔', ...visibleColumns];

  const headerRow = document.createElement('tr');
  displayHeaders.forEach((headerText) => {
    const th = document.createElement('th');
    if (headerText === '画像URL' || headerText === 'ソーステキスト') {
      th.textContent = '';
    } else {
      th.textContent = headerText;
    }

    if (ALL_STATS_HEADERS.includes(headerText)) {
      // ALL_STATS_HEADERSでソート可否を判断
      th.classList.add('sortable');
      th.dataset.sortKey = headerText;

      if (sortState.key === headerText) {
        th.classList.add(`sorted-${sortState.direction}`);
      }

      th.addEventListener('click', handleSortClick);
    }

    if (headerText === '✔' || headerText === '名称') {
      th.classList.add('sticky-col');
    }
    headerRow.appendChild(th);
  });
  tableHead.appendChild(headerRow);

  if (equipmentData.length === 0) return;

  equipmentData.forEach((item) => {
    const row = document.createElement('tr');

    const checkCell = document.createElement('td');
    checkCell.classList.add('sticky-col');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.itemId = item['名称'];
    if (currentInventory.includes(item['名称'])) {
      checkbox.checked = true;
    }
    checkbox.addEventListener('change', (event) => {
      const itemId = event.target.dataset.itemId;
      const isChecked = event.target.checked;
      const index = currentInventory.indexOf(itemId);
      if (isChecked && index === -1) {
        currentInventory.push(itemId);
      } else if (!isChecked && index > -1) {
        currentInventory.splice(index, 1);
      }
      saveInventory(currentInventory);
      if (filterState.isInventoryOnly) {
        applyFiltersAndSortAndRender();
      }
    });
    checkCell.appendChild(checkbox);
    row.appendChild(checkCell);

    visibleColumns.forEach((header) => {
      const cell = document.createElement('td');
      if (header === '画像URL' && item[header]) {
        const img = document.createElement('img');
        img.src = item[header];
        img.alt = item['名称'] || '装備画像';
        img.loading = 'lazy';
        img.width = 40;
        img.height = 40;
        cell.appendChild(img);
      } else {
        cell.textContent = item[header] || '';
      }
      if (header === '名称') {
        cell.classList.add('sticky-col');
      }
      row.appendChild(cell);
    });

    const clickableCells = [
      row.querySelector('td:nth-child(1)'),
      row.querySelector('td:nth-child(2)'),
    ];
    const checkboxInRow = row.querySelector('input[type="checkbox"]');
    clickableCells.forEach((cell) => {
      if (cell) {
        cell.addEventListener('click', (event) => {
          if (event.target.tagName !== 'INPUT') {
            checkboxInRow.checked = !checkboxInRow.checked;
            checkboxInRow.dispatchEvent(new Event('change', {bubbles: true}));
          }
        });
      }
    });
    tableBody.appendChild(row);
  });
}

function handleSortClick(event) {
  const clickedKey = event.currentTarget.dataset.sortKey;

  if (sortState.key === clickedKey) {
    if (sortState.direction === 'asc') {
      sortState.direction = 'desc';
    } else {
      sortState.direction = 'none';
      sortState.key = null;
    }
  } else {
    sortState.key = clickedKey;
    sortState.direction = 'asc';
  }

  saveStateAndRender();
}

function setupUpdateButton() {
  const updateButton = document.getElementById('update-db-button');
  const statusDiv = document.getElementById('status');

  if (!updateButton) return;

  updateButton.addEventListener('click', async () => {
    if (
      !confirm(
        'itemdata.tsv の内容でデータベースを完全に更新します。\nこの操作は元に戻せません。よろしいですか？'
      )
    ) {
      return;
    }
    updateButton.disabled = true;
    statusDiv.textContent =
      'データベースを更新中です...（ページを閉じないでください）';
    try {
      await setupDatabase();
      alert('データベースの更新が完了しました。ページを再読み込みします。');
      location.reload();
    } catch (error) {
      console.error('データベースの更新に失敗しました:', error);
      statusDiv.textContent = `エラー: データベースの更新に失敗しました。詳細はコンソールを確認してください。`;
      alert(`データベースの更新に失敗しました。\nエラー: ${error.message}`);
      updateButton.disabled = false;
    }
  });
}

function initializeColumnSettings() {
  loadVisibleColumns();
  createColumnSettingsModal();
  setupColumnSettingsEventListeners();
}

function loadVisibleColumns() {
  const savedColumns = localStorage.getItem(COLUMN_VISIBILITY_KEY);
  if (savedColumns) {
    visibleColumns = JSON.parse(savedColumns);
  } else {
    visibleColumns = [
      '画像URL',
      '名称',
      'ランク',
      'タイプ',
      'セット名',
      '評価数値',
      '基本攻撃力',
      '防御力',
    ];
  }
}

function createColumnSettingsModal() {
  let modalBodyHTML = `<input type="text" id="column-search-input" placeholder="表示したい列を検索...">`;
  for (const groupName in COLUMN_GROUPS) {
    modalBodyHTML += `
      <fieldset class="column-group">
        <legend>${groupName}</legend>
        <div class="column-group-actions">
          <a href="#" data-group-name="${groupName}" class="select-all-link">全て選択</a>
          <a href="#" data-group-name="${groupName}" class="deselect-all-link">全て解除</a>
        </div>
        <div class="column-list">
    `;
    COLUMN_GROUPS[groupName].forEach((colName) => {
      modalBodyHTML += `
        <div class="column-item">
          <label>
            <input type="checkbox" class="column-checkbox" value="${colName}" data-group="${groupName}">
            ${colName}
          </label>
        </div>
      `;
    });
    modalBodyHTML += `</div></fieldset>`;
  }

  const modalHTML = `
    <div id="column-settings-overlay">
      <div id="column-settings-modal">
        <div class="cs-modal-header">
          <h3>表示列の編集</h3>
          <button class="close-button">&times;</button>
        </div>
        <div class="cs-modal-body">
          ${modalBodyHTML}
        </div>
        <div class="cs-modal-footer">
          <button id="cs-cancel-button" class="button-like">キャンセル</button>
          <button id="cs-save-button" class="button-like" style="background-color: #007bff;">保存して適用</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function setupColumnSettingsEventListeners() {
  const openBtn = document.getElementById('column-settings-button');
  const overlay = document.getElementById('column-settings-overlay');
  const modal = document.getElementById('column-settings-modal');

  openBtn.addEventListener('click', openColumnSettingsModal);

  overlay.addEventListener('click', (e) => {
    if (e.target.id === 'column-settings-overlay') closeModal();
  });
  modal.querySelector('.close-button').addEventListener('click', closeModal);
  modal
    .querySelector('#cs-cancel-button')
    .addEventListener('click', closeModal);
  modal
    .querySelector('#cs-save-button')
    .addEventListener('click', saveAndApplyColumnSettings);

  modal.querySelectorAll('.select-all-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const groupName = e.target.dataset.groupName;
      modal
        .querySelectorAll(`input[data-group="${groupName}"]`)
        .forEach((cb) => (cb.checked = true));
    });
  });
  modal.querySelectorAll('.deselect-all-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const groupName = e.target.dataset.groupName;
      modal
        .querySelectorAll(`input[data-group="${groupName}"]`)
        .forEach((cb) => (cb.checked = false));
    });
  });

  modal.querySelector('#column-search-input').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    modal.querySelectorAll('.column-item').forEach((item) => {
      const labelText = item.querySelector('label').textContent.toLowerCase();
      if (labelText.includes(searchTerm)) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  });

  function closeModal() {
    overlay.style.display = 'none';
  }
}

function openColumnSettingsModal() {
  const overlay = document.getElementById('column-settings-overlay');
  overlay.querySelectorAll('.column-checkbox').forEach((cb) => {
    cb.checked = visibleColumns.includes(cb.value);
  });
  overlay.style.display = 'flex';
}

function saveAndApplyColumnSettings() {
  const newVisibleColumns = [];
  document
    .querySelectorAll('#column-settings-modal .column-checkbox:checked')
    .forEach((cb) => {
      newVisibleColumns.push(cb.value);
    });

  visibleColumns = newVisibleColumns;
  localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(visibleColumns));

  document.getElementById('column-settings-overlay').style.display = 'none';
  applyFiltersAndSortAndRender();
}
