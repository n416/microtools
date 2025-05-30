document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'bossPredictorState_v1';

    // ---------------------------------
    // 状態管理 (State Management)
    // ---------------------------------
    let state = {
        top10Data: Array.from({ length: 10 }, (_, i) => ({
            rank: i + 1, manualPercent: null, manualTime: null,
            currentValue: null, inputElement: null, timeElement: null
        })),
        participants: 50, currentTotalPercent: 0, lastTotalPercent: 0,
        lastCalcTime: null, firstSuccessfulCalcTime: null,
        estimatedHourlyRate: 0, regressionCoeffs: { a: null, b: null },
        defaultB: 0.8, top10Ratio: 1.5, isCalculating: false,
        chart: null, predictedDataPoints: [], historicalDataPoints: [],
        autoUpdateIntervalId: null, maxHourlyRate: 6000,
        isErrorState: false, sumRb: 0, autoUpdateCheckboxChecked: true,
        lastUserTypingTime: null, typingStatusMessageTimeoutId: null,
        inputFinalizedCountdownTimerId: null, inputFinalizedCountdownValue: 0,
        curveSettings: { eliteMembersCount: 5, goodMembersCount: 20, lowMembersCount: 25, }
    };

    // ---------------------------------
    // DOM要素 (DOM Elements)
    // ---------------------------------
    const dom = {
        autoUpdateCheckbox: document.getElementById('auto-update-checkbox'),
        clearStorageButton: document.getElementById('clear-storage-button'),
        minuteRateSpan: document.getElementById('minute-rate'),
        remainingHpSpan: document.getElementById('remaining-hp'),
        predictionSummarySpan: document.getElementById('prediction-summary'),
        top10TableBody: document.querySelector('#top10-table tbody'),
        updatePredictionButton: document.getElementById('update-prediction-button'),
        inputErrorP: document.getElementById('input-error'),
        hpChartCanvas: document.getElementById('hp-chart'),
        autoUpdateStatusMessage: document.getElementById('auto-update-status-message'),
        curveSettingsModal: document.getElementById('curve-settings-modal'),
        modalCloseButton: document.querySelector('#curve-settings-modal .modal-close-button'),
        openCurveSettingsModalButton: document.getElementById('open-curve-settings-modal-button'),
        eliteMembersCountInput: document.getElementById('elite-members-count'),
        goodMembersCountInput: document.getElementById('good-members-count'),
        lowMembersCountInput: document.getElementById('low-members-count'),
        totalModalParticipantsSpan: document.getElementById('total-modal-participants'),
        saveCurveSettingsButton: document.getElementById('save-curve-settings-button'),
        cancelCurveSettingsButton: document.getElementById('cancel-curve-settings-button'),
    };

    // ---------------------------------
    // ローカルストレージ関連
    // ---------------------------------
    function saveDataToLocalStorage() {
        if (state.isErrorState && !(dom.inputErrorP && dom.inputErrorP.textContent.includes("保存に失敗"))) {
            console.warn("エラー状態でデータが保存されました。");
        }
        const dataToSave = {
            top10Data: state.top10Data.map(d => ({ rank: d.rank, manualPercent: d.manualPercent, manualTime: d.manualTime })),
            curveSettings: state.curveSettings,
            currentTotalPercent: state.currentTotalPercent, lastTotalPercent: state.lastTotalPercent,
            lastCalcTime: state.lastCalcTime, firstSuccessfulCalcTime: state.firstSuccessfulCalcTime,
            estimatedHourlyRate: state.estimatedHourlyRate, regressionCoeffs: state.regressionCoeffs,
            isCalculating: state.isCalculating, historicalDataPoints: state.historicalDataPoints,
            maxHourlyRate: state.maxHourlyRate, sumRb: state.sumRb,
            autoUpdateCheckboxChecked: state.autoUpdateCheckboxChecked, isErrorState: state.isErrorState,
        };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave)); }
        catch (e) { console.error("LS保存失敗:", e); if (!state.isErrorState && dom.inputErrorP) dom.inputErrorP.textContent = "データ保存失敗"; }
    }

    function loadDataFromLocalStorage() {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                state.top10Data.forEach((d, i) => { if (parsedData.top10Data?.[i]) { d.manualPercent = parsedData.top10Data[i].manualPercent; d.manualTime = parsedData.top10Data[i].manualTime; } });
                state.curveSettings = parsedData.curveSettings || { eliteMembersCount: 5, goodMembersCount: 20, lowMembersCount: 25 };
                state.participants = (state.curveSettings.eliteMembersCount || 0) + (state.curveSettings.goodMembersCount || 0) + (state.curveSettings.lowMembersCount || 0);
                if (state.participants === 0 && parsedData.participants > 0) {
                    state.participants = parsedData.participants;
                    if (Object.values(state.curveSettings).every(v => (v || 0) === 0) && parsedData.participants > 0) {
                        state.curveSettings.goodMembersCount = state.participants;
                    } else if (state.participants === 0) {
                        state.participants = 50; state.curveSettings.goodMembersCount = 20; state.curveSettings.lowMembersCount = 25; state.curveSettings.eliteMembersCount = 5;
                    }
                }
                if (state.participants === 0) state.participants = 50;

                state.defaultB = deriveDefaultBFromSettings(state.curveSettings, state.participants);
                state.top10Ratio = deriveTop10Ratio(state.defaultB);
                state.currentTotalPercent = parsedData.currentTotalPercent || 0;
                state.lastTotalPercent = parsedData.lastTotalPercent || 0;
                state.lastCalcTime = parsedData.lastCalcTime || null;
                state.firstSuccessfulCalcTime = parsedData.firstSuccessfulCalcTime || null;
                state.estimatedHourlyRate = parsedData.estimatedHourlyRate || 0;
                state.regressionCoeffs = parsedData.regressionCoeffs || { a: null, b: null };
                state.isCalculating = parsedData.isCalculating || false;
                state.historicalDataPoints = parsedData.historicalDataPoints || [];
                state.maxHourlyRate = parsedData.maxHourlyRate || 6000;
                state.sumRb = parsedData.sumRb || 0;
                state.autoUpdateCheckboxChecked = parsedData.autoUpdateCheckboxChecked !== undefined ? parsedData.autoUpdateCheckboxChecked : true;
                state.isErrorState = parsedData.isErrorState || false;

                if (dom.autoUpdateCheckbox) dom.autoUpdateCheckbox.checked = state.autoUpdateCheckboxChecked;
                if (dom.eliteMembersCountInput) dom.eliteMembersCountInput.value = state.curveSettings.eliteMembersCount;
                if (dom.goodMembersCountInput) dom.goodMembersCountInput.value = state.curveSettings.goodMembersCount;
                if (dom.lowMembersCountInput) dom.lowMembersCountInput.value = state.curveSettings.lowMembersCount;
                updateTotalModalParticipantsDisplay();
                if (state.isErrorState && dom.inputErrorP && !dom.inputErrorP.textContent) {
                    dom.inputErrorP.textContent = "[警告] 前回エラー状態で終了しました。"; dom.inputErrorP.style.color = '#dc3545';
                }
                return true;
            } catch (e) { console.error("LS読込失敗:", e); localStorage.removeItem(STORAGE_KEY); }
        }
        state.participants = (state.curveSettings.eliteMembersCount || 0) + (state.curveSettings.goodMembersCount || 0) + (state.curveSettings.lowMembersCount || 0);
        if (state.participants === 0) state.participants = 50;
        state.defaultB = deriveDefaultBFromSettings(state.curveSettings, state.participants);
        state.top10Ratio = deriveTop10Ratio(state.defaultB);
        if (dom.eliteMembersCountInput) dom.eliteMembersCountInput.value = state.curveSettings.eliteMembersCount;
        if (dom.goodMembersCountInput) dom.goodMembersCountInput.value = state.curveSettings.goodMembersCount;
        if (dom.lowMembersCountInput) dom.lowMembersCountInput.value = state.curveSettings.lowMembersCount;
        updateTotalModalParticipantsDisplay();
        return false;
    }

    // ---------------------------------
    // 線形回帰
    // ---------------------------------
    function linearRegression(points) {
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0; const n = points.length; if (n < 2) return null;
        points.forEach(p => { sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumXX += p.x * p.x; });
        const B = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX); const A = (sumY - B * sumX) / n; return { A, B };
    }

    // ---------------------------------
    // ステータスメッセージ関連
    // ---------------------------------
    function clearTypingStatusMessageTimer() { if (state.typingStatusMessageTimeoutId) { clearTimeout(state.typingStatusMessageTimeoutId); state.typingStatusMessageTimeoutId = null; } }
    function clearInputFinalizedCountdownTimer() { if (state.inputFinalizedCountdownTimerId) { clearInterval(state.inputFinalizedCountdownTimerId); state.inputFinalizedCountdownTimerId = null; } state.inputFinalizedCountdownValue = 0; }
    function clearAllStatusMessagesAndTimers() {
        clearTypingStatusMessageTimer(); clearInputFinalizedCountdownTimer();
        if (dom.autoUpdateStatusMessage) dom.autoUpdateStatusMessage.textContent = "";
    }

    // ---------------------------------
    // エラー状態設定
    // ---------------------------------
    function setErrorState(message) {
        state.isErrorState = true; if (dom.inputErrorP) { dom.inputErrorP.textContent = message; dom.inputErrorP.style.color = '#dc3545'; }
        stopAutoUpdate(); clearAllStatusMessagesAndTimers();
        if (dom.minuteRateSpan) dom.minuteRateSpan.textContent = "ERROR"; if (dom.predictionSummarySpan) dom.predictionSummarySpan.textContent = "エラー発生 - 停止中";
        if (dom.remainingHpSpan) dom.remainingHpSpan.textContent = "--";
        if (state.chart && state.chart.options.plugins.annotation) state.chart.options.plugins.annotation.annotations.nowLine.borderColor = 'gray';
        saveDataToLocalStorage();
    }

    function clearErrorState() {
        state.isErrorState = false; if (dom.inputErrorP && dom.inputErrorP.textContent.startsWith("[警告]")) dom.inputErrorP.textContent = '';
        clearAllStatusMessagesAndTimers(); startAutoUpdate(); saveDataToLocalStorage();
    }

    // ---------------------------------
    // メンバー構成から defaultB を導出
    // ---------------------------------
    function deriveDefaultBFromSettings(curveSettings, totalParticipants) {
        if (totalParticipants <= 0) return 0.8;
        const n1 = curveSettings.eliteMembersCount || 0; const n2 = curveSettings.goodMembersCount || 0;
        const f1 = n1 / totalParticipants; const totalActive = n1 + n2; const fActive = totalActive / totalParticipants;
        let newDefaultB = 0.8;
        if (f1 <= 0.05 && fActive < 0.2) newDefaultB = 1.2;
        else if (f1 <= 0.1 && fActive < 0.4) newDefaultB = 1.0;
        else if (f1 >= 0.25 || fActive >= 0.8) newDefaultB = 0.6;
        else if (f1 >= 0.15 && fActive >= 0.6) newDefaultB = 0.7;
        return newDefaultB;
    }

    // ---------------------------------
    // defaultB から top10Ratio を導出
    // ---------------------------------
    function deriveTop10Ratio(defaultBVal) {
        let newTop10Ratio = 1.5;
        if (defaultBVal >= 1.1) newTop10Ratio = 1.2; else if (defaultBVal >= 0.9) newTop10Ratio = 1.35;
        else if (defaultBVal <= 0.6) newTop10Ratio = 1.7; else if (defaultBVal <= 0.7) newTop10Ratio = 1.6;
        return newTop10Ratio;
    }

    // ---------------------------------
    // モデル再計算 (Recalculate Model)
    // ---------------------------------
    function recalculateModel() {
        clearAllStatusMessagesAndTimers(); const now = Date.now();
        if (!state.isErrorState && dom.inputErrorP) dom.inputErrorP.textContent = '';
        const manualPoints = state.top10Data.filter(d => d.manualPercent !== null)
            .map(d => ({ rank: d.rank, percent: d.manualPercent, x: Math.log(d.rank), y: Math.log(d.manualPercent) }));
        let success = false, newB_exponent = null, newA_log = null;
        if (manualPoints.length >= 2) {
            const result = linearRegression(manualPoints.map(p => ({ x: p.x, y: p.y })));
            if (result && !isNaN(result.A) && !isNaN(result.B)) { newB_exponent = -result.B; newA_log = result.A; success = true; }
        } else if (manualPoints.length === 1) {
            const p1 = manualPoints[0]; newB_exponent = state.defaultB;
            const B_reg = -newB_exponent; newA_log = p1.y - B_reg * p1.x; success = true;
        } else {
            // ★★★ ここから変更 ★★★
            if (state.isCalculating) { // 既に有効なモデルが存在する場合
                console.log("新たな手動入力データがないため、既存モデルで表示を更新します。");
                // モデルの再計算は行わず、現在の状態で表示のみ更新
                // lastCalcTimeを更新すると時速計算に影響が出る可能性があるので、
                // ここでは特に時刻更新はせず、表示のみを最新にする
                updateDisplay(false); // isFromAutoUpdate = false で呼び出し
            } else {
                // まだ一度も計算が成功していない場合
                setErrorState('予測計算には最低1つのデータ入力が必要です。');
                state.isCalculating = false; // これはsetErrorState内でも行われるが一応
                updateDisplay();
            }
            return; // recalculateModel をここで終了
            // ★★★ ここまで変更 ★★★
        }
        if (!success || newB_exponent === null || isNaN(newB_exponent) || newA_log === null || isNaN(newA_log)) {
            setErrorState('係数の計算に失敗しました。入力値を確認してください。'); state.isCalculating = false; return;
        }
        if (state.firstSuccessfulCalcTime === null && success) state.firstSuccessfulCalcTime = now;
        state.regressionCoeffs.b = newB_exponent; state.regressionCoeffs.a = Math.exp(newA_log);
        state.sumRb = 0; state.top10Data.forEach(d => { state.sumRb += Math.pow(d.rank, -state.regressionCoeffs.b); });
        let sumTop10 = 0;
        state.top10Data.forEach(d => {
            const estimated = state.regressionCoeffs.a * Math.pow(d.rank, -state.regressionCoeffs.b);
            d.currentValue = isNaN(estimated) ? 0 : estimated; sumTop10 += d.currentValue;
        });
        const newTotalPercent = Math.min(sumTop10 * state.top10Ratio, 100);
        let currentRate = 0;
        if (state.lastCalcTime !== null) {
            const timeDiffHours = (now - state.lastCalcTime) / (1000 * 60 * 60);
            const percentDiff = newTotalPercent - state.lastTotalPercent;
            if (timeDiffHours > (1 / 3600)) {
                if (percentDiff > 0) currentRate = percentDiff / timeDiffHours;
                else currentRate = state.estimatedHourlyRate > 0 ? state.estimatedHourlyRate : 0;
            } else currentRate = state.estimatedHourlyRate > 0 ? state.estimatedHourlyRate : 0;
        }
        if (currentRate > state.maxHourlyRate) {
            setErrorState(`[警告] 時速 (${currentRate.toFixed(0)}%/h) が上限値 (${state.maxHourlyRate} %/h) を超えました。`);
            state.isCalculating = false; updateDisplay(); return;
        }
        if (state.isErrorState && currentRate <= state.maxHourlyRate) {
            clearErrorState();
            if (dom.inputErrorP && dom.inputErrorP.textContent.startsWith("[警告] 時速")) dom.inputErrorP.textContent = '';
        }
        state.estimatedHourlyRate = currentRate; state.currentTotalPercent = newTotalPercent;
        state.lastTotalPercent = state.currentTotalPercent; state.lastCalcTime = now; state.isCalculating = true;
        if (!state.isErrorState) {
            state.historicalDataPoints.push({ time: state.lastCalcTime, percent: 100 - state.currentTotalPercent });
            saveDataToLocalStorage();
        }
        updateDisplay(false); // ★ isFromAutoUpdate を false で呼び出す
    }

    // ---------------------------------
    // グラフデータ更新 & グラフ描画
    // ---------------------------------
    function updatePredictedData(isFromAutoUpdate = false) {
        state.predictedDataPoints = []; const now = Date.now(); let currentPercentForGraph = state.currentTotalPercent;
        if (isFromAutoUpdate && state.lastCalcTime && state.estimatedHourlyRate > 0 && !state.isErrorState) {
            const elapsed = (now - state.lastCalcTime) / (1000 * 60 * 60);
            currentPercentForGraph = Math.min(state.lastTotalPercent + state.estimatedHourlyRate * elapsed, 100);
        }
        if (state.isErrorState) { state.predictedDataPoints.push({ time: new Date(now), percent: 100 - currentPercentForGraph }); return; }
        if (state.estimatedHourlyRate > 0 && currentPercentForGraph < 100) {
            const remainingPercent = 100 - currentPercentForGraph; const remainingHours = remainingPercent / state.estimatedHourlyRate;
            const finishTime = now + remainingHours * 60 * 60 * 1000; const numPoints = Math.min(Math.ceil(remainingHours * 12), 120);
            const stepHours = (numPoints > 0) ? remainingHours / numPoints : 0;
            for (let i = 0; i <= numPoints; i++) {
                const timeOffset = (stepHours * i) * 60 * 60 * 1000; const time = now + timeOffset;
                const predictedPercent = Math.min(currentPercentForGraph + state.estimatedHourlyRate * (timeOffset / (1000 * 60 * 60)), 100);
                state.predictedDataPoints.push({ time: new Date(time), percent: Math.max(0, 100 - predictedPercent) });
            }
            if (state.predictedDataPoints.length === 0 || (state.predictedDataPoints.length > 0 && state.predictedDataPoints[state.predictedDataPoints.length - 1].percent > 0.001)) {
                state.predictedDataPoints.push({ time: new Date(finishTime), percent: 0 });
            }
        } else if (currentPercentForGraph >= 100) {
            state.predictedDataPoints.push({ time: new Date(state.lastCalcTime || now), percent: 0 });
        } else {
            state.predictedDataPoints.push({ time: new Date(now), percent: 100 - currentPercentForGraph });
            if (currentPercentForGraph < 100) state.predictedDataPoints.push({ time: new Date(now + 60 * 60 * 1000), percent: 100 - currentPercentForGraph });
        }
    }

    function renderChart() {
        if (!dom.hpChartCanvas) return;
        const chartOptions = {
            animation: false,
            scales: { x: { type: 'time', min: state.firstSuccessfulCalcTime ? state.firstSuccessfulCalcTime : undefined, time: { unit: 'minute', tooltipFormat: 'yyyy/MM/dd HH:mm', displayFormats: { minute: 'HH:mm', hour: 'MM/dd HH:mm' } }, title: { display: true, text: '時刻' } }, y: { beginAtZero: true, max: 100, title: { display: true, text: '残りHP (%)' } } },
            plugins: { tooltip: { callbacks: { label: function (context) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed.y !== null) { label += context.parsed.y.toFixed(2) + '%'; } return label; }, title: (c) => new Date(c[0].parsed.x).toLocaleString('ja-JP') } }, annotation: { annotations: { nowLine: { type: 'line', scaleID: 'x', value: Date.now(), borderColor: state.isErrorState ? 'gray' : 'red', borderWidth: 2, borderDash: [6, 6], label: { display: true, content: '現在', position: 'start', backgroundColor: 'rgba(255,0,0,0.7)', color: 'white', font: { size: 10 } } } } } }
        };
        if (state.chart) {
            state.chart.data.datasets[0].data = state.predictedDataPoints.map(p => ({ x: p.time.getTime(), y: p.percent }));
            state.chart.data.datasets[1].data = state.historicalDataPoints.map(p => ({ x: p.time, y: p.percent }));
            state.chart.options.scales.x.min = chartOptions.scales.x.min;
            state.chart.options.plugins.annotation.annotations.nowLine.value = Date.now();
            state.chart.options.plugins.annotation.annotations.nowLine.borderColor = state.isErrorState ? 'gray' : 'red';
            state.chart.update('none'); return;
        }
        const ctx = dom.hpChartCanvas.getContext('2d');
        state.chart = new Chart(ctx, { type: 'line', data: { datasets: [{ label: 'ボスHP (%) - 予測', data: [], borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)', borderWidth: 2, pointRadius: 0, tension: 0.1 }, { label: 'ボスHP (%) - 履歴', data: [], borderColor: 'rgba(200, 200, 200, 0.8)', backgroundColor: 'rgba(200, 200, 200, 0.1)', borderWidth: 1.5, pointRadius: 1, pointBackgroundColor: 'rgba(150,150,150,1)', tension: 0, borderDash: [3, 3] }] }, options: chartOptions });
        updatePredictedData();
        state.chart.data.datasets[0].data = state.predictedDataPoints.map(p => ({ x: p.time.getTime(), y: p.percent }));
        state.chart.data.datasets[1].data = state.historicalDataPoints.map(p => ({ x: p.time, y: p.percent }));
        state.chart.update('none');
    }

    // ---------------------------------
    // 入力欄のリアルタイム入力イベントハンドラ (`input` イベント)
    // ---------------------------------
    function handleRealtimeInput() {
        state.lastUserTypingTime = Date.now();
        if (dom.autoUpdateCheckbox.checked && !state.isErrorState && dom.autoUpdateStatusMessage) {
            clearInputFinalizedCountdownTimer();
            dom.autoUpdateStatusMessage.textContent = "入力中 - 更新一時停止中";
            clearTypingStatusMessageTimer();
            state.typingStatusMessageTimeoutId = setTimeout(() => {
                if (dom.autoUpdateStatusMessage && dom.autoUpdateStatusMessage.textContent === "入力中 - 更新一時停止中") {
                    dom.autoUpdateStatusMessage.textContent = "";
                }
                state.typingStatusMessageTimeoutId = null;
            }, 5000);
        }
    }

    // ---------------------------------
    // 入力欄の変更イベントハンドラ (`change` イベント)
    // ---------------------------------
    function handleInputChange(event) {
        state.lastUserTypingTime = Date.now();
        const rank = parseInt(event.target.dataset.rank, 10);
        const value = event.target.value.trim();
        const index = rank - 1;
        let isValidInput = false;

        if (value === '') {
            state.top10Data[index].manualPercent = null; state.top10Data[index].manualTime = null;
            event.target.style.fontWeight = 'normal'; event.target.style.backgroundColor = '';
            isValidInput = true;
        } else {
            const percent = parseFloat(value);
            if (!isNaN(percent) && percent > 0 && percent < 100) {
                state.top10Data[index].manualPercent = percent; state.top10Data[index].manualTime = Date.now();
                event.target.style.fontWeight = 'bold'; event.target.style.backgroundColor = '#fff9e6';
                isValidInput = true;
            } else {
                const prevManual = state.top10Data[index].manualPercent;
                event.target.value = prevManual ? prevManual.toFixed(3) : '';
                if (!state.isErrorState && dom.inputErrorP) dom.inputErrorP.textContent = `${rank}位: 0より大きく100未満の数値を入力してください。`;
                setTimeout(() => { if (!state.isErrorState && dom.inputErrorP && dom.inputErrorP.textContent.includes(`${rank}位`)) dom.inputErrorP.textContent = ''; }, 3000);
            }
        }

        if (isValidInput && dom.autoUpdateCheckbox.checked && !state.isErrorState && dom.autoUpdateStatusMessage) {
            clearTypingStatusMessageTimer(); dom.autoUpdateStatusMessage.textContent = "";
            clearInputFinalizedCountdownTimer();
            state.inputFinalizedCountdownValue = 5;
            dom.autoUpdateStatusMessage.textContent = `入力完了 - 更新再開まで ${state.inputFinalizedCountdownValue}`;
            state.inputFinalizedCountdownTimerId = setInterval(() => {
                state.inputFinalizedCountdownValue--;
                if (state.inputFinalizedCountdownValue > 0) {
                    if (dom.autoUpdateStatusMessage) dom.autoUpdateStatusMessage.textContent = `入力完了 - 更新再開まで ${state.inputFinalizedCountdownValue}`;
                } else {
                    if (dom.autoUpdateStatusMessage) dom.autoUpdateStatusMessage.textContent = "入力完了 - 更新再開";
                    clearInterval(state.inputFinalizedCountdownTimerId); state.inputFinalizedCountdownTimerId = null;
                    setTimeout(() => { if (dom.autoUpdateStatusMessage && dom.autoUpdateStatusMessage.textContent === "入力完了 - 更新再開") dom.autoUpdateStatusMessage.textContent = ""; }, 1500);
                }
            }, 1000);
        }
    }

    // ---------------------------------
    // モーダル内合計人数表示更新
    // ---------------------------------
    function updateTotalModalParticipantsDisplay() {
        if (dom.totalModalParticipantsSpan && dom.eliteMembersCountInput && dom.goodMembersCountInput && dom.lowMembersCountInput) {
            const elite = parseInt(dom.eliteMembersCountInput.value, 10) || 0;
            const good = parseInt(dom.goodMembersCountInput.value, 10) || 0;
            const low = parseInt(dom.lowMembersCountInput.value, 10) || 0;
            dom.totalModalParticipantsSpan.textContent = elite + good + low;
        }
    }

    // ---------------------------------
    // 表示更新 (Update Display) - ★ 入力欄表示ロジック修正 ★
    // ---------------------------------
    function updateDisplay(isFromAutoUpdate = false) {
        if (dom.top10TableBody && dom.top10TableBody.children.length === 0) {
            dom.top10TableBody.innerHTML = '';
            for (let i = 0; i < 10; i++) {
                const row = dom.top10TableBody.insertRow();
                row.insertCell(0).textContent = i + 1;
                const inputCell = row.insertCell(1); const timeCell = row.insertCell(2);
                const input = document.createElement('input');
                input.type = 'number'; input.min = '0.01'; input.step = '0.01'; input.max = '100';
                input.classList.add('percent-input'); input.dataset.rank = i + 1; input.placeholder = '--';
                inputCell.appendChild(input); timeCell.textContent = '--';
                state.top10Data[i].inputElement = input; state.top10Data[i].timeElement = timeCell;
                input.addEventListener('change', handleInputChange); input.addEventListener('input', handleRealtimeInput);
            }
        }

        let currentPercentToShow = state.currentTotalPercent;
        if (isFromAutoUpdate && state.lastCalcTime && state.estimatedHourlyRate > 0 && !state.isErrorState) {
            const elapsed = (Date.now() - state.lastCalcTime) / (1000 * 60 * 60);
            currentPercentToShow = Math.min(state.lastTotalPercent + state.estimatedHourlyRate * elapsed, 100);
        }

        if (!state.isErrorState) {
            const minuteRate = state.estimatedHourlyRate / 60;
            if (dom.minuteRateSpan) dom.minuteRateSpan.textContent = state.estimatedHourlyRate > 0 ? minuteRate.toFixed(3) : '--';
            const remainingHpPercent = 100 - currentPercentToShow;
            if (dom.remainingHpSpan) dom.remainingHpSpan.textContent = currentPercentToShow >= 0 && currentPercentToShow <= 100 ? remainingHpPercent.toFixed(3) : '--';
            const remainingBossHpForTimeCalc = 100 - currentPercentToShow;
            if (state.isCalculating && state.estimatedHourlyRate > 0 && remainingBossHpForTimeCalc > 0) {
                const remainingHours = remainingBossHpForTimeCalc / state.estimatedHourlyRate;
                const predictedDate = new Date(Date.now() + remainingHours * 60 * 60 * 1000);
                const predictedTimeFormatted = predictedDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                const totalRemainingMinutes = Math.floor(remainingHours * 60);
                if (dom.predictionSummarySpan) dom.predictionSummarySpan.textContent = `${predictedTimeFormatted}（残り${totalRemainingMinutes}分）`;
            } else if (currentPercentToShow >= 100) {
                if (dom.predictionSummarySpan) dom.predictionSummarySpan.textContent = "討伐完了済み";
            } else { if (dom.predictionSummarySpan) dom.predictionSummarySpan.textContent = '--'; }
        } else {
            if (dom.minuteRateSpan) dom.minuteRateSpan.textContent = "ERROR";
            if (dom.remainingHpSpan) dom.remainingHpSpan.textContent = "--";
            if (dom.predictionSummarySpan) dom.predictionSummarySpan.textContent = "エラー発生 - 停止中";
        }

        state.top10Data.forEach(d => {
            if (d.inputElement) {
                // 「予測を更新」直後 (isFromAutoUpdate が false) で、かつその行が手動入力された最新の行の場合
                if (!isFromAutoUpdate && d.manualTime === state.lastCalcTime && d.manualPercent !== null) {
                    d.inputElement.value = d.manualPercent.toFixed(3);
                }
                // 自動更新時、または上記条件に当てはまらない手動更新後の表示
                else if (state.isCalculating && !state.isErrorState && d.currentValue !== null && d.currentValue !== undefined) {
                    d.inputElement.value = d.currentValue.toFixed(3);
                }
                // 計算中でないかエラー時で、過去の手動入力値がある場合
                else if (d.manualPercent !== null) {
                    d.inputElement.value = d.manualPercent.toFixed(3);
                }
                // それ以外 (初期状態やクリア後など)
                else {
                    d.inputElement.value = '';
                }

                // スタイルは manualTime の有無で決定
                if (d.manualTime !== null) {
                    d.inputElement.style.fontWeight = 'bold';
                    d.inputElement.style.backgroundColor = '#fff9e6';
                } else {
                    d.inputElement.style.fontWeight = 'normal';
                    d.inputElement.style.backgroundColor = '';
                }
            }
            if (d.timeElement) {
                d.timeElement.textContent = d.manualTime ? new Date(d.manualTime).toLocaleTimeString() : '--';
                d.timeElement.style.opacity = (d.manualTime && (Date.now() - d.manualTime > 5 * 60 * 1000)) ? '0.5' : '1';
            }
        });
        updatePredictedData(isFromAutoUpdate); renderChart();
    }

    // ---------------------------------
    // 自動更新処理 (真の全部更新！)
    // ---------------------------------
    function performAutoUpdate() {
        if (state.lastUserTypingTime && (Date.now() - state.lastUserTypingTime < 5000)) { return; }
        clearAllStatusMessagesAndTimers();
        if (state.isErrorState || !state.autoUpdateCheckboxChecked || !state.isCalculating || !state.regressionCoeffs.a || !state.lastCalcTime || state.estimatedHourlyRate <= 0) return;
        const now = Date.now(); const elapsed = (now - state.lastCalcTime) / (1000 * 60 * 60);
        if (elapsed <= 0) return;
        const newTotalPercentBasedOnRate = Math.min(state.lastTotalPercent + state.estimatedHourlyRate * elapsed, 100);
        if (state.sumRb > 0) { const new_a = newTotalPercentBasedOnRate / (state.top10Ratio * state.sumRb); state.regressionCoeffs.a = new_a; }
        else { return; }
        state.currentTotalPercent = newTotalPercentBasedOnRate; state.lastTotalPercent = state.currentTotalPercent;
        state.lastCalcTime = now;

        state.top10Data.forEach(d => {
            // currentValue は、この自動更新サイクルで計算された最新の推定値に更新済み
            d.currentValue = state.regressionCoeffs.a * Math.pow(d.rank, -state.regressionCoeffs.b);
        });

        // 自動更新によって全順位の推定値が更新されたので、以前の手動入力情報はクリアする
        state.top10Data.forEach(d => {
            d.manualPercent = null;
            d.manualTime = null;
        });
        
        if (!state.isErrorState) {
            state.historicalDataPoints.push({ time: state.lastCalcTime, percent: 100 - state.currentTotalPercent });
            saveDataToLocalStorage();
        }
        updateDisplay(true); // ★ isFromAutoUpdate を true で呼び出す
    }

    // ---------------------------------
    // イベントリスナー
    // ---------------------------------
    if (dom.updatePredictionButton) dom.updatePredictionButton.addEventListener('click', () => { clearAllStatusMessagesAndTimers(); recalculateModel(); });

    // applySettingsButton のリスナーは削除

    if (dom.clearStorageButton) dom.clearStorageButton.addEventListener('click', () => {
        if (confirm("本当にすべての保存データ（入力履歴、設定、グラフ履歴）をクリアしますか？\nクリア後、ページがリロードされます。")) {
            localStorage.removeItem(STORAGE_KEY); alert("保存データをクリアしました。"); window.location.reload();
        }
    });

    if (dom.openCurveSettingsModalButton) {
        dom.openCurveSettingsModalButton.addEventListener('click', () => {
            if (dom.eliteMembersCountInput) dom.eliteMembersCountInput.value = state.curveSettings.eliteMembersCount;
            if (dom.goodMembersCountInput) dom.goodMembersCountInput.value = state.curveSettings.goodMembersCount;
            if (dom.lowMembersCountInput) dom.lowMembersCountInput.value = state.curveSettings.lowMembersCount;
            updateTotalModalParticipantsDisplay();
            if (dom.curveSettingsModal) dom.curveSettingsModal.style.display = 'block';
        });
    }
    if (dom.modalCloseButton) { dom.modalCloseButton.addEventListener('click', () => { if (dom.curveSettingsModal) dom.curveSettingsModal.style.display = 'none'; }); }
    if (dom.cancelCurveSettingsButton) { dom.cancelCurveSettingsButton.addEventListener('click', () => { if (dom.curveSettingsModal) dom.curveSettingsModal.style.display = 'none'; }); }

    if (dom.saveCurveSettingsButton) {
        dom.saveCurveSettingsButton.addEventListener('click', () => {
            const eliteCount = parseInt(dom.eliteMembersCountInput.value, 10);
            const goodCount = parseInt(dom.goodMembersCountInput.value, 10);
            const lowCount = parseInt(dom.lowMembersCountInput.value, 10);
            state.curveSettings.eliteMembersCount = Math.max(0, isNaN(eliteCount) ? 0 : eliteCount);
            state.curveSettings.goodMembersCount = Math.max(0, isNaN(goodCount) ? 0 : goodCount);
            state.curveSettings.lowMembersCount = Math.max(0, isNaN(lowCount) ? 0 : lowCount);

            state.participants = state.curveSettings.eliteMembersCount + state.curveSettings.goodMembersCount + state.curveSettings.lowMembersCount;
            if (state.participants === 0) state.participants = 1;
            updateTotalModalParticipantsDisplay();

            const newDefaultB = deriveDefaultBFromSettings(state.curveSettings, state.participants);
            const newTop10Ratio = deriveTop10Ratio(newDefaultB);

            let settingsChanged = (state.defaultB !== newDefaultB) || (state.top10Ratio !== newTop10Ratio);
            state.defaultB = newDefaultB;
            state.top10Ratio = newTop10Ratio;

            if (dom.curveSettingsModal) dom.curveSettingsModal.style.display = 'none';
            saveDataToLocalStorage();

            if (settingsChanged && state.isCalculating && !state.isErrorState) { recalculateModel(); }
            else if (settingsChanged && !state.isCalculating && state.top10Data.some(d => d.manualPercent !== null)) { recalculateModel(); }
        });
    }
    if (dom.curveSettingsModal) { window.addEventListener('click', (event) => { if (event.target === dom.curveSettingsModal) dom.curveSettingsModal.style.display = 'none'; }); }

    [dom.eliteMembersCountInput, dom.goodMembersCountInput, dom.lowMembersCountInput].forEach(input => {
        if (input) input.addEventListener('input', updateTotalModalParticipantsDisplay);
    });

    // ---------------------------------
    // 自動更新タイマー制御
    // ---------------------------------
    function stopAutoUpdate() { if (state.autoUpdateIntervalId) { clearInterval(state.autoUpdateIntervalId); state.autoUpdateIntervalId = null; } }
    function startAutoUpdate() {
        stopAutoUpdate();
        if (state.autoUpdateCheckboxChecked && !state.isErrorState) {
            state.autoUpdateIntervalId = setInterval(performAutoUpdate, 10000);
        }
    }
    if (dom.autoUpdateCheckbox) dom.autoUpdateCheckbox.addEventListener('change', () => {
        state.autoUpdateCheckboxChecked = dom.autoUpdateCheckbox.checked;
        saveDataToLocalStorage();
        if (state.autoUpdateCheckboxChecked) startAutoUpdate();
        else { stopAutoUpdate(); clearAllStatusMessagesAndTimers(); }
    });

    // ---------------------------------
    // 初期化 (Initialization)
    // ---------------------------------
    function init() {
        const dataLoaded = loadDataFromLocalStorage();
        if (dataLoaded && state.lastCalcTime && state.isCalculating && !state.isErrorState && state.estimatedHourlyRate > 0) {
            const now = Date.now(); const elapsedHoursSinceSave = (now - state.lastCalcTime) / (1000 * 60 * 60);
            if (elapsedHoursSinceSave > 0) {
                const progressedPercent = state.estimatedHourlyRate * elapsedHoursSinceSave;
                let newTotalPercentAfterCatchup = Math.min(state.lastTotalPercent + progressedPercent, 100);
                if (state.regressionCoeffs.b !== null && state.autoUpdateCheckboxChecked) {
                    let tempSumRb = 0;
                    if (state.sumRb > 0) { tempSumRb = state.sumRb; }
                    else if (state.regressionCoeffs.b !== null) {
                        state.top10Data.forEach(d => { tempSumRb += Math.pow(d.rank, -state.regressionCoeffs.b); });
                        state.sumRb = tempSumRb;
                    }
                    if (tempSumRb > 0) {
                        const new_a = newTotalPercentAfterCatchup / (state.top10Ratio * tempSumRb);
                        state.regressionCoeffs.a = new_a;
                        state.top10Data.forEach(d => { d.currentValue = state.regressionCoeffs.a * Math.pow(d.rank, -state.regressionCoeffs.b); });
                    }
                }
                state.currentTotalPercent = newTotalPercentAfterCatchup; state.lastTotalPercent = state.currentTotalPercent;
                state.lastCalcTime = now; saveDataToLocalStorage();
            }
        }
        updateDisplay(); startAutoUpdate();
        console.log("アプリケーションが初期化されました (入力値即時変更なし・最終修正版)。");
    }

    init();
});