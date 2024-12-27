document.addEventListener("DOMContentLoaded", function () {
    initializeUI();
    restoreItemEntries();
});

function resetApplication() {
    // ローカルストレージから特定のアイテムをクリア
    localStorage.removeItem("logs");
    localStorage.removeItem("pauseLogs");
    localStorage.removeItem("itemLogs");
    localStorage.removeItem("estimatedEndTime");
    localStorage.removeItem("countInput");
    localStorage.removeItem("state");
    localStorage.removeItem("itemTableData");

    // 初期状態に戻す
    document.getElementById("countInput").value = "";
    document.getElementById("countMax").value = "";
    document.getElementById("startPauseBtn").textContent = "一時停止";
    document.getElementById("startPauseBtn").disabled = true;
    document.getElementById("setBtn").disabled = true;

    // UIを再初期化
    initializeUI();
}

const startPauseBtn = document.getElementById("startPauseBtn");
const setBtn = document.getElementById("setBtn");
const countInput = document.getElementById("countInput");
const countMax = document.getElementById("countMax");
const logTable = document.getElementById("logTable");
const logTableBody = document.querySelector("#logTable tbody");
const clearAllBtn = document.getElementById("clearAllBtn");
const estimatedEndTimeDiv = document.getElementById("estimatedEndTime");
const speedDiv = document.getElementById("speed");
const itemList = document.getElementById("itemList");
const addItemBtn = document.getElementById("addItemBtn");
const logAccordion = document.querySelector("details");
const itemTableContainer = document.getElementById("itemTableContainer");
const itemEntriesContainer = document.getElementById("itemEntries");
const overlay = document.createElement("div");
const itemConsumptionDisplay = document.createElement("div");
itemConsumptionDisplay.id = "itemConsumptionDisplay";
document.getElementById("screen").appendChild(itemConsumptionDisplay);

overlay.style.position = "absolute";
overlay.style.top = "0";
overlay.style.left = "0";
overlay.style.width = "100%";
overlay.style.height = "100%";
overlay.style.backgroundColor = "transparent";
overlay.style.zIndex = "10";
overlay.style.cursor = "pointer";
overlay.style.display = "none";
countMax.parentElement.style.position = "relative";
countMax.parentElement.appendChild(overlay);

overlay.addEventListener("click", function () {
    if (confirm("編集しますか？")) {
        countMax.disabled = false;
        overlay.style.display = "none";
    }
});

countInput.addEventListener("keydown", function (event) {
    const countMaxValue = Number(countMax.value) || 0;
    let countValue = Number(countInput.value) || 0;

    if (event.key === "ArrowUp") {
        countInput.value = Math.min(countValue + 1, countMaxValue);
        event.preventDefault();
    } else if (event.key === "ArrowDown") {
        countInput.value = Math.max(countValue - 1, 0);
        event.preventDefault();
    }
});

countMax.addEventListener("keydown", function (event) {
    let countMaxValue = Number(countMax.value) || 0;

    if (event.key === "ArrowUp") {
        countMax.value = countMaxValue + 1;
        event.preventDefault();
    } else if (event.key === "ArrowDown") {
        countMax.value = Math.max(countMaxValue - 1, 0);
        event.preventDefault();
    }
});

countInput.addEventListener("focus", function () {
    if (countInput.value.trim() === "") {
        countInput.value = 1;
    }
});

countMax.addEventListener("focus", function () {
    if (countMax.value.trim() === "") {
        countMax.value = 0;
    }
});

startPauseBtn.addEventListener("click", function () {
    const isPaused = startPauseBtn.textContent === "一時停止";
    const pauseLogs = getPauseLogs();

    if (isPaused) {
        startPauseBtn.textContent = "一時停止解除";
        startPauseBtn.classList.add("active"); // activeクラスを追加
        pauseLogs.push({ event: "pause", time: new Date().toISOString() });
        setBtn.disabled = true;
    } else {
        startPauseBtn.textContent = "一時停止";
        startPauseBtn.classList.remove("active"); // activeクラスを削除
        pauseLogs.push({ event: "resume", time: new Date().toISOString() });
        setBtn.disabled = false;
    }

    savePauseLogs(pauseLogs);
    updateLogTable();
    saveState();
});

