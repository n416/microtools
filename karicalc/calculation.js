function calculateEstimatedEndTime() {
    const logs = getLogs();
    const pauseLogs = getPauseLogs();
    const combinedLogs = logs.concat(pauseLogs).sort((a, b) => new Date(a.time) - new Date(b.time));

    if (logs.length < 2 || !countMax.value) {
        estimatedEndTimeDiv.textContent = "予測終了時刻：計算不可";
        speedDiv.textContent = "速度：計算不可";
        return;
    }

    const firstLog = logs[0];
    const lastLog = logs[logs.length - 1];
    const firstTime = new Date(firstLog.time);
    const lastTime = new Date(lastLog.time);

    const diffCountInput = Number(lastLog.value) - Number(firstLog.value); // 計測対象数を計算：最新入力値-初期入力値
    const diffTime = lastTime - firstTime; // 計測対象時間を計算：最新入力時刻-初期入力時刻、ミリ秒単位

    if (diffCountInput <= 0 || diffTime <= 0) {
        estimatedEndTimeDiv.textContent = "予測終了時刻：計算不可";
        speedDiv.textContent = "速度：計算不可";
        return;
    }

    const speed = diffCountInput / diffTime; // 速度を計算：計測対象数/計測対象時間（ミリ秒単位）

    // 一時停止から再開までの総時間を計算
    let totalPauseDuration = 0;
    pauseLogs.forEach((pauseLog, index) => {
        if (pauseLog.event === "pause") {
            const pauseTime = new Date(pauseLog.time);
            const resumeLog = pauseLogs.find((log, idx) => log.event === "resume" && idx > index);
            if (resumeLog) {
                const resumeTime = new Date(resumeLog.time);
                totalPauseDuration += resumeTime - pauseTime;
            }
        }
    });

    // 終了予定時刻の計算
    let estimatedEndTime = new Date(lastTime.getTime() + ((countMax.value - lastLog.value) / speed) + totalPauseDuration);

    // 最新の統合ログが一時停止だった場合の計算
    if (pauseLogs.length > 0 && pauseLogs[pauseLogs.length - 1].event === "pause") {
        const lastPauseTime = new Date(pauseLogs[pauseLogs.length - 1].time);
        estimatedEndTime = new Date(estimatedEndTime.getTime() + (Date.now() - lastPauseTime));
    }

    if (isNaN(estimatedEndTime.getTime())) {
        estimatedEndTimeDiv.textContent = "予測終了時刻：計算不可";
        speedDiv.textContent = "速度：計算不可";
        return;
    }

    const hours = estimatedEndTime.getHours();
    const minutes = estimatedEndTime.getMinutes();
    const seconds = estimatedEndTime.getSeconds();

    estimatedEndTimeDiv.textContent = `予測終了時刻：${hours}時${minutes}分${seconds}秒`;

    const speedPerMinute = speed * 60 * 1000; // 速度を分単位に変換
    speedDiv.textContent = `速度：${speedPerMinute.toFixed(2)}カウント/分`;

    // estimatedEndTimeをlocalStorageに保存
    localStorage.setItem("estimatedEndTime", estimatedEndTime.toISOString());
}

function calculateItemConsumptionRates() {
    const itemLogs = getItemLogs();
    const itemRates = {};

    itemLogs.forEach(log => {
        if (!itemRates[log.itemName]) {
            itemRates[log.itemName] = {
                totalConsumption: 0,
                totalTime: 0,
                lastTime: null,
                lastValue: null
            };
        }
        if (log.previousValue !== null && log.newValue !== null) {
            const consumption = log.previousValue - log.newValue;
            if (itemRates[log.itemName].lastTime) {
                const timeDifference = new Date(log.time) - new Date(itemRates[log.itemName].lastTime);
                itemRates[log.itemName].totalTime += timeDifference;
                itemRates[log.itemName].totalConsumption += consumption;
            }
            itemRates[log.itemName].lastTime = log.time;
            itemRates[log.itemName].lastValue = log.newValue;
        }
    });

    const consumptionRates = {};
    for (const itemName in itemRates) {
        if (itemRates[itemName].totalTime > 0) {
            const ratePerMinute = (itemRates[itemName].totalConsumption / (itemRates[itemName].totalTime / 60000));
            consumptionRates[itemName] = ratePerMinute.toFixed(2);
        } else {
            consumptionRates[itemName] = "計算不可";
        }
    }

    return consumptionRates;
}

function calculateItemPredictedQuantities() {
    const rates = calculateItemConsumptionRates();
    const itemLogs = getItemLogs();
    const estimatedEndTimeString = localStorage.getItem("estimatedEndTime");
    if (!estimatedEndTimeString) {
        return {};
    }
    const estimatedEndTime = new Date(estimatedEndTimeString);
    const predictedQuantities = {};

    const lastLogs = {};
    itemLogs.forEach(log => {
        lastLogs[log.itemName] = log;
    });

    for (const itemName in lastLogs) {
        const log = lastLogs[itemName];
        const rate = rates[itemName];
        if (rate !== "計算不可") {
            const lastLogTime = new Date(log.time);
            const remainingTimeInMinutes = (estimatedEndTime - lastLogTime) / 60000;
            const consumptionUntilEnd = rate * remainingTimeInMinutes;
            const predictedQuantity = log.newValue - consumptionUntilEnd;
            predictedQuantities[itemName] = Math.floor(predictedQuantity); // マイナスも含める
        } else {
            predictedQuantities[itemName] = log.newValue; // 予測不可の場合は現状の数量を表示
        }
    }

    return predictedQuantities;
}

// グローバルスコープに公開
window.calculateItemConsumptionRates = calculateItemConsumptionRates;
window.calculateItemPredictedQuantities = calculateItemPredictedQuantities;