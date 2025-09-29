// ===== Utility helpers =====
const qs = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
const FILTER_STORAGE_KEY = 'pveRankingFilters';
const COUNT_CACHE_KEY = 'pveRankingCounts';

// ★追加：URL連携機能のためのヘルパー
// Base64URLエンコード
function base64url_encode(bytes) {
  const binaryString = String.fromCharCode.apply(null, bytes);
  return btoa(binaryString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
// Base64URLデコード
function base64url_decode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const binaryString = atob(str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
// 状態オブジェクトをURLパラメータ文字列に変換
function stateToUrlParam(state) {
  try {
    const jsonString = JSON.stringify(state);
    const compressed = pako.deflate(jsonString);
    return base64url_encode(compressed);
  } catch (e) {
    console.error("Failed to serialize state:", e);
    return '';
  }
}
// URLパラメータ文字列を状態オブジェクトに変換
function urlParamToState(param) {
  try {
    const compressed = base64url_decode(param);
    const jsonString = pako.inflate(compressed, { to: 'string' });
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to deserialize state from URL:", e);
    return null;
  }
}
// ★ここまで追加

// ★追加：サーバー名を短縮する関数
function abbreviateServer(serverName) {
  if (!serverName) return '';
  const initial = serverName.charAt(0);
  const number = serverName.slice(1);
  return (initial === 'K' ? initial.toLowerCase() : initial) + number;
}

// ===== Global State =====
const table = qs('#rankTable');
const tbody = table.tBodies[0];
const summaryEl = qs('#summary');
const rows = [];
let serverMemberCounts, guildMemberCountsByServer;
let guildTotalMemberCounts = {};
let isHandlingPopState = false; // ★追加: popstate処理中のフラグ

// ===== Data Initialization and Pre-computation =====
originalData.forEach(item => {
  const tr = document.createElement('tr');
  const shortServerName = abbreviateServer(item.server);
  tr.innerHTML = `<td>${item.rank}</td><td>${item.name}</td><td>${item.guild}</td><td class="server-name"><span class="full">${item.server}</span><span class="short">${shortServerName}</span></td>`;
  rows.push({ ...item, tr });
});

const cachedCounts = localStorage.getItem(COUNT_CACHE_KEY);
if (cachedCounts) {
  const parsed = JSON.parse(cachedCounts);
  serverMemberCounts = parsed.serverCounts;
  guildMemberCountsByServer = parsed.guildCounts;
} else {
  serverMemberCounts = {};
  guildMemberCountsByServer = {};
  originalData.forEach(p => {
    serverMemberCounts[p.server] = (serverMemberCounts[p.server] || 0) + 1;
    if (!guildMemberCountsByServer[p.guild]) guildMemberCountsByServer[p.guild] = {};
    guildMemberCountsByServer[p.guild][p.server] = (guildMemberCountsByServer[p.guild][p.server] || 0) + 1;
  });
  localStorage.setItem(COUNT_CACHE_KEY, JSON.stringify({ serverCounts: serverMemberCounts, guildCounts: guildMemberCountsByServer }));
}

for (const guild in guildMemberCountsByServer) {
  guildTotalMemberCounts[guild] = Object.values(guildMemberCountsByServer[guild]).reduce((a, b) => a + b, 0);
}

// ===== Build filter UIs =====
const allGuilds = Array.from(new Set(rows.map(r => r.guild))).sort((a, b) => a.localeCompare(b, 'ja'));
const serverBox = qs('#serverBox');
const guildBox = qs('#guildBox');
const serverInputs = [];
const guildInputs = [];
const guildUI = new Map();
const serverPrefixSpans = new Map();

function updateServerGroupStyles() {
  serverPrefixSpans.forEach((span, prefix) => {
    const groupDiv = span.closest('.server-group');
    if (!groupDiv) return;
    const inputsInGroup = qsa('input[type="checkbox"]', groupDiv);
    const areAllChecked = inputsInGroup.length > 0 && inputsInGroup.every(i => i.checked);
    span.classList.toggle('group-selected', areAllChecked);
  });
}

function handleServerSelectionChange() {
  updateGuildFilterList();
  guildInputs.forEach(i => {
    const wrapper = guildUI.get(i.value)?.wrapper;
    if (wrapper && wrapper.style.display !== 'none') i.checked = true;
  });
  updateAndSortGuildList();
  applyFiltersAndSave();
  updateServerGroupStyles();
}

// --- New Server UI Builder ---
const serverGroups = { Kiki: [], Anica: [], Hugo: [] };
rows.forEach(r => {
  if (r.server.startsWith('Kiki')) serverGroups.Kiki.push(r.server);
  else if (r.server.startsWith('Anica')) serverGroups.Anica.push(r.server);
  else if (r.server.startsWith('Hugo')) serverGroups.Hugo.push(r.server);
});

for (const prefix in serverGroups) {
  const groupDiv = document.createElement('div');
  groupDiv.className = 'server-group';
  const prefixSpan = document.createElement('span');
  prefixSpan.className = 'server-prefix';
  const totalInGroup = [...new Set(serverGroups[prefix])].reduce((acc, srv) => acc + (serverMemberCounts[srv] || 0), 0);
  prefixSpan.textContent = `${prefix}`;
  prefixSpan.title = `所属数: ${totalInGroup}`;
  serverPrefixSpans.set(prefix, prefixSpan);

  prefixSpan.addEventListener('click', () => {
    const inputsInGroup = qsa('input[type="checkbox"]', groupDiv);
    const shouldBeChecked = !inputsInGroup.every(i => i.checked);
    inputsInGroup.forEach(i => i.checked = shouldBeChecked);
    handleServerSelectionChange();
  });

  const channelsDiv = document.createElement('div');
  channelsDiv.className = 'server-channels';
  const channels = [...new Set(serverGroups[prefix])].sort();
  channels.forEach(fullName => {
    const channelNum = fullName.replace(prefix, '');
    const inputId = `cb-${fullName}`;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = inputId;
    cb.value = fullName;
    cb.addEventListener('change', handleServerSelectionChange);
    serverInputs.push(cb);
    const label = document.createElement('label');
    label.setAttribute('for', inputId);
    label.textContent = channelNum;
    label.title = `${fullName} (${serverMemberCounts[fullName] || 0}人)`;
    channelsDiv.append(cb, label);
  });
  groupDiv.append(prefixSpan, channelsDiv);
  serverBox.appendChild(groupDiv);
}

// --- Guild UI Builder ---
allGuilds.forEach(name => {
  const label = document.createElement('label');
  label.className = 'chip-label';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.value = name;
  cb.addEventListener('change', applyFiltersAndSave);
  guildInputs.push(cb);
  const span = document.createElement('span');
  span.textContent = `${name} (0)`;
  label.append(cb, span);
  guildBox.appendChild(label);
  guildUI.set(name, { wrapper: label, input: cb, text: span });
});

// --- Controls and Buttons ---
qs('#guildAll').addEventListener('click', (e) => {
  e.preventDefault();
  guildInputs.forEach(i => {
    const wrapper = guildUI.get(i.value)?.wrapper;
    if (wrapper && wrapper.style.display !== 'none') i.checked = true;
  });
  applyFiltersAndSave();
});
qs('#guildNone').addEventListener('click', (e) => {
  e.preventDefault();
  guildInputs.forEach(i => i.checked = false);
  applyFiltersAndSave();
});
qs('#clearCacheBtn').addEventListener('click', () => {
  localStorage.removeItem(FILTER_STORAGE_KEY);
  localStorage.removeItem(COUNT_CACHE_KEY);
  history.replaceState(null, '', window.location.pathname);
  alert('キャッシュとURLをクリアしました。ページをリロードします。');
  location.reload();
});


// ===== Filter State Management (URL and LocalStorage) =====
function saveFilters() {
  const state = {
    selectedServers: serverInputs.filter(i => i.checked).map(i => i.value),
    selectedGuilds: guildInputs.filter(i => i.checked).map(i => i.value),
  };
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));

  // ★変更: popstate処理中はURLを更新しない
  if (isHandlingPopState) return;

  const urlParam = stateToUrlParam(state);
  const newUrl = urlParam ? `${window.location.pathname}?filter=${urlParam}` : window.location.pathname;
  if (window.location.href !== newUrl) {
    history.pushState(state, '', newUrl);
  }
}

function loadFilters() {
  const params = new URLSearchParams(window.location.search);
  const filterParam = params.get('filter');

  let settings;
  // ★変更: URLパラメータを優先
  if (filterParam) {
    settings = urlParamToState(filterParam);
  } else {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) {
      try {
        settings = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load filters from localStorage", e);
      }
    }
  }

  if (settings) {
    if (settings.selectedServers) {
      const serverSet = new Set(settings.selectedServers);
      serverInputs.forEach(i => i.checked = serverSet.has(i.value));
    }
    if (settings.selectedGuilds) {
      const guildSet = new Set(settings.selectedGuilds);
      guildInputs.forEach(i => i.checked = guildSet.has(i.value));
    }
  }
}