setBtn.addEventListener("click", function () {
    if (startPauseBtn.disabled) {
        startPauseBtn.disabled = false;
    }

    const countValue = countInput.value;
    const countMaxValue = countMax.value;
    let logs = getLogs();
    const lastCountValue = logs.length > 0 ? Number(logs[logs.length - 1].value) : 0;

    if (isNaN(countValue) || countValue.trim() === "" || !/^\d+$/.test(countValue)) {
        alert("整数で入力してください");
        return;
    }

    if (Number(countValue) < lastCountValue) {
        alert(`${lastCountValue}よりも大きな値を入力してください`);
        return;
    }

    if (Number(countValue) > Number(countMaxValue)) {
        alert("最大数よりも小さな値を入力してください");
        return;
    }

    const currentTime = new Date().toISOString();
    const log = {
        time: currentTime,
        value: countValue
    };
    logs.push(log);
    saveLogs(logs);

    localStorage.setItem("countInput", countInput.value);
    localStorage.setItem("countMax", countMax.value);

    updateLogTable();
    saveState();
    updateItemConsumptionDisplay();
    logAccordion.style.display = 'block';  // ログアコーディオンを表示
    startPauseBtn.style.display = 'block';  // 一時停止ボタンを表示
    clearAllBtn.style.display = 'block';  // 全クリアボタンを表示
});

clearAllBtn.addEventListener("click", function () {
    const countMaxValue = countMax.value;
    if (confirm("本当に全てのデータをクリアしますか？")) {
        localStorage.setItem("countMax", countMaxValue);
        resetApplication(); // ページをリフレッシュせずにアプリケーションをリセット
    }
});

addItemBtn.addEventListener("click", function () {
    const row = document.createElement("tr");

    const deleteCell = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "削除";
    deleteBtn.classList.add("btn", "btn-delete");
    deleteBtn.addEventListener("click", function () {
        if (confirm("本当に削除しますか？")) {
            row.remove();
            saveItemSettings();
        }
    });
    deleteCell.appendChild(deleteBtn);
    row.appendChild(deleteCell);

    const itemNameCell = document.createElement("td");
    const itemName = document.createElement("span");
    itemName.classList.add("item-name");
    itemName.textContent = "アイテム名";

    itemName.addEventListener("click", function () {
        if (confirm("編集しますか？")) {
            const itemInput = document.createElement("input");
            itemInput.type = "text";
            itemInput.value = itemName.textContent;
            itemInput.id = `item-${Date.now()}}-name`; // 一意のid属性を追加
            itemInput.name = `item-${Date.now()}-name`; // 一意のname属性を追加
            itemName.replaceWith(itemInput);

            itemInput.addEventListener("blur", function () {
                itemName.textContent = itemInput.value;
                itemInput.replaceWith(itemName);
                saveItemSettings();
            });
        }
    });
    itemNameCell.appendChild(itemName);
    row.appendChild(itemNameCell);

    const initialCountCell = document.createElement("td");
    const initialCountInput = document.createElement("input");
    initialCountInput.type = "number";
    initialCountInput.value = 0;
    initialCountInput.autocomplete = "off";
    initialCountInput.id = `item-${Date.now()}-initialCount`; // 一意のid属性を追加
    initialCountInput.name = `item-${Date.now()}-initialCount`; // 一意のname属性を追加
    initialCountInput.addEventListener("blur", saveItemSettings);
    initialCountCell.appendChild(initialCountInput);
    row.appendChild(initialCountCell);

    itemList.appendChild(row);
    saveItemSettings();
});

function saveSettings() {
    const itemSettings = [];
    document.querySelectorAll("#itemList tr").forEach(row => {
        const itemName = row.querySelector(".item-name").textContent;
        const initialCount = row.querySelector("input[type='number']").value;
        itemSettings.push({ name: itemName, initialCount: initialCount });
    });
    localStorage.setItem("itemSettings", JSON.stringify(itemSettings));
    toggleSettingsPane();
}

function cancelSettings() {
    toggleSettingsPane();
}

