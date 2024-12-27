function updateLogTable() {
    const logs = getLogs();
    const pauseLogs = getPauseLogs();
    const itemLogs = getItemLogs();
    const combinedLogs = logs.concat(pauseLogs, itemLogs).sort((a, b) => new Date(a.time) - new Date(b.time));
    logTableBody.innerHTML = "";
    let previousTime = null;

    combinedLogs.forEach((log, index) => {
        const row = document.createElement("tr");

        const deleteCell = document.createElement("td");
        if (!log.event || log.event === "resume") {
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "削除";
            deleteBtn.classList.add("btn", "btn-delete");
            deleteBtn.addEventListener("click", function () {
                deleteLog(index, log);
            });
            deleteCell.appendChild(deleteBtn);
        }
        row.appendChild(deleteCell);

        const timeCell = document.createElement("td");
        timeCell.textContent = formatDateTime(log.time, previousTime);
        previousTime = log.time;

        const valueCell = document.createElement("td");
        if (log.event) {
            valueCell.textContent = log.event === "pause" ? "一時停止" : "再開";
        } else if (log.itemName) {
            if (log.previousValue === log.newValue || log.previousValue === 0) {
                valueCell.textContent = `${log.itemName}：${log.newValue}`;
            } else {
                valueCell.textContent = `${log.itemName}：${log.previousValue}→${log.newValue}`;
            }
        } else {
            valueCell.textContent = log.value;
        }

        row.appendChild(timeCell);
        row.appendChild(valueCell);
        logTableBody.appendChild(row);
    });

    logTable.style.display = combinedLogs.length > 0 ? "table" : "none";
    calculateEstimatedEndTime();

    if (logs.length > 0) {
        countMax.disabled = true;
        overlay.style.display = "block";
    }
}

function deleteLog(index, log) {
    const logs = getLogs();
    const pauseLogs = getPauseLogs();
    const itemLogs = getItemLogs();

    if (log.event === "pause" || log.event === "resume") {
        // pauseLogsから削除
        const pauseLogIndex = pauseLogs.findIndex(pauseLog => pauseLog.time === log.time);
        if (log.event === "resume") {
            deleteLogWithPause(pauseLogIndex);
        } else {
            pauseLogs.splice(pauseLogIndex, 1);
            savePauseLogs(pauseLogs);
        }
    } else if (log.itemName) {
        // itemLogsから削除
        const itemLogIndex = itemLogs.findIndex(itemLog => itemLog.time === log.time && itemLog.itemName === log.itemName);
        itemLogs.splice(itemLogIndex, 1);
        saveItemLogs(itemLogs);
        saveItemTable(); // Save the item table state after deletion
    } else {
        // 通常のログから削除
        const logIndex = logs.findIndex(normalLog => normalLog.time === log.time);
        logs.splice(logIndex, 1);
        saveLogs(logs);
    }

    updateLogTable();
}

function deleteLogWithPause(index) {
    let pauseLogs = getPauseLogs();
    let pauseLogIndex = index;

    // Find the latest pause log before the resume log
    while (pauseLogIndex > 0 && pauseLogs[pauseLogIndex].event !== "pause") {
        pauseLogIndex--;
    }

    if (pauseLogIndex >= 0 && pauseLogs[pauseLogIndex].event === "pause") {
        pauseLogs.splice(pauseLogIndex, 2); // Remove both pause and resume logs
    } else {
        pauseLogs.splice(index, 1); // If no pause log found, just remove the resume log
    }

    savePauseLogs(pauseLogs);
    updateLogTable();
}

function formatDateTime(dateTimeString, previousDateTimeString) {
    const current = new Date(dateTimeString);
    const previous = previousDateTimeString ? new Date(previousDateTimeString) : null;

    const month = current.getMonth() + 1;
    const day = current.getDate();
    const hour = current.getHours();
    const minute = current.getMinutes();
    const second = current.getSeconds();

    let formattedTime = "";

    if (!previous || previous.getMonth() + 1 !== month || previous.getDate() !== day) {
        formattedTime += `${month}/${day} ${hour}時${minute}分${second}秒`;
    } else if (!previous || previous.getHours() !== hour) {
        formattedTime += `${hour}時${minute}分${second}秒`;
    } else if (!previous || previous.getMinutes() !== minute) {
        formattedTime += `${minute}分${second}秒`;
    } else {
        formattedTime += `${minute}分${second}秒`;
    }

    return formattedTime;
}
