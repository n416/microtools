import * as api from '../api.js';
import * as state from '../state.js';
import * as router from '../router.js';
import * as ui from '../ui.js';

const elements = {
  eventEditView: document.getElementById('eventEditView'),
  backToGroupsButton: document.getElementById('backToGroupsButton'),
  eventNameInput: document.getElementById('eventNameInput'),
  bulkAddPrizesButton: document.getElementById('bulkAddPrizesButton'),
  prizeCardListContainer: document.getElementById('prizeCardListContainer'),
  prizeListModeContainer: document.getElementById('prizeListModeContainer'),
  createEventButton: document.getElementById('createEventButton'),
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
};

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

  // 参加者画面と同じHTML構造（ulのみ）でプレビューを生成
  elements.prizeDisplayPreview.innerHTML = `<ul>${previewItemsHTML}</ul>`;
}

export function renderEventForEditing(data) {
  elements.eventNameInput.value = data.eventName || '';
  state.setPrizes(data.prizes || []);

  if (elements.displayPrizeName) {
    elements.displayPrizeName.checked = data.hasOwnProperty('displayPrizeName') ? data.displayPrizeName : true;
  }
  if (elements.displayPrizeCount) {
    elements.displayPrizeCount.checked = data.hasOwnProperty('displayPrizeCount') ? data.displayPrizeCount : true;
  }
  // ▼▼▼ ここから修正 ▼▼▼
  if (elements.allowDoodleModeCheckbox) {
    elements.allowDoodleModeCheckbox.checked = data.allowDoodleMode || false;
  }
  // ▲▲▲ ここまで修正 ▲▲▲

  elements.createEventButton.textContent = 'この内容でイベントを保存';

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

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          imgPreview.src = event.target.result;
          imgPreview.classList.remove('placeholder');
        };
        reader.readAsDataURL(file);
        state.prizes[index].newImageFile = file;
        state.prizes[index].imageUrl = null;
      }
    });
    imageContainer.appendChild(fileInput);
    li.appendChild(imageContainer);

    const infoContainer = document.createElement('div');
    infoContainer.className = 'prize-card-info';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = prizeName;
    nameInput.className = 'prize-card-name-input';
    nameInput.dataset.index = index;
    nameInput.addEventListener('change', (event) => {
      const updatedIndex = parseInt(event.target.dataset.index, 10);
      const newName = event.target.value.trim();
      if (newName) {
        state.prizes[updatedIndex].name = newName;
      } else {
        event.target.value = prizeName;
      }
      updatePrizePreview();
    });
    infoContainer.appendChild(nameInput);

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

    tableHTML += `
      <tr>
        <td>
          <label for="${uniqueId}" class="prize-image-label">${imageContent}</label>
          <input type="file" id="${uniqueId}" data-name="${item.name}" class="prize-image-input-list" accept="image/*" style="display: none;">
        </td>
        <td><input type="text" class="prize-name-input-list" value="${item.name}" data-original-name="${item.name}"></td>
        <td><input type="text" inputmode="numeric" pattern="[0-9]*" class="prize-quantity-input" value="${item.quantity}" data-name="${item.name}"></td>
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

export function initEventEdit() {
  if (elements.eventEditView) {
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
    };

    if (viewModeCardBtn && viewModeListBtn) {
      viewModeCardBtn.addEventListener('click', () => switchViewMode('card'));
      viewModeListBtn.addEventListener('click', () => switchViewMode('list'));
    }
    if (prizeListContainer) {
      // [キーボード操作] 上下キー操作時に、変更前のカーソル位置を要素に一時保存する
      prizeListContainer.addEventListener('keydown', (e) => {
        const targetInput = e.target;
        if (targetInput.classList.contains('prize-quantity-input') || targetInput.classList.contains('prize-name-input-list')) {
          // カスタムプロパティとして現在のカーソル位置を保存
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

      // [メイン処理] 値の変更を検知して再描画とフォーカス復元を行う
      prizeListContainer.addEventListener('change', (e) => {
        const changedElement = e.target;
        const isQuantityInput = changedElement.classList.contains('prize-quantity-input');
        const isNameInput = changedElement.classList.contains('prize-name-input-list');

        let focusedInputInfo = null;
        if (isQuantityInput || isNameInput) {
          focusedInputInfo = {
            name: changedElement.dataset.name || changedElement.dataset.originalName,
            className: changedElement.className,
            // keydownイベントで保存したカスタムプロパティがあればそれを優先し、なければ現在の位置を使う
            selectionStart: typeof changedElement._selectionStart === 'number' ? changedElement._selectionStart : changedElement.selectionStart,
            selectionEnd: typeof changedElement._selectionEnd === 'number' ? changedElement._selectionEnd : changedElement.selectionEnd,
          };
          // 一時プロパティを削除
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

          const prizeMaster = currentPrizes[0] || {name, imageUrl: null};

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
      elements.prizeCardListContainer.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('delete-btn')) {
          const index = parseInt(target.dataset.index, 10);
          state.prizes.splice(index, 1);
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
        renderPrizeCardList();
        renderPrizeListMode();
        closePrizeBulkAddModal();
      });
    }

    if (elements.createEventButton) {
      elements.createEventButton.addEventListener('click', async () => {
        const isUpdate = !!state.currentEventId;
        const participantCount = state.prizes.length;
        if (participantCount < 2) return alert('景品は2つ以上設定してください。');

        elements.createEventButton.disabled = true;
        let originalButtonText = elements.createEventButton.textContent;

        try {
          let eventId = state.currentEventId;
          const displayPrizeName = document.getElementById('displayPrizeName').checked;
          const displayPrizeCount = document.getElementById('displayPrizeCount').checked;
          // ▼▼▼ ここから修正 ▼▼▼
          const allowDoodleMode = document.getElementById('allowDoodleModeCheckbox').checked;
          // ▲▲▲ ここまで修正 ▲▲▲

          if (!isUpdate) {
            elements.createEventButton.textContent = 'イベント作成中...';
            const initialEventData = {
              eventName: elements.eventNameInput.value.trim(),
              prizes: state.prizes.map((p) => ({name: p.name, imageUrl: p.imageUrl || null})),
              groupId: state.currentGroupId,
              displayPrizeName,
              displayPrizeCount,
              allowDoodleMode,
            };
            // ▼▼▼ ここから修正 ▼▼▼
            console.log('API Request Payload (Create):', initialEventData);
            // ▲▲▲ ここまで修正 ▲▲▲
            const newEvent = await api.createEvent(initialEventData);
            eventId = newEvent.id;
            state.setCurrentEventId(eventId);
          }

          elements.createEventButton.textContent = '画像を準備中...';
          const uniqueFilesToUpload = [];
          const fileHashes = {};

          for (const prize of state.prizes) {
            if (prize.newImageFile && !Object.values(fileHashes).includes(prize.newImageFile.name)) {
              const buffer = await prize.newImageFile.arrayBuffer();
              const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
              if (!uniqueFilesToUpload.some((f) => f.hash === hashHex)) {
                uniqueFilesToUpload.push({file: prize.newImageFile, hash: hashHex});
              }
              fileHashes[prize.newImageFile.name] = hashHex;
            }
          }

          elements.createEventButton.textContent = '画像をアップロード中...';
          const uploadedImageUrls = {};

          for (const {file, hash} of uniqueFilesToUpload) {
            const {signedUrl, imageUrl} = await api.generateEventPrizeUploadUrl(eventId, file.type, hash);
            await fetch(signedUrl, {
              method: 'PUT',
              headers: {'Content-Type': file.type},
              body: file,
            });
            uploadedImageUrls[hash] = imageUrl;
          }

          const finalPrizes = state.prizes.map((prize) => {
            if (prize.newImageFile) {
              const hash = fileHashes[prize.newImageFile.name];
              return {name: prize.name, imageUrl: uploadedImageUrls[hash]};
            }
            return {name: prize.name, imageUrl: prize.imageUrl};
          });

          elements.createEventButton.textContent = '最終保存中...';
          const finalEventData = {
            eventName: elements.eventNameInput.value.trim(),
            prizes: finalPrizes,
            participantCount: finalPrizes.length,
            displayPrizeName,
            displayPrizeCount,
            allowDoodleMode,
          };

          // ▼▼▼ ここから修正 ▼▼▼
          if (isUpdate) {
            console.log('API Request Payload (Update):', finalEventData);
          }
          // ▲▲▲ ここまで修正 ▲▲▲
          await api.updateEvent(eventId, finalEventData);

          alert('イベントを保存しました！');
          await router.navigateTo(`/admin/groups/${state.currentGroupId}`);
        } catch (error) {
          alert(error.error || 'イベントの保存に失敗しました。');
          elements.createEventButton.disabled = false;
          elements.createEventButton.textContent = originalButtonText;
        } finally {
          elements.createEventButton.disabled = false;
          elements.createEventButton.textContent = originalButtonText;
        }
      });
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
        const file = elements.newPrizeImageInput.files[0];
        if (!name) return alert('景品名を入力してください。');

        const newPrize = {
          name,
          imageUrl: null,
          newImageFile: file || null,
        };
        if (elements.newPrizeImagePreview.src && !file) {
          if (elements.newPrizeImagePreview.src.startsWith('http')) {
            newPrize.imageUrl = elements.newPrizeImagePreview.src;
          }
        }

        if (!file && !newPrize.imageUrl) {
          const existingPrize = state.prizes.find((p) => p.name === name);
          if (existingPrize) {
            newPrize.imageUrl = existingPrize.imageUrl;
            newPrize.newImageFile = existingPrize.newImageFile;
            newPrize.newImageFileHash = existingPrize.newImageFileHash;
          }
        }
        state.prizes.push(newPrize);
        renderPrizeCardList();
        renderPrizeListMode();
        closeAddPrizeModal();
      });
    }
    if (elements.newPrizeImageInput) {
      elements.newPrizeImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            elements.newPrizeImagePreview.src = event.target.result;
            elements.newPrizeImagePreview.style.display = 'block';
          };
          reader.readAsDataURL(file);
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
  }
}