function saveItemTable() {
    const itemTableData = [];
    document.querySelectorAll("#itemTableBody tr").forEach(row => {
        const itemName = row.querySelector("td:nth-child(1)").textContent;
        const currentCount = row.querySelector("input[type='number']").value;
        itemTableData.push({ name: itemName, currentCount: currentCount });
    });
    localStorage.setItem("itemTableData", JSON.stringify(itemTableData));
}

function restoreItemTable() {
    const itemTableData = JSON.parse(localStorage.getItem("itemTableData")) || [];
    if (!itemEntriesContainer) {
        console.error("itemEntriesContainer not found");
        return;
    }
    itemEntriesContainer.innerHTML = "";

    itemTableData.forEach(item => {
        const entry = createItemEntry(item);
        itemEntriesContainer.appendChild(entry);
    });
    updateItemConsumptionDisplay();
}

function initializeUI() {
    restoreState();
    restoreItemSettings();
    restoreItemTable();
    const savedCountMax = localStorage.getItem("countMax");
    if (savedCountMax !== null) {
        countMax.value = savedCountMax;
    }

    const savedCountInput = localStorage.getItem("countInput");
    if (savedCountInput !== null) {
        countInput.value = savedCountInput;
    }

    const accordionState = localStorage.getItem("logAccordionState");
    if (accordionState !== null) {
        logAccordion.open = JSON.parse(accordionState);
    }

    updateItemTable();
    updateItemConsumptionDisplay();

    // ログが存在しない場合、アコーディオン、一時停止ボタン、全クリアボタンを非表示にする
    const logs = getLogs();
    const pauseLogs = getPauseLogs();
    if (logs.length === 0 && pauseLogs.length === 0) {
        logAccordion.style.display = 'none';
        startPauseBtn.style.display = 'none';
        clearAllBtn.style.display = 'none';
    } else {
        logAccordion.style.display = 'block';
        startPauseBtn.style.display = 'block';
        clearAllBtn.style.display = 'block';
    }

    // 一時停止状態の確認とボタンのスタイル設定
    const isPaused = pauseLogs.length > 0 && pauseLogs[pauseLogs.length - 1].event === "pause";
    if (isPaused) {
        startPauseBtn.textContent = "一時停止解除";
        startPauseBtn.classList.add("active");
        setBtn.disabled = true;
    } else {
        startPauseBtn.textContent = "一時停止";
        startPauseBtn.classList.remove("active");
        setBtn.disabled = false;
    }
}

logAccordion.addEventListener("toggle", function () {
    localStorage.setItem("logAccordionState", logAccordion.open);
});

function updateItemTable() {
    const logs = getLogs();
    const itemSettings = JSON.parse(localStorage.getItem("itemSettings")) || [];

    itemEntriesContainer.innerHTML = "";

    itemTableContainer.style.display = "block";
    itemSettings.forEach((item, i) => {
        const entry = createItemEntry(item, i);
        itemEntriesContainer.appendChild(entry);
    });
    updateItemConsumptionDisplay();
}

function toggleSettingsPane() {
    const sidePane = document.getElementById("sidePane");
    const mask = document.getElementById("mask");
    if (sidePane.classList.contains("open")) {
        sidePane.classList.remove("open");
        mask.classList.remove("show");
        mask.style.display = 'none';
    } else {
        sidePane.classList.add("open");
        mask.classList.add("show");
        mask.style.display = 'block';
    }
}

function updateItemConsumptionDisplay() {
    const rates = window.calculateItemConsumptionRates();
    const predictedQuantities = window.calculateItemPredictedQuantities();
    itemConsumptionDisplay.innerHTML = "";
    for (const itemName in rates) {
        const rate = rates[itemName];
        const predictedQuantity = predictedQuantities[itemName];
        const rateDiv = document.createElement("div");
        rateDiv.textContent = `${itemName}消費速度（分）：${rate}`;
        const quantityDiv = document.createElement("div");
        quantityDiv.textContent = `終了時の予測数量：${predictedQuantity !== undefined ? predictedQuantity : '計算不可'}`;
        const separator = document.createElement("hr");
        itemConsumptionDisplay.appendChild(separator);
        itemConsumptionDisplay.appendChild(rateDiv);
        itemConsumptionDisplay.appendChild(quantityDiv);
    }
}