// ★追加: ブラウザの戻る・進むボタンの対応
window.addEventListener('popstate', (event) => {
  isHandlingPopState = true;
  loadFilters();
  refreshAllUI();
  isHandlingPopState = false;
});

// ===== Dynamic UI Updates =====
function updateGuildFilterList() {
  const selServers = new Set(serverInputs.filter(i => i.checked).map(i => i.value));
  if (selServers.size === 0) {
    guildUI.forEach(ui => {
      ui.wrapper.style.display = '';
    });
    return;
  }
  const availableGuilds = new Set();
  rows.forEach(r => {
    if (selServers.has(r.server)) availableGuilds.add(r.guild);
  });
  guildUI.forEach((ui, guildName) => {
    const isAvailable = availableGuilds.has(guildName);
    ui.wrapper.style.display = isAvailable ? '' : 'none';
    if (!isAvailable) {
      ui.input.checked = false;
    }
  });
}

function updateAndSortGuildList() {
  const selServers = new Set(serverInputs.filter(i => i.checked).map(i => i.value));
  const currentGuildCounts = {};
  const noServerSelected = selServers.size === 0;

  allGuilds.forEach(guildName => {
    let count = 0;
    if (noServerSelected) {
      count = guildTotalMemberCounts[guildName] || 0;
    } else {
      const guildData = guildMemberCountsByServer[guildName];
      if (guildData) {
        selServers.forEach(serverName => {
          if (guildData[serverName]) count += guildData[serverName];
        });
      }
    }
    currentGuildCounts[guildName] = count;
    const ui = guildUI.get(guildName);
    if (ui) ui.text.textContent = `${guildName} (${count})`;
  });

  const entries = Array.from(guildUI.values()).map(ui => ({
    name: ui.input.value,
    count: currentGuildCounts[ui.input.value] ?? 0,
    ui: ui
  }));
  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name, 'ja');
  });

  const frag = document.createDocumentFragment();
  for (const e of entries) frag.appendChild(e.ui.wrapper);
  guildBox.appendChild(frag);
}

