import * as api from '../api.js';
import * as state from '../state.js';
import * as router from '../router.js';
import * as ui from '../ui.js';
import {processImage} from '../imageProcessor.js';
import {prepareStepAnimation} from '../animation.js';
import {db} from '../main.js';
import {addFirestoreListener, clearAllFirestoreListeners} from '../state.js';

const elements = {
  eventEditView: document.getElementById('eventEditView'),
  backToGroupsButton: document.getElementById('backToGroupsButton'),
  eventNameInput: document.getElementById('eventNameInput'),
  bulkAddPrizesButton: document.getElementById('bulkAddPrizesButton'),
  prizeCardListContainer: document.getElementById('prizeCardListContainer'),
  prizeListModeContainer: document.getElementById('prizeListModeContainer'),
  createEventButton: document.getElementById('createEventButton'),
  createEventButtonContainer: document.getElementById('createEventButtonContainer'),
  saveStartedEventContainer: document.getElementById('saveStartedEventContainer'),
  saveStartedEventButton: document.getElementById('saveStartedEventButton'),
  openAddPrizeModalButton: document.getElementById('openAddPrizeModalButton'),
  showSummaryButton: document.getElementById('showSummaryButton'),
  addPrizeModal: document.getElementById('addPrizeModal'),
  newPrizeNameInput: document.getElementById('newPrizeNameInput'),
  newPrizeImageInput: document.getElementById('newPrizeImageInput'),
  newPrizeImagePreview: document.getElementById('newPrizeImagePreview'),
  callMasterButton: document.getElementById('callMasterButton'),
  addPrizeOkButton: document.getElementById('addPrizeOkButton'),
  summaryModal: document.getElementById('summaryModal'),
  totalPrizes: document.getElementById('totalPrizes'),
  prizeSummaryList: document.getElementById('prizeSummaryList'),
  prizeBulkAddModal: document.getElementById('prizeBulkAddModal'),
  closePrizeBulkAddModalButton: document.querySelector('#prizeBulkAddModal .close-button'),
  prizeBulkTextarea: document.getElementById('prizeBulkTextarea'),
  updatePrizesFromTextButton: document.getElementById('updatePrizesFromTextButton'),
  clearBulkPrizesButton: document.getElementById('clearBulkPrizesButton'),
  cancelBulkAddButton: document.getElementById('cancelBulkAddButton'),
  displayPrizeName: document.getElementById('displayPrizeName'),
  displayPrizeCount: document.getElementById('displayPrizeCount'),
  allowDoodleModeCheckbox: document.getElementById('allowDoodleModeCheckbox'),
  prizeDisplayPreview: document.getElementById('prizeDisplayPreview'),
  showFillSlotsModalButton: document.getElementById('showFillSlotsModalButton'),
  regenerateLinesButton: document.getElementById('regenerateLinesButton'),
  shufflePrizesBroadcastButton: document.getElementById('shufflePrizesBroadcastButton'),
  eventEditPreviewCanvas: document.getElementById('eventEditPreviewCanvas'),
  goToBroadcastViewButton: document.getElementById('goToBroadcastViewButton'),
  fillSlotsModal: document.getElementById('fillSlotsModal'),
  unjoinedMemberList: document.getElementById('unjoinedMemberList'),
  emptySlotCount: document.getElementById('emptySlotCount'),
  selectMembersButton: document.getElementById('selectMembersButton'),
  selectedMemberList: document.getElementById('selectedMemberList'),
  confirmFillSlotsButton: document.getElementById('confirmFillSlotsButton'),
  finalPrepSection: document.getElementById('finalPrepSection'),
  finalPrepOverlay: document.querySelector('.final-prep-overlay'),
  saveForPreviewButton: document.getElementById('saveForPreviewButton'),
  viewModeSwitcher: document.querySelector('.view-mode-switcher'),
};

let processedNewPrizeFile = null;
let selectedAssignments = [];
let isDirty = false;

function setDirty(dirty) {
  if (!state.currentEventId) return; // Don't set dirty for new events

  isDirty = dirty;
  if (elements.finalPrepOverlay) {
    elements.finalPrepOverlay.style.display = dirty ? 'flex' : 'none';
  }

  if (dirty) {
    clearAllFirestoreListeners();
  }
}

async function handleSaveEvent(eventId, buttonToAnimate, isStartedEvent = false) {
  buttonToAnimate.disabled = true;
  buttonToAnimate.textContent = '保存中...';

  try {
    const fileUploadPromises = state.prizes.map(async (prize) => {
      if (prize.newImageFile) {
        const buffer = await prize.newImageFile.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return {file: prize.newImageFile, hash: hashHex};
      }
      return null;
    });
    const resolvedFileUploads = (await Promise.all(fileUploadPromises)).filter(Boolean);
    const uniqueFilesToUpload = [...new Map(resolvedFileUploads.map((item) => [item.hash, item])).values()];

    const uploadedImageUrls = {};
    for (const {file, hash} of uniqueFilesToUpload) {
      const {signedUrl, imageUrl} = await api.generateEventPrizeUploadUrl(eventId, file.type, hash);
      await fetch(signedUrl, {method: 'PUT', headers: {'Content-Type': file.type}, body: file});
      uploadedImageUrls[hash] = imageUrl;
    }

    const finalPrizes = await Promise.all(
      state.prizes.map(async (prize) => {
        if (prize.newImageFile) {
          const buffer = await prize.newImageFile.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
          return {name: prize.name, imageUrl: uploadedImageUrls[hashHex], rank: prize.rank || 'uncommon'};
        }
        return {name: prize.name, imageUrl: prize.imageUrl, rank: prize.rank || 'uncommon'};
      })
    );

    const finalEventData = {
      eventName: elements.eventNameInput.value.trim(),
      prizes: finalPrizes,
      participantCount: finalPrizes.length,
      displayPrizeName: document.getElementById('displayPrizeName').checked,
      displayPrizeCount: document.getElementById('displayPrizeCount').checked,
      allowDoodleMode: document.getElementById('allowDoodleModeCheckbox').checked,
    };

    await api.updateEvent(eventId, finalEventData);
    alert('イベントを保存しました！');

    const updatedData = await api.getEvent(eventId);
    state.setCurrentLotteryData(updatedData);
    state.setPrizes(updatedData.prizes || []);
    await drawPreviewCanvas();
    setDirty(false); // Reset dirty flag after successful save
    attachRealtimeDoodleListener(); // Re-attach listener after save
  } catch (error) {
    alert(error.error || 'イベントの保存に失敗しました。');
  } finally {
    buttonToAnimate.disabled = false;
    buttonToAnimate.textContent = isStartedEvent ? 'イベント名を保存する' : '変更を保存してプレビューを更新';
  }
}

