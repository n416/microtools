// === script.js (db.js を利用する修正版) ===

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements (変更なし) ---
  const pagesContainer = document.getElementById("pages-container");
  const printButton = document.getElementById("print-button");
  const addPageButton = document.getElementById("add-page-button");
  const deletePageButton = document.getElementById("delete-page-button");
  const bulkEditButton = document.getElementById("bulk-edit-button");
  const selectedCountSpan = document.getElementById("selected-count");
  const clearAllButton = document.getElementById('clear-all-button');
  const exportButton = document.getElementById('export-button');
  const importFileInput = document.getElementById('import-file-input');
  const startSimulationButton = document.getElementById('start-simulation-button'); // ボタンIDを修正

  // Individual Edit Modal Elements (変更なし)
  const modal = document.getElementById("edit-modal");
  const modalCardIdSpan = document.getElementById("modal-card-id");
  const modalImageUpload = document.getElementById("modal-image-upload");
  const modalImagePreview = document.getElementById("modal-image-preview");
  const modalDeleteImageButton = document.getElementById("modal-delete-image-button");
  const modalManufacturerSelect = document.getElementById("modal-manufacturer-select");
  const modalValueSelect = document.getElementById("modal-value-select");
  const modalPartSelect = document.getElementById("modal-part-select");
  const modalSaveButton = document.getElementById("modal-save-button");
  const modalCancelButton = document.getElementById("modal-cancel-button");
  const modalCloseButton = modal.querySelector(".close-button");

  // Bulk Edit Modal Elements (変更なし)
  const bulkEditModal = document.getElementById("bulk-edit-modal");
  const bulkEditCountSpan = document.getElementById("bulk-edit-count");
  const bulkManufacturerSelect = document.getElementById("bulk-manufacturer-select");
  const bulkValueSelect = document.getElementById("bulk-value-select");
  const bulkPartSelect = document.getElementById("bulk-part-select");
  const bulkSaveButton = document.getElementById("bulk-save-button");
  const bulkCancelButton = document.getElementById("bulk-cancel-button");
  const bulkCloseButton = bulkEditModal.querySelector(".close-button");

  // --- SVG Icon Definitions (変更なし) ---
  const SVG_ICON_CLASS = "placeholder-icon";
  const SVG_STROKE_COLOR = "#6c757d";
  const SVG_FILL_COLOR = "#e9ecef";
  const SVG_STROKE_WIDTH = "1";
  const SVG_DEFAULT_PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${SVG_STROKE_COLOR}" stroke-width="${SVG_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" class="${SVG_ICON_CLASS}"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
  const SVG_HEAD = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${SVG_STROKE_COLOR}" stroke-width="${SVG_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" class="${SVG_ICON_CLASS}"><path d="M10 4 h4 l1 2 h-6 l1 -2 z" fill="${SVG_FILL_COLOR}"/><path d="M7 5 h10 l1 3 H6 l1 -3 z" fill="${SVG_FILL_COLOR}"/><path d="M6 8 v6 h-2 l-1 0 V9 l1-1 z" fill="${SVG_FILL_COLOR}"/><path d="M17 8 v6 h2 l1 0 V9 l-1 -1 z" fill="${SVG_FILL_COLOR}"/><rect x="7" y="8" width="10" height="8" fill="#ffffff" stroke-width="0.8"/><line x1="7" y1="12" x2="17" y2="12"/><path d="M9 14 h6 v2 H9 z" fill="${SVG_FILL_COLOR}"/><rect x="7.5" y="9" width="4" height="2" fill="${SVG_FILL_COLOR}" stroke-width="0.8"/><rect x="12.5" y="9" width="4" height="2" fill="${SVG_FILL_COLOR}" stroke-width="0.8"/><circle cx="12" cy="6.5" r="0.75" fill="${SVG_FILL_COLOR}" stroke="none"/></svg>`;
  const SVG_UPPER_BODY = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="${SVG_FILL_COLOR}" stroke="${SVG_STROKE_COLOR}" stroke-width="${SVG_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" class="${SVG_ICON_CLASS}"><path d="M5 6 h14 v10 H5 z" stroke-width="1"/> <path d="M5 6 l-3 5 v5 l3 2 z"/> <line x1="3" y1="12" x2="5" y2="15" stroke-width="1"/> <path d="M19 6 l3 5 v5 l-3 2 z"/> <line x1="19" y1="15" x2="21" y2="12" stroke-width="1"/> <path d="M8 8 L5 8 M16 8 L19 8" stroke-width="1"/> <path d="M8 10 L5 10 M16 10 L19 10" stroke-width="1"/> </svg>`;
  const SVG_LOWER_BODY = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="${SVG_FILL_COLOR}" stroke="${SVG_STROKE_COLOR}" stroke-width="${SVG_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" class="${SVG_ICON_CLASS}"><path d="M6 8 h12 v5 H6 z"/> <path d="M6 13 h4 v7 l-2 2 H6 z"/> <line x1="7" y1="17" x2="9" y2="17" stroke-width="1"/> <path d="M18 13 h-4 v7 l2 2 H18 z"/> <line x1="15" y1="17" x2="17" y2="17" stroke-width="1"/> </svg>`;

  // --- App State (変更なし) ---
  let cardData = {}; // カードデータ (IDをキーとするオブジェクト)
  let currentEditingCardId = null;
  let currentPageCount = 0; // 現在の総ページ数
  let selectedCardIds = []; // 複数選択中のカードIDリスト
  let imageMarkedForDeletion = false; // モーダル内で画像削除が選択されたか

  // --- IndexedDB Functions は db.js を使用するため削除 ---

  // --- UI Functions ---

  function createPageElement(pageNumber) {
    const page = document.createElement("div");
    page.classList.add("page");
    page.id = `page-${pageNumber}`;
    const pageNumSpan = document.createElement("span");
    pageNumSpan.classList.add("page-number", "no-print");
    pageNumSpan.textContent = `Page ${pageNumber}`;
    page.appendChild(pageNumSpan);
    const grid = document.createElement("div");
    grid.classList.add("grid-container");
    page.appendChild(grid);
    for (let i = 1; i <= 16; i++) {
      const cardId = `card-p${pageNumber}-${i}`;
      const card = createCardElement(cardId, pageNumber, i);
      grid.appendChild(card);
      // cardDataの初期化はロード時に行う
    }
    return page;
  }

  function createCardElement(cardId, page, index) {
    const card = document.createElement("div");
    card.classList.add("card");
    card.id = cardId;
    card.dataset.page = page;
    card.dataset.index = index;
    card.innerHTML = `<span class="card-number">${index}</span><div class="card-image">${SVG_DEFAULT_PLACEHOLDER}</div><div class="card-info"><span class="part-display"></span><span class="manufacturer-display"></span><span class="value-display"></span></div>`;
    card.addEventListener("click", (event) => {
      handleCardClick(event, cardId);
    });
    return card;
  }

  function handleCardClick(event, cardId) {
    const isCtrl = event.ctrlKey || event.metaKey;
    if (isCtrl) {
      if (modal.classList.contains("show")) closeModal();
      if (bulkEditModal.classList.contains("show")) closeBulkEditModal();
      const idx = selectedCardIds.indexOf(cardId);
      if (idx > -1) {
        selectedCardIds.splice(idx, 1);
      } else {
        selectedCardIds.push(cardId);
      }
      updateSelectionAppearance();
      updateGlobalButtonsVisibility();
    } else {
      selectedCardIds = [];
      updateSelectionAppearance();
      updateGlobalButtonsVisibility();
      openModal(cardId);
    }
  }

  function updateSelectionAppearance() {
    document.querySelectorAll(".card").forEach((c) => {
      c.classList.toggle("multi-selected", selectedCardIds.includes(c.id));
    });
  }

  function updateGlobalButtonsVisibility() {
    const count = selectedCardIds.length;
    selectedCountSpan.textContent = count;
    bulkEditButton.style.display = count > 0 ? "inline-block" : "none";
    deletePageButton.style.display = "inline-block";
    deletePageButton.disabled = currentPageCount <= 1;
  }

  function updateCardDisplay(cardId) {
    const cardElement = document.getElementById(cardId);
    const data = cardData[cardId]; // ローカルのcardDataを参照

    if (!cardElement) return; // 要素がなければ何もしない

    // データがない場合、カードを初期状態にリセット
    if (!data) {
      const indexMatch = cardId.match(/-(\d+)$/);
      const index = indexMatch ? indexMatch[1] : '?';
      cardElement.innerHTML = `<span class="card-number">${index}</span><div class="card-image">${SVG_DEFAULT_PLACEHOLDER}</div><div class="card-info"><span class="part-display"></span><span class="manufacturer-display"></span><span class="value-display"></span></div>`;
      cardElement.className = 'card'; // クラスリセット
      return;
    }

    const imgContainer = cardElement.querySelector(".card-image");
    const infoContainer = cardElement.querySelector(".card-info");
    if (!imgContainer || !infoContainer) return; // 内部要素チェック

    // クラスリセット
    cardElement.classList.remove("manufacturer-geo", "manufacturer-tsui", "manufacturer-ana", "pilot-card");

    // カード番号更新
    let cardNumberSpan = cardElement.querySelector(".card-number");
    if (!cardNumberSpan) { /* ... span作成処理 ... */ }
    cardNumberSpan.textContent = data.index || (cardId.match(/-(\d+)$/) ? cardId.match(/-(\d+)$/)[1] : '?');

    // パイロットカードか通常カードかで表示切り替え
    if (!data.manufacturer || data.manufacturer === "") {
        // --- PILOT CARD ---
        cardElement.classList.add("pilot-card");
        imgContainer.innerHTML = "";
        imgContainer.classList.add("placeholder");
        let placeholderSvg = "";
        switch (data.part) {
            case "頭": placeholderSvg = SVG_HEAD; break;
            case "上半身": placeholderSvg = SVG_UPPER_BODY; break;
            case "下半身": placeholderSvg = SVG_LOWER_BODY; break;
            default: placeholderSvg = SVG_DEFAULT_PLACEHOLDER; break;
        }
        imgContainer.innerHTML = placeholderSvg;

        infoContainer.innerHTML = "";
        const effectElement = document.createElement("div");
        effectElement.classList.add("pilot-effect");
        let effectText = "";
        switch (data.part) {
            case "頭": effectText = "索敵 +1"; break;
            case "上半身": effectText = "攻撃 +1"; break;
            case "下半身": effectText = "防御 +1"; break;
        }
        effectElement.textContent = effectText;
        if (effectText) {
            infoContainer.appendChild(effectElement);
        } else {
            const pilotLabel = document.createElement('span');
            pilotLabel.textContent = '(パイロット)';
            pilotLabel.style.fontSize = '0.8em'; pilotLabel.style.color = '#666';
            infoContainer.appendChild(pilotLabel);
        }
    } else {
        // --- NORMAL CARD ---
        imgContainer.innerHTML = "";
        imgContainer.classList.remove("placeholder");
        if (data.image) {
            const img = document.createElement("img");
            img.src = data.image;
            img.alt = `Card ${data.id || cardId} Image`;
            imgContainer.appendChild(img);
        } else {
            let placeholderSvg = "";
            switch (data.part) {
                case "頭": placeholderSvg = SVG_HEAD; break;
                case "上半身": placeholderSvg = SVG_UPPER_BODY; break;
                case "下半身": placeholderSvg = SVG_LOWER_BODY; break;
                default: placeholderSvg = SVG_DEFAULT_PLACEHOLDER; break;
            }
            imgContainer.innerHTML = placeholderSvg;
            imgContainer.classList.add("placeholder");
        }

        infoContainer.innerHTML = "";
        const newPartDisplay = document.createElement("span");
        newPartDisplay.classList.add("part-display");
        newPartDisplay.textContent = data.part || "---";
        infoContainer.appendChild(newPartDisplay);

        const newManufacturerDisplay = document.createElement("span");
        newManufacturerDisplay.classList.add("manufacturer-display");
        newManufacturerDisplay.textContent = data.manufacturer || "---";
        infoContainer.appendChild(newManufacturerDisplay);

        const newValueDisplay = document.createElement("span");
        newValueDisplay.classList.add("value-display");
        newValueDisplay.textContent = data.value || "-";
        newValueDisplay.classList.remove("value-1", "value-2", "value-3");
        if (data.value === "1") newValueDisplay.classList.add("value-1");
        else if (data.value === "2") newValueDisplay.classList.add("value-2");
        else if (data.value === "3") newValueDisplay.classList.add("value-3");
        infoContainer.appendChild(newValueDisplay);

        if (data.manufacturer === "ジオ") cardElement.classList.add("manufacturer-geo");
        else if (data.manufacturer === "ツイ") cardElement.classList.add("manufacturer-tsui");
        else if (data.manufacturer === "アナ") cardElement.classList.add("manufacturer-ana");
    }
  }

  function renderAllCards() {
    pagesContainer.innerHTML = "";
    // currentPageCount は initializeApp で設定される
    if (currentPageCount === 0) {
        currentPageCount = 1; // データがない場合も1ページ目は表示
    }

    for (let pageNum = 1; pageNum <= currentPageCount; pageNum++) {
        const pageElement = createPageElement(pageNum);
        pagesContainer.appendChild(pageElement);
        for (let i = 1; i <= 16; i++) {
            const cardId = `card-p${pageNum}-${i}`;
            updateCardDisplay(cardId); // cardDataに基づいて表示 (なければ空になる)
        }
    }
    updateGlobalButtonsVisibility();
  }


  // --- Individual Edit Modal Functions ---
  function openModal(cardId) {
    // データがなければ新規作成として扱う
    if (!cardData[cardId]) {
      console.warn(`Data not found for ${cardId}. Creating new entry.`);
      const parts = cardId.match(/card-p(\d+)-(\d+)/);
      if (!parts) { alert(`エラー: 不正なカードID (${cardId}) です。`); return; }
      const page = parseInt(parts[1], 10);
      const index = parseInt(parts[2], 10);
      // cardData に一時的にデータを格納 (保存時にDBへ)
      cardData[cardId] = {
        id: cardId, page: page, index: index, image: null,
        manufacturer: "", value: "", part: ""
      };
    }
    currentEditingCardId = cardId;
    imageMarkedForDeletion = false;
    const data = cardData[cardId];
    modalCardIdSpan.textContent = `P${data.page}-${data.index}`;
    modalImageUpload.value = "";
    updateModalImagePreview(data.image || null);
    modalManufacturerSelect.value = data.manufacturer || "";
    modalValueSelect.value = data.value || "";
    modalPartSelect.value = data.part || "";
    modal.classList.add("show");
  }

  function updateModalImagePreview(imageData) {
    modalImagePreview.innerHTML = ""; // Clear
    modalImagePreview.classList.remove("has-image");
    if (imageData) {
        const img = document.createElement("img");
        img.src = imageData; img.alt = "Image Preview";
        modalImagePreview.appendChild(img);
        modalImagePreview.classList.add("has-image");
    } else {
        modalImagePreview.innerHTML = `<svg ...>...</svg><span>プレビューなし</span>`; // Placeholder SVG
    }
  }

  function closeModal() {
    modal.classList.remove("show");
    currentEditingCardId = null;
    modalImageUpload.value = "";
    updateModalImagePreview(null);
    modalManufacturerSelect.value = "";
    modalValueSelect.value = "";
    modalPartSelect.value = "";
    imageMarkedForDeletion = false;
  }

  function handleDeleteImage() {
    if (!currentEditingCardId) return;
    imageMarkedForDeletion = true;
    modalImageUpload.value = "";
    updateModalImagePreview(null);
  }

  async function handleModalSave() {
    if (!currentEditingCardId || !cardData[currentEditingCardId]) {
      console.error("Save error: No valid card ID or data.");
      closeModal(); return;
    }
    const currentData = cardData[currentEditingCardId];
    let finalImageData = currentData.image || null;
    if (imageMarkedForDeletion) {
        finalImageData = null;
    }
    const file = modalImageUpload.files[0];

    const processSave = async (imageDataToSave) => {
      const updatedData = {
        ...currentData, // page, index など既存データを保持
        id: currentEditingCardId,
        manufacturer: modalManufacturerSelect.value,
        value: modalValueSelect.value,
        part: modalPartSelect.value,
        image: imageDataToSave,
      };
      cardData[currentEditingCardId] = updatedData; // ローカルデータ更新
      try {
        // ★ db.js の saveCardData を直接呼び出す ★
        await saveCardData(currentEditingCardId, updatedData);
        updateCardDisplay(currentEditingCardId);
        closeModal();
      } catch (error) {
        console.error("Save failed:", error);
        alert("カードデータの保存に失敗しました。");
      }
    };

    if (file) {
        imageMarkedForDeletion = false;
        const reader = new FileReader();
        reader.onload = async (e) => { await processSave(e.target.result); };
        reader.onerror = (error) => { alert("画像の読み込みに失敗しました。"); };
        reader.readAsDataURL(file);
    } else {
        await processSave(finalImageData);
    }
  }

  // --- Bulk Edit Modal Functions ---
  function openBulkEditModal() {
    if (selectedCardIds.length === 0) return;
    bulkEditCountSpan.textContent = selectedCardIds.length;
    bulkManufacturerSelect.value = "__nochange__";
    bulkValueSelect.value = "__nochange__";
    bulkPartSelect.value = "__nochange__";
    bulkEditModal.classList.add("show");
  }

  function closeBulkEditModal() {
    bulkEditModal.classList.remove("show");
  }

  async function handleBulkSave() {
    const manufacturer = bulkManufacturerSelect.value;
    const value = bulkValueSelect.value;
    const part = bulkPartSelect.value;
    const changes = {};
    if (manufacturer !== "__nochange__") changes.manufacturer = manufacturer;
    if (value !== "__nochange__") changes.value = value;
    if (part !== "__nochange__") changes.part = part;
    if (Object.keys(changes).length === 0) { closeBulkEditModal(); return; }

    console.log("Applying bulk changes:", changes, "to cards:", selectedCardIds);
    const savePromises = [];
    const updatedCardIds = [...selectedCardIds];

    updatedCardIds.forEach((cardId) => {
      if (cardData[cardId]) {
        const originalData = cardData[cardId];
        const updatedData = { ...originalData, ...changes };
        cardData[cardId] = updatedData; // ローカル更新
        // ★ db.js の saveCardData を直接呼び出す ★
        savePromises.push(saveCardData(cardId, updatedData));
        updateCardDisplay(cardId);
      } else { console.warn(`Bulk save skipped: Card data for ${cardId} not found.`); }
    });

    try {
        await Promise.all(savePromises);
        alert(`${updatedCardIds.length}件のカード情報を更新しました。`);
    } catch (error) {
        console.error("Bulk save operation failed:", error);
        alert("一括保存中にエラーが発生しました。");
    } finally {
        selectedCardIds = [];
        updateSelectionAppearance();
        updateGlobalButtonsVisibility();
        closeBulkEditModal();
    }
  }

  // --- Page Deletion Function ---
  function handleDeletePage() {
    if (currentPageCount <= 1) { alert("最後の1ページは削除できません。"); return; }
    const confirmDelete = confirm(`最後のページ (${currentPageCount}) を表示から削除しますか？\n(カードデータ自体は削除されません)`);
    if (confirmDelete) {
        const lastPageId = `page-${currentPageCount}`;
        const pageElementToRemove = document.getElementById(lastPageId);
        if (pageElementToRemove) {
            pageElementToRemove.remove();
            const removedPageNumber = currentPageCount;
            currentPageCount--;
            console.log(`Page ${removedPageNumber} removed. Current page count: ${currentPageCount}`);
            // 選択解除処理
            const oldSelectionCount = selectedCardIds.length;
            selectedCardIds = selectedCardIds.filter(id => {
                const match = id.match(/card-p(\d+)-/);
                return match && parseInt(match[1], 10) !== removedPageNumber;
            });
            if (oldSelectionCount !== selectedCardIds.length) {
                updateSelectionAppearance();
            }
            updateGlobalButtonsVisibility();
        } else {
            console.error(`Cannot find page element ${lastPageId} to remove.`);
            currentPageCount--; // 念のためページ数減らす
            updateGlobalButtonsVisibility();
        }
    }
  }

  // --- 全クリア処理関数 ---
  async function handleClearAll() {
    if (!confirm("本当にすべてのカードデータを初期化してもよろしいですか？\nこの操作は元に戻せません。")) return;
    console.log("Clearing all card data...");
    try {
      // ★ db.js の clearAllDBData を直接呼び出す ★
      await clearAllDBData();
      cardData = {};
      selectedCardIds = [];
      currentPageCount = 1; // 1ページに戻す
      renderAllCards(); // 表示リセット
      updateGlobalButtonsVisibility();
      alert("すべてのカードデータを初期化しました。");
    } catch (error) {
      console.error("Failed to clear all data:", error);
      alert("データのクリア中にエラーが発生しました。");
    }
  }

  // --- エクスポート処理関数 ---
  async function handleExport() {
    console.log("Exporting card data...");
    try {
      // ★ db.js の loadAllCardDataFromDB を直接呼び出す ★
      const result = await loadAllCardDataFromDB();
      // オブジェクト形式のデータを配列に変換してエクスポート
      const dataToExport = Object.values(result.data);
      if (!dataToExport || dataToExport.length === 0) { alert("エクスポートするデータがありません。"); return; }
      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "robot_cards_export.json";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      console.log("Card data exported successfully.");
      alert("カードデータをJSONファイルとしてエクスポートしました。");
    } catch (error) {
      console.error("Failed to export card data:", error);
      alert("カードデータのエクスポートに失敗しました。");
    }
  }

  // --- インポート処理関数 ---
  async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    console.log(`Importing file: ${file.name}`);
    if (!confirm("現在のカードデータがインポートするデータで上書きされます。\nよろしいですか？ (既存データは失われます)")) {
      importFileInput.value = ""; return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonContent = e.target.result;
        const importedDataArray = JSON.parse(jsonContent);
        if (!Array.isArray(importedDataArray)) throw new Error("無効なファイル形式です。JSON配列が必要です。");
        console.log(`Parsed ${importedDataArray.length} cards from JSON.`);

        console.log("Clearing existing data before import...");
        // ★ db.js の clearAllDBData を直接呼び出す ★
        await clearAllDBData();
        cardData = {}; // ローカルデータもクリア

        console.log("Saving imported data to IndexedDB...");
        const savePromises = importedDataArray.map(card => {
          if (card && typeof card.id === 'string') {
            // インポートデータに不足プロパティがあってもそのまま保存（ロード時にデフォルト値が適用される想定）
            const cardToSave = {
                id: card.id,
                page: card.page, // なければ undefined
                index: card.index, // なければ undefined
                image: card.image, // なければ undefined
                manufacturer: card.manufacturer, // なければ undefined
                value: card.value, // なければ undefined
                part: card.part, // なければ undefined
            };
             // ★ db.js の saveCardData を直接呼び出す ★
            return saveCardData(cardToSave.id, cardToSave);
          } else { return Promise.resolve(); } // 不正データはスキップ
        });
        await Promise.all(savePromises);
        console.log("Imported data saved successfully.");

        console.log("Reloading and rendering cards...");
        // ★ db.js の loadAllCardDataFromDB を呼び出し、戻り値に対応 ★
        const result = await loadAllCardDataFromDB();
        cardData = result.data; // オブジェクト形式のデータを取得
        currentPageCount = result.maxPage > 0 ? result.maxPage : (Object.keys(cardData).length > 0 ? 1 : 0); // 最大ページ数を設定

        renderAllCards(); // 新しいデータで画面を再描画
        updateGlobalButtonsVisibility(); // ボタン状態を更新
        alert("カードデータをインポートしました。");
      } catch (error) {
        console.error("Failed to import card data:", error);
        alert(`インポートに失敗しました。\nエラー: ${error.message}`);
        // エラー発生時は初期化を試みる
        initializeApp(); // 再初期化
      } finally {
        importFileInput.value = "";
      }
    };
    reader.onerror = (error) => { /* ... */ };
    reader.readAsText(file);
  }

  // --- Event Listeners ---
  modalSaveButton.addEventListener("click", handleModalSave);
  modalDeleteImageButton.addEventListener("click", handleDeleteImage);
  modalCancelButton.addEventListener("click", closeModal);
  modalCloseButton.addEventListener("click", closeModal);
  clearAllButton.addEventListener('click', handleClearAll);
  modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
  modalImageUpload.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      imageMarkedForDeletion = false;
      const reader = new FileReader();
      reader.onload = (e) => { updateModalImagePreview(e.target.result); };
      reader.onerror = (error) => { updateModalImagePreview(null); };
      reader.readAsDataURL(file);
    } else {
      if (!imageMarkedForDeletion && currentEditingCardId && cardData[currentEditingCardId]) {
          updateModalImagePreview(cardData[currentEditingCardId].image);
      } else { updateModalImagePreview(null); }
    }
  });
  bulkEditButton.addEventListener("click", openBulkEditModal);
  bulkSaveButton.addEventListener("click", handleBulkSave);
  bulkCancelButton.addEventListener("click", closeBulkEditModal);
  bulkCloseButton.addEventListener("click", closeBulkEditModal);
  bulkEditModal.addEventListener("click", (event) => { if (event.target === bulkEditModal) closeBulkEditModal(); });
  printButton.addEventListener("click", () => {
    const wasSelected = [...selectedCardIds];
    if (wasSelected.length > 0) { /* ... 選択解除 ... */ }
    setTimeout(() => { window.print(); }, 150);
  });
  addPageButton.addEventListener("click", () => {
    currentPageCount++;
    const newPageElement = createPageElement(currentPageCount);
    pagesContainer.appendChild(newPageElement);
    // 新しいページのカードは空で表示される (openModal時に初期化)
    for (let i = 1; i <= 16; i++) {
        const cardId = `card-p${currentPageCount}-${i}`;
        updateCardDisplay(cardId); // 空表示を確定
    }
    console.log(`Page ${currentPageCount} added.`);
    newPageElement.scrollIntoView({ behavior: "smooth", block: "start" });
    updateGlobalButtonsVisibility();
  });
  deletePageButton.addEventListener("click", handleDeletePage);
  exportButton.addEventListener('click', handleExport);
  importFileInput.addEventListener('change', handleImport);

  // --- Initialization ---
  async function initializeApp() {
    console.log("Initializing Card Creator...");
    try {
      // ★ db.js の initDB を直接呼び出す ★
      await initDB();
      // ★ db.js の loadAllCardDataFromDB を呼び出し、戻り値に対応 ★
      const result = await loadAllCardDataFromDB();
      cardData = result.data; // カードデータ (オブジェクト形式)
      currentPageCount = result.maxPage > 0 ? result.maxPage : (Object.keys(cardData).length > 0 ? 1 : 0); // 最大ページ数を設定

      renderAllCards(); // ロードしたデータでカード表示
      updateGlobalButtonsVisibility(); // ボタン状態を初期化
      console.log("Card Creator initialized successfully.");
    } catch (error) {
      console.error("Initialization failed:", error);
      alert("アプリケーションの初期化に失敗しました。");
      // エラーでも最低限の表示を試みる
      if (currentPageCount === 0) currentPageCount = 1;
      renderAllCards();
      updateGlobalButtonsVisibility();
    }
  }

  // アプリケーション初期化を実行
  initializeApp();

}); // End of DOMContentLoaded