function saveState() {
    const state = {
        countInput: countInput.value,
        countMax: countMax.value,
        startPauseBtnText: startPauseBtn.textContent,
        startPauseBtnDisabled: startPauseBtn.disabled,
        setBtnDisabled: setBtn.disabled
    };
    localStorage.setItem("state", JSON.stringify(state));
}

function restoreState() {
    const state = JSON.parse(localStorage.getItem("state"));
    if (state) {
        countInput.value = state.countInput;
        countMax.value = state.countMax;
        startPauseBtn.textContent = state.startPauseBtnText;
        startPauseBtn.disabled = state.startPauseBtnDisabled;
        setBtn.disabled = state.setBtnDisabled;
    }
}

function saveLogs(logs) {
    localStorage.setItem("logs", JSON.stringify(logs));
}

function getLogs() {
    return JSON.parse(localStorage.getItem("logs")) || [];
}

function savePauseLogs(pauseLogs) {
    localStorage.setItem("pauseLogs", JSON.stringify(pauseLogs));
}

function getPauseLogs() {
    return JSON.parse(localStorage.getItem("pauseLogs")) || [];
}

function saveItemLogs(itemLogs) {
    localStorage.setItem("itemLogs", JSON.stringify(itemLogs));
}

function getItemLogs() {
    return JSON.parse(localStorage.getItem("itemLogs")) || [];
}

function saveItemSettings() {
    const itemSettings = [];
    document.querySelectorAll("#itemList tr").forEach(row => {
        const itemName = row.querySelector(".item-name").textContent;
        const initialCount = row.querySelector("input[type='number']").value;
        itemSettings.push({ name: itemName, initialCount: initialCount });
    });
    localStorage.setItem("itemSettings", JSON.stringify(itemSettings));
}

function restoreItemSettings() {
    const itemSettings = JSON.parse(localStorage.getItem("itemSettings")) || [];
    itemList.innerHTML = ""; // Clear existing rows

    itemSettings.forEach((item, i) => {
        const num = i + 1;
        const row = document.createElement("tr");

        const deleteCell = document.createElement("td");
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "削除";
        deleteBtn.classList.add("btn", "btn-delete");
        deleteBtn.addEventListener("click", function () {
            if (confirm("本当に削除しますか？")) {
                row.remove();
                saveItemSettings(); // Save settings whenever an item is removed
            }
        });
        deleteCell.appendChild(deleteBtn);
        row.appendChild(deleteCell);

        const itemNameCell = document.createElement("td");
        const itemName = document.createElement("span");
        itemName.classList.add("item-name");
        itemName.textContent = item.name;

        itemName.addEventListener("click", function () {
            if (confirm("編集しますか？")) {
                const itemInput = document.createElement("input");
                itemInput.type = "text";
                itemInput.value = item.name;
                itemName.replaceWith(itemInput);

                itemInput.addEventListener("blur", function () {
                    itemName.textContent = itemInput.value;
                    itemInput.replaceWith(itemName);
                    saveItemSettings(); // Save settings whenever an item name is edited
                });
            }
        });
        itemNameCell.appendChild(itemName);
        row.appendChild(itemNameCell);

        const initialCountCell = document.createElement("td");
        const initialCountInput = document.createElement("input");
        initialCountInput.type = "number";
        initialCountInput.autocomplete = "off";
        initialCountInput.id = `item-${num}-initialCount`; // 一意のid属性を追加
        initialCountInput.name = `item-${num}-initialCount`; // 一意のname属性を追加
        initialCountInput.value = item.initialCount || 0;
        initialCountInput.addEventListener("blur", saveItemSettings); // Save settings whenever an initial count is edited
        initialCountCell.appendChild(initialCountInput);
        row.appendChild(initialCountCell);

        itemList.appendChild(row);
    });
}