// サイドペインのアイテム設定を取得
function getSidePaneItems() {
    const itemSettings = JSON.parse(localStorage.getItem("itemSettings")) || [];
    return itemSettings.map(item => ({ name: item.name, value: item.initialCount || 0 }));
}

// アイテムエントリを生成する関数
function createItemEntry(item, i) {
    const num = i + 1;
    const entry = document.createElement("div");
    entry.classList.add("item-entry");

    const itemName = document.createElement("label");
    const span = document.createElement("span");
    span.textContent = item.name;
    const input = document.createElement("input");
    input.type = "number";
    input.name = `item-${num}-count`; // 一意のname属性を追加
    input.id = `item-${num}-count`; // 一意のid属性を追加
    input.autocomplete = "off";
    input.value = item.currentCount || item.initialCount || 0;

    itemName.appendChild(span);
    itemName.appendChild(input);

    const errorMessage = document.createElement("span");
    errorMessage.classList.add("error-message");
    errorMessage.style.color = "red";
    errorMessage.style.margin = "-10px auto";
    errorMessage.style.padding = "0 5px";
    errorMessage.style.top = "100%";
    errorMessage.style.display = "none"; // 初期状態では非表示
    itemName.appendChild(errorMessage);

    const button = document.createElement("button");
    button.classList.add("btn", "btn-primary");
    button.textContent = "記録";
    button.addEventListener("click", function () {
        if (validateInput(input, errorMessage)) {
            console.log("アイテム記録！");  // コンソールログに出力
            const currentTime = new Date().toISOString();
            const previousLogs = getItemLogs().filter(log => log.itemName === item.name);
            const previousValue = previousLogs.length > 0 ? previousLogs[previousLogs.length - 1].newValue : item.initialCount || 0;
            const newValue = input.value;
            const log = {
                time: currentTime,
                itemName: item.name,
                previousValue: previousValue,
                newValue: newValue
            };
            let itemLogs = getItemLogs();
            itemLogs.push(log);
            saveItemLogs(itemLogs);
            updateLogTable(); // ログテーブルを更新
            saveState();
            saveItemTable();
            updateItemConsumptionDisplay();
            logAccordion.style.display = 'block';  // ログアコーディオンを表示
            startPauseBtn.style.display = 'block';  // 一時停止ボタンを表示
            clearAllBtn.style.display = 'block';  // 全クリアボタンを表示
        }
    });

    entry.appendChild(itemName);
    entry.appendChild(button);

    return entry;  // 修正：エントリを返す
}

function validateInput(input, errorMessage) {
    const value = input.value.trim();

    if (value === "") {
        errorMessage.textContent = "値を入力してください";
        errorMessage.style.display = "block";
        return false;
    } else if (!/^\d+$/.test(value) || parseInt(value, 10) < 0) {
        errorMessage.textContent = "正の整数を入力してください";
        errorMessage.style.display = "block";
        return false;
    } else {
        errorMessage.style.display = "none";
        return true;
    }
}

// アイテムエントリを保存する関数
function saveItemEntries() {
    const itemEntries = [];
    document.querySelectorAll(".item-entry").forEach(entry => {
        const itemName = entry.querySelector("label span").textContent;
        const itemValue = entry.querySelector("label input").value;
        itemEntries.push({ name: itemName, value: itemValue });
    });
    localStorage.setItem("itemEntries", JSON.stringify(itemEntries));
}

// アイテムエントリを復元する関数
function restoreItemEntries() {
    let itemEntries = JSON.parse(localStorage.getItem("itemEntries"));
    if (!itemEntriesContainer) {
        console.error("itemEntriesContainer not found");
        return;
    }
    if (!itemEntries || itemEntries.length === 0) {
        itemEntries = getSidePaneItems();
        localStorage.setItem("itemEntries", JSON.stringify(itemEntries));
    }
    itemEntriesContainer.innerHTML = "";
    itemEntries.forEach(item => {
        const entry = createItemEntry(item);
        itemEntriesContainer.appendChild(entry); // 修正：エントリを追加
    });
}

document.addEventListener("DOMContentLoaded", function () {
    restoreItemEntries();
});