function updatePrizePreview() {
  if (!elements.prizeDisplayPreview) return;
  const displayPrizeName = elements.displayPrizeName.checked;
  const displayPrizeCount = elements.displayPrizeCount.checked;
  const prizeSummary = state.prizes.reduce((acc, prize) => {
    const name = prize.name || '（名称未設定）';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  let previewItemsHTML = '';
  if (state.prizes.length === 0) {
    previewItemsHTML = '<li>景品を登録してください</li>';
  } else {
    if (displayPrizeName && displayPrizeCount) {
      previewItemsHTML = Object.entries(prizeSummary)
        .map(([name, count]) => `<li>${name}: ${count}個</li>`)
        .join('');
    } else if (!displayPrizeName && displayPrizeCount) {
      previewItemsHTML = Object.entries(prizeSummary)
        .map(([name, count]) => `<li>？？？: ${count}個</li>`)
        .join('');
    } else if (displayPrizeName && !displayPrizeCount) {
      previewItemsHTML = Object.keys(prizeSummary)
        .map((name) => `<li>${name}</li>`)
        .join('');
    } else {
      const totalCount = state.prizes.length;
      previewItemsHTML = `<li>合計景品数: ${totalCount}個</li>`;
    }
  }
  elements.prizeDisplayPreview.innerHTML = `<ul>${previewItemsHTML}</ul>`;
}

async function drawPreviewCanvas() {
  if (elements.eventEditPreviewCanvas && state.currentLotteryData) {
    const ctx = elements.eventEditPreviewCanvas.getContext('2d');
    await prepareStepAnimation(ctx, true, false, true);
  }
}

export async function renderEventForEditing(data) {
  const isStarted = data.status === 'started';
  elements.eventNameInput.value = data.eventName || '';
  state.setPrizes(data.prizes || []);

  elements.createEventButtonContainer.style.display = 'none';
  elements.saveStartedEventContainer.style.display = 'none';
  elements.finalPrepSection.style.display = 'none';
  elements.createEventButtonContainer.style.opacity = '1';

  if (state.currentEventId) {
    elements.finalPrepSection.style.display = 'block';
    await drawPreviewCanvas();
    setDirty(false);
    attachRealtimeDoodleListener();
  } else {
    elements.createEventButtonContainer.style.display = 'block';
  }

  if (isStarted) {
    elements.saveStartedEventContainer.style.display = 'block';
    const inputs = elements.eventEditView.querySelectorAll('input, button, textarea, select');
    inputs.forEach((input) => {
      const allowedIds = ['eventNameInput', 'saveStartedEventButton', 'backToGroupsButton'];
      if (!allowedIds.includes(input.id)) {
        input.disabled = true;
      }
    });
  } else {
    const inputs = elements.eventEditView.querySelectorAll('input, button, textarea, select');
    inputs.forEach((input) => {
      input.disabled = false;
    });
  }

  if (elements.displayPrizeName) {
    elements.displayPrizeName.checked = data.hasOwnProperty('displayPrizeName') ? data.displayPrizeName : true;
  }
  if (elements.displayPrizeCount) {
    elements.displayPrizeCount.checked = data.hasOwnProperty('displayPrizeCount') ? data.displayPrizeCount : true;
  }
  if (elements.allowDoodleModeCheckbox) {
    elements.allowDoodleModeCheckbox.checked = data.allowDoodleMode || false;
  }

  if (elements.goToBroadcastViewButton) {
    elements.goToBroadcastViewButton.href = `/admin/event/${state.currentEventId}/broadcast`;
    elements.goToBroadcastViewButton.style.display = state.currentEventId ? 'inline-flex' : 'none';
  }
  const savedMode = localStorage.getItem('prizeViewMode') || 'card';
  const prizeCardContainer = document.getElementById('prizeCardListContainer');
  const prizeListContainer = document.getElementById('prizeListModeContainer');
  const viewModeCardBtn = document.getElementById('viewModeCard');
  const viewModeListBtn = document.getElementById('viewModeList');
  if (savedMode === 'list') {
    viewModeListBtn.classList.add('active');
    viewModeCardBtn.classList.remove('active');
    prizeListContainer.style.display = 'block';
    prizeCardContainer.style.display = 'none';
    renderPrizeListMode();
  } else {
    viewModeCardBtn.classList.add('active');
    viewModeListBtn.classList.remove('active');
    prizeCardContainer.style.display = 'grid';
    prizeListContainer.style.display = 'none';
    renderPrizeCardList();
  }
  if (elements.viewModeSwitcher) {
    elements.viewModeSwitcher.dataset.activeMode = savedMode;
  }

  updatePrizePreview();
}

export function renderPrizeCardList() {
  if (!elements.prizeCardListContainer) return;
  elements.prizeCardListContainer.innerHTML = '';
  state.prizes.forEach((p, index) => {
    const li = document.createElement('li');
    li.className = 'prize-card';
    const prizeName = typeof p === 'object' ? p.name : p;
    const prizeImageUrl = typeof p === 'object' ? p.imageUrl : null;
    const uniqueId = `prize-image-upload-${index}`;
    const imageContainer = document.createElement('div');
    imageContainer.className = 'prize-card-image';
    const imgPreview = document.createElement('img');
    imgPreview.alt = prizeName;
    if (prizeImageUrl) {
      imgPreview.src = prizeImageUrl;
    } else if (p.newImageFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        imgPreview.src = event.target.result;
      };
      reader.readAsDataURL(p.newImageFile);
    } else {
      imgPreview.classList.add('placeholder');
      imgPreview.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }
    imageContainer.appendChild(imgPreview);
    imageContainer.onclick = () => document.getElementById(uniqueId).click();
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.id = uniqueId;
    fileInput.style.display = 'none';
    fileInput.dataset.index = index;
    imageContainer.appendChild(fileInput);
    li.appendChild(imageContainer);
    const infoContainer = document.createElement('div');
    infoContainer.className = 'prize-card-info';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = prizeName;
    nameInput.className = 'prize-card-name-input';
    nameInput.dataset.index = index;
    nameInput.addEventListener('input', (event) => {
      const updatedIndex = parseInt(event.target.dataset.index, 10);
      const newName = event.target.value.trim();
      state.prizes[updatedIndex].name = newName;
      if (state.currentEventId) setDirty(true);
      updatePrizePreview();
    });
    infoContainer.appendChild(nameInput);

    const rankSelector = document.createElement('div');
    rankSelector.className = 'prize-rank-selector';
    rankSelector.dataset.index = index;
    const ranks = ['miss', 'uncommon', 'common', 'rare', 'epic'];
    ranks.forEach((rank, i) => {
      const star = document.createElement('i');
      star.setAttribute('data-lucide', 'star');
      star.className = 'lucide-star';
      star.dataset.value = rank;
      if (ranks.indexOf(p.rank || 'uncommon') >= i) {
        star.classList.add('filled');
      }
      rankSelector.appendChild(star);
    });
    infoContainer.appendChild(rankSelector);

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'prize-card-actions';
    const duplicateBtn = document.createElement('button');
    duplicateBtn.textContent = '複製';
    duplicateBtn.className = 'duplicate-btn';
    duplicateBtn.dataset.index = index;
    duplicateBtn.type = 'button';
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '削除';
    deleteBtn.className = 'delete-btn';
    deleteBtn.dataset.index = index;
    deleteBtn.type = 'button';
    actionsContainer.appendChild(duplicateBtn);
    actionsContainer.appendChild(deleteBtn);
    infoContainer.appendChild(actionsContainer);
    li.appendChild(infoContainer);
    elements.prizeCardListContainer.appendChild(li);
  });
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  updatePrizePreview();
}

export function renderPrizeListMode(sortConfig = {key: 'name', order: 'asc'}) {
  if (!elements.prizeListModeContainer) return;
  const prizeSummary = state.prizes.reduce((acc, prize) => {
    const key = prize.name || '(名称未設定)';
    if (acc[key]) {
      acc[key].quantity++;
      if (acc[key].imageUrl !== prize.imageUrl || acc[key].newImageFileHash !== prize.newImageFileHash) {
        acc[key].hasMultipleImages = true;
      }
    } else {
      acc[key] = {
        name: key,
        quantity: 1,
        imageUrl: prize.imageUrl,
        newImageFile: prize.newImageFile,
        newImageFileHash: prize.newImageFileHash,
        hasMultipleImages: false,
        rank: prize.rank || 'uncommon',
      };
    }
    return acc;
  }, {});
  let prizeArray = Object.values(prizeSummary);
  prizeArray.sort((a, b) => {
    const valA = a[sortConfig.key];
    const valB = b[sortConfig.key];
    if (valA < valB) return sortConfig.order === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.order === 'asc' ? 1 : -1;
    return 0;
  });
  const nameHeader = `景品名 ${sortConfig.key === 'name' ? (sortConfig.order === 'asc' ? '▲' : '▼') : ''}`;
  const quantityHeader = `数量 ${sortConfig.key === 'quantity' ? (sortConfig.order === 'asc' ? '▲' : '▼') : ''}`;
  let tableHTML = `
    <table class="prize-list-table">
      <thead>
        <tr>
          <th style="width: 80px;">画像</th>
          <th data-sort-key="name" style="cursor: pointer;">${nameHeader}</th>
          <th data-sort-key="quantity" style="cursor: pointer;">${quantityHeader}</th>
          <th>ランク</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
  `;
  prizeArray.forEach((item) => {
    let imageContent = '';
    const uniqueId = `prize-list-image-upload-${item.name.replace(/\s/g, '-')}`;
    if (item.hasMultipleImages) {
      imageContent = `<div class="prize-image-cell multi-image" title="複数の画像が設定されています"><i data-lucide="images"></i></div>`;
    } else if (item.newImageFile) {
      const tempUrl = URL.createObjectURL(item.newImageFile);
      imageContent = `<img src="${tempUrl}" alt="${item.name}" class="prize-image-cell">`;
    } else if (item.imageUrl) {
      imageContent = `<img src="${item.imageUrl}" alt="${item.name}" class="prize-image-cell">`;
    } else {
      imageContent = `<div class="prize-image-cell no-image" title="画像が設定されていません"><i data-lucide="image-off"></i></div>`;
    }

    const ranks = ['miss', 'uncommon', 'common', 'rare', 'epic'];
    const rankSelector = `
      <div class="prize-rank-selector" data-name="${item.name}">
        ${ranks
          .map(
            (rank, i) => `
          <i data-lucide="star" class="lucide-star ${ranks.indexOf(item.rank) >= i ? 'filled' : ''}" data-value="${rank}"></i>
        `
          )
          .join('')}
      </div>
    `;

    tableHTML += `
      <tr>
        <td>
          <label for="${uniqueId}" class="prize-image-label">${imageContent}</label>
          <input type="file" id="${uniqueId}" data-name="${item.name}" class="prize-image-input-list" accept="image/*" style="display: none;">
        </td>
        <td><input type="text" class="prize-name-input-list" value="${item.name}" data-original-name="${item.name}"></td>
        <td><input type="text" inputmode="numeric" pattern="[0-9]*" class="prize-quantity-input" value="${item.quantity}" data-name="${item.name}"></td>
        <td>${rankSelector}</td>
        <td><button class="delete-btn delete-prize-list" data-name="${item.name}">削除</button></td>
      </tr>
    `;
  });
  tableHTML += `</tbody></table>`;
  elements.prizeListModeContainer.innerHTML = tableHTML;
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  updatePrizePreview();
}

export function openAddPrizeModal() {
  if (!elements.addPrizeModal) return;
  elements.newPrizeNameInput.value = '';
  elements.newPrizeImageInput.value = '';
  elements.newPrizeImagePreview.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  elements.newPrizeImagePreview.style.display = 'none';
  processedNewPrizeFile = null;

  const rankSelector = elements.addPrizeModal.querySelector('.prize-rank-selector');
  const defaultRank = 'uncommon';
  rankSelector.dataset.rank = defaultRank;
  const ranks = ['miss', 'uncommon', 'common', 'rare', 'epic'];
  const defaultRankIndex = ranks.indexOf(defaultRank);

  rankSelector.querySelectorAll('.lucide-star').forEach((star, index) => {
    if (index <= defaultRankIndex) {
      star.classList.add('filled');
    } else {
      star.classList.remove('filled');
    }
  });

  elements.addPrizeModal.style.display = 'block';
}

export function closeAddPrizeModal() {
  if (elements.addPrizeModal) elements.addPrizeModal.style.display = 'none';
}

export function openSummaryModal(summary) {
  if (!elements.summaryModal) return;
  elements.totalPrizes.textContent = summary.total;
  elements.prizeSummaryList.innerHTML = '';
  for (const name in summary.breakdown) {
    const li = document.createElement('li');
    li.textContent = `${name}: ${summary.breakdown[name]}個`;
    elements.prizeSummaryList.appendChild(li);
  }
  elements.summaryModal.style.display = 'block';
}

export function closeSummaryModal() {
  if (elements.summaryModal) elements.summaryModal.style.display = 'none';
}

export function openPrizeBulkAddModal() {
  if (elements.prizeBulkAddModal) {
    elements.prizeBulkTextarea.value = state.prizes.map((p) => p.name).join('\n');
    elements.prizeBulkAddModal.style.display = 'block';
  }
}

export function closePrizeBulkAddModal() {
  if (elements.prizeBulkAddModal) elements.prizeBulkAddModal.style.display = 'none';
}

function attachRealtimeDoodleListener() {
  if (state.currentEventId && state.currentLotteryData.allowDoodleMode) {
    const eventRef = db.collection('events').doc(state.currentEventId);
    const unsubscribe = eventRef.onSnapshot(async (doc) => {
      if (!doc.exists) return;
      const updatedData = doc.data();
      if (updatedData && JSON.stringify(state.currentLotteryData.doodles) !== JSON.stringify(updatedData.doodles)) {
        state.currentLotteryData.doodles = updatedData.doodles || [];
        if (elements.eventEditPreviewCanvas && elements.eventEditPreviewCanvas.offsetParent !== null) {
          await drawPreviewCanvas();
        }
      }
    });
    addFirestoreListener(unsubscribe);
  }
}

export function initEventEdit() {
  if (elements.eventEditView) {
    const dirtyCheckListener = () => setDirty(true);
    elements.eventNameInput.addEventListener('input', dirtyCheckListener);
    elements.displayPrizeName.addEventListener('change', dirtyCheckListener);
    elements.displayPrizeCount.addEventListener('change', dirtyCheckListener);
    elements.allowDoodleModeCheckbox.addEventListener('change', dirtyCheckListener);
    if (elements.displayPrizeName) elements.displayPrizeName.addEventListener('change', updatePrizePreview);
    if (elements.displayPrizeCount) elements.displayPrizeCount.addEventListener('change', updatePrizePreview);

    const viewModeCardBtn = document.getElementById('viewModeCard');
    const viewModeListBtn = document.getElementById('viewModeList');
    const prizeCardContainer = document.getElementById('prizeCardListContainer');
    const prizeListContainer = document.getElementById('prizeListModeContainer');
    let sortConfig = {key: 'name', order: 'asc'};

    const switchViewMode = (mode) => {
      if (mode === 'list') {
        viewModeCardBtn.classList.remove('active');
        viewModeListBtn.classList.add('active');
        prizeCardContainer.style.display = 'none';
        prizeListContainer.style.display = 'block';
        renderPrizeListMode(sortConfig);
      } else {
        viewModeListBtn.classList.remove('active');
        viewModeCardBtn.classList.add('active');
        prizeListContainer.style.display = 'none';
        prizeCardContainer.style.display = 'grid';
        renderPrizeCardList();
      }
      localStorage.setItem('prizeViewMode', mode);
      if (elements.viewModeSwitcher) {
        elements.viewModeSwitcher.dataset.activeMode = mode;
      }
    };

    if (viewModeCardBtn && viewModeListBtn) {
      viewModeCardBtn.addEventListener('click', () => switchViewMode('card'));
      viewModeListBtn.addEventListener('click', () => switchViewMode('list'));
    }
    if (prizeListContainer) {
      prizeListContainer.addEventListener('keydown', (e) => {
        const targetInput = e.target;
        if (targetInput.classList.contains('prize-quantity-input') || targetInput.classList.contains('prize-name-input-list')) {
          targetInput._selectionStart = targetInput.selectionStart;
          targetInput._selectionEnd = targetInput.selectionEnd;
        }
        if (targetInput.classList.contains('prize-quantity-input')) {
          let currentValue = parseInt(targetInput.value, 10);
          if (isNaN(currentValue)) currentValue = 0;
          let valueChanged = false;
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            targetInput.value = currentValue + 1;
            valueChanged = true;
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentValue > 0) {
              targetInput.value = currentValue - 1;
              valueChanged = true;
            }
          }
          if (valueChanged) {
            targetInput.dispatchEvent(new Event('change', {bubbles: true}));
          }
        }
      });
      prizeListContainer.addEventListener('change', (e) => {
        const changedElement = e.target;
        const isQuantityInput = changedElement.classList.contains('prize-quantity-input');
        const isNameInput = changedElement.classList.contains('prize-name-input-list');
        let focusedInputInfo = null;
        if (isQuantityInput || isNameInput) {
          focusedInputInfo = {
            name: changedElement.dataset.name || changedElement.dataset.originalName,
            className: changedElement.className,
            selectionStart: typeof changedElement._selectionStart === 'number' ? changedElement._selectionStart : changedElement.selectionStart,
            selectionEnd: typeof changedElement._selectionEnd === 'number' ? changedElement._selectionEnd : changedElement.selectionEnd,
          };
          delete changedElement._selectionStart;
          delete changedElement._selectionEnd;
        }
        if (isQuantityInput) {
          const name = changedElement.dataset.name;
          const newQuantity = parseInt(changedElement.value, 10);
          const currentPrizes = state.prizes.filter((p) => p.name === name);
          const currentQuantity = currentPrizes.length;
          if (isNaN(newQuantity) || newQuantity < 0) {
            changedElement.value = currentQuantity;
            return;
          }
          if (newQuantity === 0) {
            if (!confirm(`景品「${name}」の数量を0にしますか？\nリストからすべての「${name}」が削除されます。よろしいですか？`)) {
              changedElement.value = currentQuantity;
              return;
            }
          }
          const prizeMaster = currentPrizes[0] || {name, imageUrl: null, rank: 'uncommon'};
          if (newQuantity > currentQuantity) {
            const diff = newQuantity - currentQuantity;
            for (let i = 0; i < diff; i++) {
              state.prizes.push({...prizeMaster});
            }
          } else if (newQuantity < currentQuantity) {
            const diff = currentQuantity - newQuantity;
            for (let i = 0; i < diff; i++) {
              const indexToRemove = state.prizes.findIndex((p) => p.name === name);
              if (indexToRemove > -1) {
                state.prizes.splice(indexToRemove, 1);
              }
            }
          }
          if (state.currentEventId) setDirty(true);
        }
        if (isNameInput) {
          const originalName = changedElement.dataset.originalName;
          const newName = changedElement.value.trim();
          if (!newName || newName === originalName) {
            changedElement.value = originalName;
            return;
          }
          if (confirm(`景品「${originalName}」の名称を「${newName}」に一括変更しますか？`)) {
            state.prizes.forEach((p) => {
              if (p.name === originalName) {
                p.name = newName;
              }
            });
            if (state.currentEventId) setDirty(true);
          } else {
            changedElement.value = originalName;
          }
        }
        if (changedElement.classList.contains('prize-image-input-list')) {
          const name = changedElement.dataset.name;
          const file = changedElement.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = async () => {
              state.prizes.forEach((p) => {
                if (p.name === name) {
                  p.newImageFile = file;
                  p.imageUrl = null;
                }
              });
              if (state.currentEventId) setDirty(true);
              renderPrizeCardList();
              renderPrizeListMode(sortConfig);
            };
            reader.readAsArrayBuffer(file);
          }
        }
        renderPrizeCardList();
        renderPrizeListMode(sortConfig);
        if (focusedInputInfo) {
          const nameAttribute = focusedInputInfo.className.includes('prize-name-input-list') ? 'data-original-name' : 'data-name';
          const selector = `input.${focusedInputInfo.className.split(' ').join('.')}[${nameAttribute}="${focusedInputInfo.name}"]`;
          const newFocusedElement = prizeListContainer.querySelector(selector);
          if (newFocusedElement) {
            newFocusedElement.focus();
            if (newFocusedElement.type === 'text') {
              setTimeout(() => {
                newFocusedElement.setSelectionRange(focusedInputInfo.selectionStart, focusedInputInfo.selectionEnd);
              }, 0);
            }
          }
        }
      });
      prizeListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-prize-list')) {
          const name = e.target.dataset.name;
          if (confirm(`景品「${name}」をすべて削除しますか？`)) {
            state.setPrizes(state.prizes.filter((p) => p.name !== name));
            if (state.currentEventId) setDirty(true);
            renderPrizeCardList();
            renderPrizeListMode(sortConfig);
          }
        }
        if (e.target.tagName === 'TH' && e.target.dataset.sortKey) {
          const newKey = e.target.dataset.sortKey;
          if (sortConfig.key === newKey) {
            sortConfig.order = sortConfig.order === 'asc' ? 'desc' : 'asc';
          } else {
            sortConfig.key = newKey;
            sortConfig.order = 'asc';
          }
          renderPrizeListMode(sortConfig);
        }
        const star = e.target.closest('.lucide-star');
        if (star) {
          const rank = star.dataset.value;
          const name = star.parentElement.dataset.name;
          state.prizes.forEach((p) => {
            if (p.name === name) {
              p.rank = rank;
            }
          });
          setDirty(true);
          renderPrizeListMode(sortConfig);
        }
      });
    }
    if (elements.backToGroupsButton) {
      elements.backToGroupsButton.addEventListener('click', async () => {
        if (state.currentGroupId) {
          await router.navigateTo(`/admin/groups/${state.currentGroupId}`);
        } else {
          await router.navigateTo('/');
        }
      });
    }
    if (elements.prizeCardListContainer) {
      elements.prizeCardListContainer.addEventListener('change', async (e) => {
        if (e.target.type === 'file') {
          const index = parseInt(e.target.dataset.index, 10);
          const file = e.target.files[0];
          if (file) {
            const prizeCard = e.target.closest('.prize-card');
            const imgPreview = prizeCard.querySelector('img');
            const fileInput = e.target;

            fileInput.disabled = true;
            const processedFile = await processImage(file);
            fileInput.disabled = false;

            if (processedFile) {
              const reader = new FileReader();
              reader.onload = (event) => {
                imgPreview.src = event.target.result;
                imgPreview.classList.remove('placeholder');
              };
              reader.readAsDataURL(processedFile);
              state.prizes[index].newImageFile = processedFile;
              state.prizes[index].imageUrl = null;
              if (state.currentEventId) setDirty(true);
            }
            e.target.value = '';
          }
        }
      });
      elements.prizeCardListContainer.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('delete-btn')) {
          const index = parseInt(target.dataset.index, 10);
          state.prizes.splice(index, 1);
          if (state.currentEventId) setDirty(true);
          renderPrizeCardList();
        }
        if (target.classList.contains('duplicate-btn')) {
          event.preventDefault();
          const sourceIndex = parseInt(target.dataset.index, 10);
          const prizeToDuplicate = JSON.parse(JSON.stringify(state.prizes[sourceIndex]));
          if (state.prizes[sourceIndex].newImageFile) {
            prizeToDuplicate.newImageFile = state.prizes[sourceIndex].newImageFile;
          }
          state.prizes.splice(sourceIndex + 1, 0, prizeToDuplicate);
          if (state.currentEventId) setDirty(true);
          renderPrizeCardList();
        }
        const star = event.target.closest('.lucide-star');
        if (star) {
          const rank = star.dataset.value;
          const index = parseInt(star.parentElement.dataset.index, 10);
          state.prizes[index].rank = rank;
          setDirty(true);
          renderPrizeCardList();
        }
      });
    }
    const shufflePrizesButton = document.getElementById('shufflePrizesButton');
    if (shufflePrizesButton) {
      shufflePrizesButton.addEventListener('click', () => {
        const prizes = state.prizes;
        for (let i = prizes.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [prizes[i], prizes[j]] = [prizes[j], prizes[i]];
        }
        if (state.currentEventId) setDirty(true);
        renderPrizeCardList();
        renderPrizeListMode(sortConfig);
      });
    }
    if (elements.bulkAddPrizesButton) {
      elements.bulkAddPrizesButton.addEventListener('click', () => {
        openPrizeBulkAddModal();
      });
    }
    if (elements.clearBulkPrizesButton) {
      elements.clearBulkPrizesButton.addEventListener('click', () => {
        elements.prizeBulkTextarea.value = '';
      });
    }
    if (elements.updatePrizesFromTextButton) {
      elements.updatePrizesFromTextButton.addEventListener('click', async () => {
        const text = elements.prizeBulkTextarea.value;
        const prizeNames = text
          .split('\n')
          .map((name) => name.trim())
          .filter((name) => name);
        const newPrizes = await ui.buildNewPrizesWithDataPreservation(prizeNames);
        state.setPrizes(newPrizes);
        if (state.currentEventId) setDirty(true);
        renderPrizeCardList();
        renderPrizeListMode();
        closePrizeBulkAddModal();
      });
    }
    if (elements.createEventButton) {
      elements.createEventButton.addEventListener('click', async () => {
        console.log('[DEBUG] Create event button clicked.');
        const participantCount = state.prizes.length;
        if (participantCount < 2) return alert('景品は2つ以上設定してください。');

        elements.createEventButton.disabled = true;
        elements.createEventButton.textContent = 'イベント作成中...';

        try {
          console.log('[DEBUG] Step 1: Creating event without images...');
          const initialEventData = {
            eventName: elements.eventNameInput.value.trim(),
            prizes: state.prizes.map((p) => ({name: p.name, imageUrl: null, rank: p.rank || 'uncommon'})),
            groupId: state.currentGroupId,
            displayPrizeName: document.getElementById('displayPrizeName').checked,
            displayPrizeCount: document.getElementById('displayPrizeCount').checked,
            allowDoodleMode: document.getElementById('allowDoodleModeCheckbox').checked,
          };
          const newEvent = await api.createEvent(initialEventData);
          const eventId = newEvent.id;
          state.setCurrentEventId(eventId);
          console.log(`[DEBUG] Step 1 SUCCESS. Event created with ID: ${eventId}`);

          console.log('[DEBUG] Step 2: Preparing image uploads...');
          const fileUploadPromises = state.prizes.map(async (prize) => {
            if (prize.newImageFile) {
              const buffer = await prize.newImageFile.arrayBuffer();
              const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
              return {file: prize.newImageFile, hash: hashHex};
            }
            return null;
          });

          const resolvedFileUploads = (await Promise.all(fileUploadPromises)).filter(Boolean);
          const uniqueFiles = [...new Map(resolvedFileUploads.map((item) => [item.hash, item])).values()];

          const uploadedImageUrls = {};
          console.log(`[DEBUG] Found ${uniqueFiles.length} unique files to upload.`);

          for (const {file, hash} of uniqueFiles) {
            console.log(`[DEBUG] Uploading file with hash: ${hash}`);
            const {signedUrl, imageUrl} = await api.generateEventPrizeUploadUrl(eventId, file.type, hash);
            await fetch(signedUrl, {method: 'PUT', headers: {'Content-Type': file.type}, body: file});
            uploadedImageUrls[hash] = imageUrl;
            console.log(`[DEBUG] File upload SUCCESS. URL: ${imageUrl}`);
          }

          console.log('[DEBUG] Step 3: Creating final prize list with image URLs...');
          const finalPrizes = await Promise.all(
            state.prizes.map(async (prize) => {
              if (prize.newImageFile) {
                const buffer = await prize.newImageFile.arrayBuffer();
                const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
                return {name: prize.name, imageUrl: uploadedImageUrls[hashHex], rank: prize.rank || 'uncommon'};
              }
              return {name: prize.name, imageUrl: prize.imageUrl, rank: prize.rank || 'uncommon'};
            })
          );
          console.log('[DEBUG] Step 3 SUCCESS. Final prize list:', finalPrizes);

          console.log('[DEBUG] Step 4: Updating event with final data...');
          const finalEventData = {
            eventName: elements.eventNameInput.value.trim(),
            prizes: finalPrizes,
            displayPrizeName: document.getElementById('displayPrizeName').checked,
            displayPrizeCount: document.getElementById('displayPrizeCount').checked,
            allowDoodleMode: document.getElementById('allowDoodleModeCheckbox').checked,
          };
          await api.updateEvent(eventId, finalEventData);
          console.log('[DEBUG] Step 4 SUCCESS. Event updated.');

          // ▼▼▼ ここからログ追加 ▼▼▼
          console.log('[DEBUG] Step 5: Updating UI with new event URL...');
          const parentGroup = state.allUserGroups.find((g) => g.id === state.currentGroupId);
          console.log(`[DEBUG] Parent group found:`, parentGroup);

          const url = parentGroup && parentGroup.customUrl ? `${window.location.origin}/g/${parentGroup.customUrl}/${eventId}` : `${window.location.origin}/events/${eventId}`;
          console.log(`[DEBUG] Generated URL: ${url}`);

          if (ui.elements.currentEventUrl) {
            console.log('[DEBUG] currentEventUrl element FOUND. Updating text and href.');
            ui.elements.currentEventUrl.textContent = url;
            ui.elements.currentEventUrl.href = url;
          } else {
            console.error('[DEBUG] currentEventUrl element NOT FOUND.');
          }
          // ▲▲▲ ここまでログ追加 ▲▲▲

          elements.createEventButtonContainer.style.transition = 'opacity 0.5s';
          elements.createEventButtonContainer.style.opacity = '0';
          setTimeout(async () => {
            elements.createEventButtonContainer.style.display = 'none';
            const eventData = await api.getEvent(eventId);
            state.setCurrentLotteryData(eventData);
            await renderEventForEditing(eventData);
          }, 500);

          history.pushState(null, '', `/admin/event/${eventId}/edit`);
        } catch (error) {
          console.error('[DEBUG] Event creation FAILED.', error);
          alert(error.error || 'イベントの作成に失敗しました。');
        } finally {
          elements.createEventButton.disabled = false;
          elements.createEventButton.textContent = 'この内容でイベントを作成';
        }
      });
    }

    if (elements.saveStartedEventButton) {
      elements.saveStartedEventButton.addEventListener('click', () => handleSaveEvent(state.currentEventId, elements.saveStartedEventButton, true));
    }
    if (elements.saveForPreviewButton) {
      elements.saveForPreviewButton.addEventListener('click', () => handleSaveEvent(state.currentEventId, elements.saveForPreviewButton, false));
    }
    if (elements.openAddPrizeModalButton) {
      elements.openAddPrizeModalButton.addEventListener('click', openAddPrizeModal);
    }
    if (elements.addPrizeModal) {
      elements.addPrizeModal.querySelector('.close-button').addEventListener('click', closeAddPrizeModal);
    }
    if (elements.addPrizeOkButton) {
      elements.addPrizeOkButton.addEventListener('click', () => {
        const name = elements.newPrizeNameInput.value.trim();
        if (!name) return alert('景品名を入力してください。');
        const rank = elements.addPrizeModal.querySelector('.prize-rank-selector').dataset.rank;
        const newPrize = {
          name,
          imageUrl: null,
          newImageFile: processedNewPrizeFile,
          rank: rank,
        };
        state.prizes.push(newPrize);
        if (state.currentEventId) setDirty(true);
        renderPrizeCardList();
        renderPrizeListMode();
        closeAddPrizeModal();
      });
    }
    if (elements.addPrizeModal) {
      elements.addPrizeModal.addEventListener('click', (e) => {
        const star = e.target.closest('.lucide-star');
        if (star) {
          const rankSelector = star.parentElement;
          const newRank = star.dataset.value;
          rankSelector.dataset.rank = newRank;
          const ranks = ['miss', 'uncommon', 'common', 'rare', 'epic'];
          const newRankIndex = ranks.indexOf(newRank);

          rankSelector.querySelectorAll('.lucide-star').forEach((s, i) => {
            if (i <= newRankIndex) {
              s.classList.add('filled');
            } else {
              s.classList.remove('filled');
            }
          });
        }
      });
    }
    if (elements.newPrizeImageInput) {
      elements.newPrizeImageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          const button = document.getElementById('addPrizeOkButton');
          if (button) button.disabled = true;
          processedNewPrizeFile = await processImage(file);
          if (button) button.disabled = false;
          if (processedNewPrizeFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
              elements.newPrizeImagePreview.src = event.target.result;
              elements.newPrizeImagePreview.style.display = 'block';
            };
            reader.readAsDataURL(processedNewPrizeFile);
          } else {
            e.target.value = '';
          }
        }
      });
    }
    if (elements.callMasterButton) {
      elements.callMasterButton.addEventListener('click', async () => {
        try {
          const masters = await api.getPrizeMasters(state.currentGroupId);
          ui.openPrizeMasterSelectModal(masters, {
            onAddSelected: () => {
              const selected = ui.elements.prizeMasterSelectList.querySelector('li.selected');
              if (selected) {
                elements.newPrizeNameInput.value = selected.dataset.name;
                elements.newPrizeImagePreview.src = selected.dataset.imageUrl;
                elements.newPrizeImagePreview.style.display = 'block';
              }
              ui.closePrizeMasterSelectModal();
            },
          });
        } catch (error) {
          alert(error.error);
        }
      });
    }
    if (elements.showSummaryButton) {
      elements.showSummaryButton.addEventListener('click', () => {
        const breakdown = state.prizes.reduce((acc, prize) => {
          const name = prize.name;
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        }, {});
        const summary = {
          total: state.prizes.length,
          breakdown,
        };
        openSummaryModal(summary);
      });
    }
    if (elements.summaryModal) {
      elements.summaryModal.querySelector('.close-button').addEventListener('click', closeSummaryModal);
    }
    if (elements.closePrizeBulkAddModalButton) elements.closePrizeBulkAddModalButton.addEventListener('click', closePrizeBulkAddModal);
    if (elements.cancelBulkAddButton) elements.cancelBulkAddButton.addEventListener('click', closePrizeBulkAddModal);
    if (elements.goToBroadcastViewButton) {
      elements.goToBroadcastViewButton.addEventListener('click', (e) => {
        e.preventDefault();
        router.navigateTo(elements.goToBroadcastViewButton.getAttribute('href'));
      });
    }

    if (elements.regenerateLinesButton) {
      elements.regenerateLinesButton.addEventListener('click', async (e) => {
        const doodlesExist = state.currentLotteryData && state.currentLotteryData.doodles && state.currentLotteryData.doodles.length > 0;
        let deleteDoodles = false;

        if (doodlesExist) {
          const userChoice = await ui.showCustomConfirm('ユーザーによる落書きが追加されています。線を再生成する際に、これらの落書きをどうしますか？', ['落書きもリセットする', '落書きは残す']);
          if (userChoice === '落書きもリセットする') {
            deleteDoodles = true;
          } else if (userChoice === '落書きは残す') {
            deleteDoodles = false;
          } else {
            return;
          }
        } else {
          if (!confirm('あみだくじのパターンを再生成しますか？')) return;
        }

        try {
          const result = await api.regenerateLines(state.currentEventId, deleteDoodles);
          state.currentLotteryData.lines = result.lines;
          state.currentLotteryData.results = result.results;
          if (deleteDoodles) {
            state.currentLotteryData.doodles = [];
          }
          await drawPreviewCanvas();
          alert('あみだくじを再生成しました。');
        } catch (error) {
          alert(`エラー: ${error.error || '再生成に失敗しました。'}`);
        }
      });
    }

    if (elements.shufflePrizesBroadcastButton) {
      elements.shufflePrizesBroadcastButton.addEventListener('click', async (e) => {
        if (!confirm('景品の並び順をランダムに入れ替えますか？\nこの操作はデータベースに保存され、元に戻せません。')) return;

        try {
          const shuffledPrizes = [...state.currentLotteryData.prizes];
          for (let i = shuffledPrizes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledPrizes[i], shuffledPrizes[j]] = [shuffledPrizes[j], shuffledPrizes[i]];
          }

          const result = await api.shufflePrizes(state.currentEventId, shuffledPrizes);

          state.currentLotteryData.prizes = result.prizes;
          state.currentLotteryData.results = result.results;

          state.setPrizes(result.prizes);
          renderPrizeCardList();
          renderPrizeListMode();

          await drawPreviewCanvas();
          alert('景品をシャッフルし、結果を保存しました。');
        } catch (error) {
          alert(`エラー: ${error.error || '景品のシャッフルに失敗しました。'}`);
        }
      });
    }

    if (elements.showFillSlotsModalButton) {
      elements.showFillSlotsModalButton.addEventListener('click', async () => {
        elements.fillSlotsModal.style.display = 'block';
        document.getElementById('fillSlotsStep1').style.display = 'block';
        document.getElementById('fillSlotsStep2').style.display = 'none';
        elements.unjoinedMemberList.innerHTML = '<li>読み込み中...</li>';

        try {
          const unjoinedMembers = await api.getUnjoinedMembers(state.currentGroupId, state.currentEventId);
          const emptySlots = state.currentLotteryData.participants.filter((p) => p.name === null).length;
          elements.emptySlotCount.textContent = emptySlots;

          if (unjoinedMembers.length > 0) {
            elements.unjoinedMemberList.innerHTML = unjoinedMembers.map((m) => `<li class="item-list-item">${m.name}</li>`).join('');
            elements.selectMembersButton.disabled = false;
          } else {
            elements.unjoinedMemberList.innerHTML = '<li>対象メンバーがいません。</li>';
            elements.selectMembersButton.disabled = true;
          }
        } catch (error) {
          elements.unjoinedMemberList.innerHTML = `<li class="error-message">${error.error}</li>`;
        }
      });
    }

    if (elements.fillSlotsModal) {
      elements.fillSlotsModal.querySelector('.close-button').addEventListener('click', () => {
        elements.fillSlotsModal.style.display = 'none';
      });
    }

    if (elements.selectMembersButton) {
      elements.selectMembersButton.addEventListener('click', async () => {
        const unjoinedMembers = await api.getUnjoinedMembers(state.currentGroupId, state.currentEventId);
        const emptySlots = state.currentLotteryData.participants.filter((p) => p.name === null).length;

        if (unjoinedMembers.length < emptySlots) {
          alert('空き枠数に対して、未参加のアクティブメンバーが不足しています。');
          selectedAssignments = [...unjoinedMembers];
        } else {
          const shuffled = unjoinedMembers.sort(() => 0.5 - Math.random());
          selectedAssignments = shuffled.slice(0, emptySlots);
        }

        elements.selectedMemberList.innerHTML = selectedAssignments.map((m) => `<li class="item-list-item">${m.name}</li>`).join('');
        document.getElementById('fillSlotsStep1').style.display = 'none';
        document.getElementById('fillSlotsStep2').style.display = 'block';
      });
    }

    if (elements.confirmFillSlotsButton) {
      elements.confirmFillSlotsButton.addEventListener('click', async () => {
        try {
          const result = await api.fillSlots(
            state.currentEventId,
            selectedAssignments.map((m) => ({id: m.id, name: m.name}))
          );
          elements.fillSlotsModal.style.display = 'none';
          alert('参加枠を更新しました。');
          state.currentLotteryData.participants = result.participants;
          await drawPreviewCanvas();
        } catch (error) {
          alert(`エラー: ${error.error}`);
        }
      });
    }
  }
}