// ===== Core filtering & Table Sorting =====
function updateSummary() {
  const selServers = serverInputs.filter(i => i.checked).map(i => i.value);
  const selGuilds = guildInputs.filter(i => i.checked).map(i => i.value);
  const visibleRowCount = rows.filter(r => !r.tr.classList.contains('hide')).length;

  summaryEl.style.display = 'block';

  const conditions = [];
  if (selServers.length > 0) {
    conditions.push(`サーバー「${selServers.join('、')}」`);
  }
  if (selGuilds.length > 0) {
    if (selGuilds.length <= 2) {
      conditions.push(`ギルド「${selGuilds.join('、')}」`);
    } else {
      conditions.push(`${selGuilds.length}つのギルド`);
    }
  }
  if (conditions.length > 0) {
    summaryEl.textContent = `絞り込み結果: ${conditions.join('、')}で${visibleRowCount}人が該当しました。`;
  } else {
    summaryEl.textContent = `全${originalData.length}人中${visibleRowCount}人が該当しました。`;
  }
}

function applyFilters() {
  const selServers = new Set(serverInputs.filter(i => i.checked).map(i => i.value));
  const selGuilds = new Set(guildInputs.filter(i => i.checked).map(i => i.value));
  const noServerSelected = selServers.size === 0;
  const noGuildSelected = selGuilds.size === 0;

  qs('#rankTable').classList.toggle('hide-server-col', selServers.size === 1);

  rows.forEach(r => {
    const serverMatch = noServerSelected || selServers.has(r.server);
    const guildMatch = noGuildSelected || selGuilds.has(r.guild);
    r.tr.classList.toggle('hide', !(serverMatch && guildMatch));
  });

  updateSummary();
}

// ★変更：フィルター適用と状態保存をまとめた関数
function applyFiltersAndSave() {
    applyFilters();
    saveFilters();
}

let currentSort = { column: 'rank', direction: 'asc' };

function sortRows() {
  const { column, direction } = currentSort;
  const modifier = direction === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const valA = a[column];
    const valB = b[column];
    if (column === 'rank') return (valA - valB) * modifier;
    else return valA.localeCompare(valB, 'ja') * modifier;
  });
  const frag = document.createDocumentFragment();
  rows.forEach(r => frag.appendChild(r.tr));
  tbody.appendChild(frag);
  updateSortIndicators();
}

function updateSortIndicators() {
  qsa('thead th.sortable').forEach(th => {
    const indicator = th.querySelector('.sort-indicator');
    if (th.dataset.column === currentSort.column) {
      th.classList.add('sorted');
      indicator.textContent = currentSort.direction === 'asc' ? '▲' : '▼';
    } else {
      th.classList.remove('sorted');
      indicator.textContent = '';
    }
  });
}

qsa('thead th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const column = th.dataset.column;
    currentSort.direction = (currentSort.column === column && currentSort.direction === 'asc') ? 'desc' : 'asc';
    currentSort.column = column;
    sortRows();
  });
});

// ★追加: UI全体を更新する関数
function refreshAllUI() {
    updateGuildFilterList();
    updateAndSortGuildList();
    applyFilters();
    updateServerGroupStyles();
    // ソートは状態として保存していないので、UI更新時には実行しない
    // sortRows();
}


// ===== App Initialization =====
function initialize() {
  loadFilters();
  refreshAllUI(); // ★変更: UI更新をまとめた関数を呼び出す
  sortRows(); // 初期ソートを実行
}

initialize();