document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM Loaded. Initializing script v2.1...");

  // --- Global Element References ---
  const trackersContainer = document.getElementById('trackers-container');
  const addTrackerButton = document.getElementById('add-tracker');
  const shareButton = document.getElementById('share-button');
  const compareButton = document.getElementById('compare-button'); // Compare button

  // Edit Modal Elements
  const modalBackdrop = document.getElementById('modal-backdrop');
  const editModal = document.getElementById('edit-modal');
  const modalTrackerIdInput = document.getElementById('modal-tracker-id');
  const modalOriginalTimestampInput = document.getElementById('modal-original-timestamp');
  const modalEditTimeInput = document.getElementById('modal-edit-time');
  const modalEditCountInput = document.getElementById('modal-edit-count');
  const modalSaveButton = document.getElementById('modal-save-button');
  const modalCancelButton = document.getElementById('modal-cancel-button');

  // Compare Modal Elements
  const compareModalBackdrop = document.getElementById('compare-modal-backdrop');
  const compareModal = document.getElementById('compare-modal');
  const compareTracker1Select = document.getElementById('compare-tracker1');
  const compareTracker2Select = document.getElementById('compare-tracker2');
  const compareModalCancelButton = document.getElementById('compare-modal-cancel-button');
  const runComparisonButton = document.getElementById('run-comparison-button');
  const compareErrorElement = document.getElementById('compare-error');

  // Comparison Results Elements
  const comparisonSection = document.getElementById('comparison-section');
  const comparisonTextResults = document.getElementById('comparison-text-results');
  const comparisonChartCanvas = document.getElementById('comparison-chart');

  // --- Global State ---
  const LOCAL_STORAGE_KEY = 'trackerData_v3'; // Use a consistent key unless structure changes drastically
  let trackersData = {};
  let nextTrackerId = 0;
  let comparisonChartInstance = null; // To hold the Chart.js instance

  // --- Utility Functions ---
  function formatNumber(num) {
    return Number.isInteger(num) ? num : num.toFixed(2);
  }

  function formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function getTrackerElement(trackerId) {
      return document.getElementById(`tracker-${trackerId}`);
  }

  function updateElementText(element, text) {
      if (element) element.textContent = text;
  }

  function updateElementHTML(element, html) {
      if (element) element.innerHTML = html;
  }

  /**
   * Formats a duration given in hours into "X 時間 Y 分".
   * @param {number} hours - Duration in hours (can be fractional).
   * @returns {string} Formatted string.
   */
  function formatDuration(hours) {
      if (hours === Infinity || isNaN(hours) || hours < 0) {
          return "計算不能";
      }
      const totalMinutes = Math.ceil(hours * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${h} 時間 ${m} 分`;
  }


  // --- Core Logic Functions ---
  function calculateRates(trackerId) {
      const data = trackersData[trackerId];
      if (!data) return;
      const trackerElement = getTrackerElement(trackerId);
      if (!trackerElement) return;

      const ratePerMinElement = trackerElement.querySelector('.rate-per-min');
      const ratePerHourElement = trackerElement.querySelector('.rate-per-hour');
      const timeRemainingElement = trackerElement.querySelector('.time-remaining');
      const historyElement = trackerElement.querySelector('.history');
      const errorElement = trackerElement.querySelector('.error-message');

      data.history.sort((a, b) => a.time - b.time); // Ensure sorted

      updateElementText(errorElement, '');
      updateElementHTML(ratePerMinElement, `<span class="latex-num">---</span><span class="unit">pt/分</span>`);
      updateElementHTML(ratePerHourElement, `<span class="latex-num">---</span><span class="unit">pt/時間</span>`);
      updateElementText(timeRemainingElement, '');

      historyElement.innerHTML = '履歴:<br>' + data.history.map(entry => `
          <div class="history-entry" data-timestamp="${entry.time}">
              <span class="history-display">
                  ${formatTime(entry.time)}: <span class="latex-num">${entry.count}</span> pt
              </span>
              <div class="history-controls">
                  <button class="edit-history-modal" title="この履歴を編集">✎</button>
                  <button class="delete-history" title="この履歴を削除">×</button>
              </div>
          </div>`).reverse().join('');

      if (data.history.length < 2) {
          updateElementText(errorElement, data.history.length === 1 ? 'レート計算には履歴が2件以上必要です' : '');
          return;
      }

      const latest = data.history[data.history.length - 1];
      const previous = data.history[data.history.length - 2];
      const countDiff = latest.count - previous.count;
      const timeDiffMs = latest.time - previous.time;
      const timeDiffMinutes = timeDiffMs / (1000 * 60);

      let ratePerHour = 0; // Initialize rate
      let ratePerMinute = 0;

      if (timeDiffMinutes <= (1 / 600)) { // Min 0.1 sec interval
          updateElementText(errorElement, 'エラー: 計測間隔が短すぎます。');
          // Keep rates at 0 or '---'
          updateElementHTML(ratePerMinElement, `<span class="latex-num">---</span><span class="unit">pt/分</span>`);
          updateElementHTML(ratePerHourElement, `<span class="latex-num">---</span><span class="unit">pt/時間</span>`);
      } else {
           ratePerMinute = countDiff / timeDiffMinutes;
           ratePerHour = ratePerMinute * 60;
           updateElementHTML(ratePerMinElement, `<span class="latex-num">${formatNumber(ratePerMinute)}</span><span class="unit">pt/分</span>`);
           updateElementHTML(ratePerHourElement, `<span class="latex-num">${formatNumber(ratePerHour)}</span><span class="unit">pt/時間</span>`);
           if (countDiff < 0) {
              updateElementText(errorElement, '注意: ポイント数が減少しました。');
          }
      }

      // Calculate Time Remaining (uses the calculated ratePerHour)
      if (data.target !== null && typeof data.target === 'number' && data.target >= 0) {
          if (data.target <= latest.count) {
              updateElementText(timeRemainingElement, `目標 (${data.target}pt) 達成済み！`);
          } else if (ratePerHour > 0) {
              const remainingCount = data.target - latest.count;
              const remainingHours = remainingCount / ratePerHour;
              updateElementText(timeRemainingElement, `目標 (${data.target}pt) まで: あと 約 ${formatDuration(remainingHours)}`);
          } else {
              updateElementText(timeRemainingElement, `目標 (${data.target}pt) まで: (ペース低下中または停止中)`);
          }
      } else {
          updateElementText(timeRemainingElement, '');
      }
  }

  function recordData(trackerId) {
      const data = trackersData[trackerId];
      if (!data) return;
      const trackerElement = getTrackerElement(trackerId);
      if (!trackerElement) return;
      const countInput = trackerElement.querySelector('.count-input');
      const errorElement = trackerElement.querySelector('.error-message');
      const count = parseInt(countInput.value, 10);

      updateElementText(errorElement, '');
      if (isNaN(count) || count < 0) {
          updateElementText(errorElement, '有効な数値を入力してください。');
          return;
      }
      data.history.push({ count: count, time: Date.now() });
      countInput.value = '';
      calculateRates(trackerId);
      saveDataToLocalStorage();
  }

  function updateTarget(trackerId) {
      const data = trackersData[trackerId];
      if (!data) return;
      const trackerElement = getTrackerElement(trackerId);
      if (!trackerElement) return;
      const targetInput = trackerElement.querySelector('.target-input');
      const targetValue = targetInput.value;

      if (targetValue === '' || targetValue === null) { data.target = null; }
      else {
          const target = parseInt(targetValue, 10);
          data.target = (!isNaN(target) && target >= 0) ? target : null;
          if (data.target === null) targetInput.value = '';
      }
      calculateRates(trackerId);
      saveDataToLocalStorage();
  }

  function updateTitle(trackerId, newTitle) {
      const data = trackersData[trackerId];
      if (data) { data.title = newTitle.trim(); saveDataToLocalStorage(); }
  }

  function deleteHistoryEntry(trackerId, timestamp) {
      const data = trackersData[trackerId];
      if (!data) return;
      const timeNum = Number(timestamp);
      const initialLength = data.history.length;
      data.history = data.history.filter(entry => entry.time !== timeNum);
      if (data.history.length < initialLength) {
          calculateRates(trackerId); saveDataToLocalStorage();
      }
  }

  function removeTracker(trackerId) {
      const trackerElement = getTrackerElement(trackerId);
      if (trackerElement) { trackerElement.remove(); }
      delete trackersData[trackerId];
      saveDataToLocalStorage();
      updateRemoveButtonsVisibility();
  }

  function updateRemoveButtonsVisibility() {
      const remainingTrackers = trackersContainer.querySelectorAll('.tracker');
      const visible = remainingTrackers.length > 1;
      remainingTrackers.forEach(tracker => {
          const removeButton = tracker.querySelector('.remove-tracker');
          if (removeButton) { removeButton.style.display = visible ? 'inline-block' : 'none'; }
      });
  }

  function addTracker(initialData = null) {
      const trackerId = nextTrackerId++;
      const initialTitle = initialData?.title || `トラッカー ${trackerId + 1}`;
      const initialHistory = initialData?.history || [];
      const initialTarget = initialData?.target ?? null;

      trackersData[trackerId] = {
          title: initialTitle,
          history: initialHistory.map(h => ({ count: Number(h.count), time: Number(h.time) })),
          target: initialTarget !== null ? Number(initialTarget) : null
      };

      const trackerDiv = document.createElement('div');
      trackerDiv.classList.add('tracker');
      trackerDiv.id = `tracker-${trackerId}`;
      trackerDiv.innerHTML = `<h3><input type="text" value="${initialTitle.replace(/"/g, '&quot;')}" class="tracker-title" placeholder="名前 (例: 自分)" data-tracker-id="${trackerId}"><button class="remove-tracker" title="このトラッカーを削除" data-tracker-id="${trackerId}">×</button></h3><div class="input-group"><label for="count-${trackerId}">現在:</label><input type="number" id="count-${trackerId}" class="count-input" placeholder="ポイント数" min="0" step="1"><button class="record-button" data-tracker-id="${trackerId}">記録</button></div><div class="input-group"><label for="target-${trackerId}">目標:</label><input type="number" id="target-${trackerId}" class="target-input" placeholder="任意" min="0" step="1" value="${initialTarget !== null ? initialTarget : ''}"></div><div class="results"><span class="rate-per-min"><span class="latex-num">---</span><span class="unit">pt/分</span></span><span class="rate-per-hour"><span class="latex-num">---</span><span class="unit">pt/時間</span></span></div><div class="time-remaining"></div><div class="error-message error"></div><div class="info-message"></div><div class="history">履歴:<br></div>`;
      trackersContainer.appendChild(trackerDiv);

      const trackerTitleInput = trackerDiv.querySelector('.tracker-title');
      const countInput = trackerDiv.querySelector('.count-input');
      const recordButton = trackerDiv.querySelector('.record-button');
      const targetInput = trackerDiv.querySelector('.target-input');
      const removeButton = trackerDiv.querySelector('.remove-tracker');
      const historyDiv = trackerDiv.querySelector('.history');

      trackerTitleInput.addEventListener('input', (e) => updateTitle(trackerId, e.target.value));
      trackerTitleInput.addEventListener('change', (e) => updateTitle(trackerId, e.target.value));
      recordButton.addEventListener('click', () => recordData(trackerId));
      countInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') recordData(trackerId); });
      targetInput.addEventListener('input', () => updateTarget(trackerId));
      targetInput.addEventListener('change', () => updateTarget(trackerId));
      removeButton.addEventListener('click', () => removeTracker(trackerId));

      historyDiv.addEventListener('click', (e) => {
          const target = e.target;
          const entryDiv = target.closest('.history-entry');
          if (!entryDiv) return;
          const originalTimestamp = parseInt(entryDiv.getAttribute('data-timestamp'), 10);
          if (isNaN(originalTimestamp)) return;
          if (target.classList.contains('edit-history-modal')) {
              showEditModal(trackerId, originalTimestamp);
          } else if (target.classList.contains('delete-history')) {
              deleteHistoryEntry(trackerId, originalTimestamp);
          }
      });

      calculateRates(trackerId);
      updateRemoveButtonsVisibility();
      console.log(`Added tracker ${trackerId} with title "${initialTitle}"`);
  }

  // --- LocalStorage Functions ---
  function saveDataToLocalStorage() {
      Object.keys(trackersData).forEach(id => {
          const trackerElement = getTrackerElement(id);
          if (trackerElement) {
              const titleInput = trackerElement.querySelector('.tracker-title');
              if (titleInput && trackersData[id]) { trackersData[id].title = titleInput.value.trim(); }
          }
      });
      const dataToSave = { trackers: trackersData, nextId: nextTrackerId };
      try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
      } catch (e) {
          console.error("Failed to save data to localStorage:", e);
          alert("データの保存に失敗しました。");
      }
  }

  function loadDataFromLocalStorage() {
      console.log("Attempting to load data from localStorage...");
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedData) {
          try {
              const parsedData = JSON.parse(savedData);
              if (parsedData && typeof parsedData.trackers === 'object' && typeof parsedData.nextId === 'number') {
                  trackersContainer.innerHTML = ''; trackersData = {};
                  Object.keys(parsedData.trackers).forEach(id => {
                      const tracker = parsedData.trackers[id];
                      if (tracker && typeof tracker.title === 'string' && Array.isArray(tracker.history)) {
                          addTracker(tracker);
                      } else { console.warn(`Skipping invalid tracker data in storage for ID ${id}`); }
                  });
                  nextTrackerId = parsedData.nextId;
                  console.log("Data loaded successfully from localStorage.");
                  return true;
              } else {
                  console.warn("Loaded data format incorrect. Using default.");
                  localStorage.removeItem(LOCAL_STORAGE_KEY);
              }
          } catch (e) {
              console.error("Failed to parse localStorage data:", e);
              localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
      } else { console.log("No data found in localStorage."); }
      return false;
  }

  // --- Sharing Functions ---
  function generateShareUrl() {
      Object.keys(trackersData).forEach(id => {
          const el = getTrackerElement(id);
          if (el) { const titleInput = el.querySelector('.tracker-title'); if (titleInput && trackersData[id]) trackersData[id].title = titleInput.value.trim(); }
      });
      const dataToShare = { trackers: trackersData };
      try {
          const jsonString = JSON.stringify(dataToShare);
          const encodedData = encodeURIComponent(jsonString);
          return `${window.location.origin}${window.location.pathname}?data=${encodedData}`;
      } catch (e) { console.error("Failed to generate share URL:", e); return null; }
  }

  function handleShareUrl() {
      const urlParams = new URLSearchParams(window.location.search);
      const encodedData = urlParams.get('data');
      if (encodedData) {
          console.log("Shared data detected.");
          let parsedData;
          try {
              const jsonString = decodeURIComponent(encodedData);
              parsedData = JSON.parse(jsonString);
              if (!parsedData || typeof parsedData.trackers !== 'object') throw new Error("Invalid structure.");
          } catch (e) {
              console.error("Failed to decode/parse shared data:", e);
              alert(e instanceof URIError ? "URL形式エラー。" : "共有データ形式エラー。");
              history.replaceState(null, '', window.location.pathname); return false;
          }
          if (confirm("共有データが見つかりました。上書きしますか？")) {
              localStorage.removeItem(LOCAL_STORAGE_KEY);
              trackersContainer.innerHTML = ''; trackersData = {}; nextTrackerId = 0;
              Object.keys(parsedData.trackers).forEach(id => {
                  const tracker = parsedData.trackers[id];
                  if (tracker && typeof tracker.title === 'string' && Array.isArray(tracker.history)) { addTracker(tracker); }
                  else { console.warn(`Skipping invalid shared tracker data for ID ${id}`); }
              });
              const maxId = Object.keys(trackersData).reduce((max, idStr) => Math.max(max, parseInt(idStr, 10)), -1);
              nextTrackerId = maxId + 1;
              saveDataToLocalStorage(); console.log("Shared data loaded.");
          } else { console.log("Overwrite cancelled."); }
          history.replaceState(null, '', window.location.pathname); return true;
      }
      return false;
  }

  // --- Edit Modal Functions ---
  function showEditModal(trackerId, originalTimestamp) {
      const data = trackersData[trackerId]; if (!data) return;
      const entry = data.history.find(e => e.time === originalTimestamp); if (!entry) { alert('履歴が見つかりません。'); return; }
      modalTrackerIdInput.value = trackerId; modalOriginalTimestampInput.value = originalTimestamp;
      modalEditCountInput.value = entry.count;
      const date = new Date(entry.time);
      const month = (date.getMonth() + 1).toString().padStart(2, '0'); const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0'); const minutes = date.getMinutes().toString().padStart(2, '0');
      modalEditTimeInput.value = `${date.getFullYear()}-${month}-${day}T${hours}:${minutes}`;
      modalBackdrop.style.display = 'block'; editModal.style.display = 'block'; modalEditTimeInput.focus();
  }

  function hideEditModal() {
      modalBackdrop.style.display = 'none'; editModal.style.display = 'none';
      modalTrackerIdInput.value = ''; modalOriginalTimestampInput.value = '';
  }

  // --- Compare Modal Functions ---
  function populateCompareDropdowns() {
      compareTracker1Select.innerHTML = ''; // Clear previous options
      compareTracker2Select.innerHTML = '';
      const defaultOption = document.createElement('option');
      defaultOption.value = ""; defaultOption.textContent = "-- トラッカーを選択 --"; defaultOption.disabled = true; defaultOption.selected = true;
      compareTracker1Select.appendChild(defaultOption.cloneNode(true));
      compareTracker2Select.appendChild(defaultOption.cloneNode(true));

      const trackerIds = Object.keys(trackersData);
      if (trackerIds.length < 2) {
          updateElementText(compareErrorElement, "比較するにはトラッカーが2つ以上必要です。");
          return false; // Not enough trackers to compare
      }

      trackerIds.forEach(id => {
          const option = document.createElement('option');
          option.value = id;
          option.textContent = trackersData[id].title || `トラッカー ${Number(id) + 1}`;
          compareTracker1Select.appendChild(option.cloneNode(true));
          compareTracker2Select.appendChild(option.cloneNode(true));
      });
      return true; // Enough trackers found
  }

  function showCompareModal() {
      updateElementText(compareErrorElement, ""); // Clear previous errors
      comparisonSection.style.display = 'none'; // Hide previous results
      const canCompare = populateCompareDropdowns();
      if (canCompare) {
          compareModalBackdrop.style.display = 'block';
          compareModal.style.display = 'block';
      } else {
          alert("比較するには、有効なトラッカーが2つ以上必要です。");
      }
  }

  function hideCompareModal() {
      compareModalBackdrop.style.display = 'none';
      compareModal.style.display = 'none';
  }

  /**
   * Calculates the current rate per hour based on the last two points.
   * Returns 0 if less than 2 points or interval is too short.
   * @param {object} data - Tracker data object.
   * @returns {number} Rate per hour.
   */
  function getCurrentRate(data) {
      if (!data || data.history.length < 2) { return 0; }
      const history = [...data.history].sort((a,b) => a.time - b.time); // Ensure sorted copy
      const latest = history[history.length - 1];
      const previous = history[history.length - 2];
      const countDiff = latest.count - previous.count;
      const timeDiffMs = latest.time - previous.time;
      if (timeDiffMs < 100) { return 0; } // Avoid division by zero / too small interval (0.1 sec)
      const timeDiffMinutes = timeDiffMs / (1000 * 60);
      return (countDiff / timeDiffMinutes) * 60; // Rate per hour
  }

  /**
   * Runs the comparison logic and updates the results display and graph.
   */
  function runComparison() {
      const id1 = compareTracker1Select.value;
      const id2 = compareTracker2Select.value;

      updateElementText(compareErrorElement, ""); // Clear previous errors

      // Validation
      if (!id1 || !id2) { updateElementText(compareErrorElement, "トラッカーを2つ選択してください。"); return; }
      if (id1 === id2) { updateElementText(compareErrorElement, "異なるトラッカーを選択してください。"); return; }

      const data1 = trackersData[id1];
      const data2 = trackersData[id2];

      if (!data1 || !data2) { updateElementText(compareErrorElement, "選択されたトラッカーのデータが見つかりません。"); return; }
      if (data1.history.length < 2 || data2.history.length < 2) { updateElementText(compareErrorElement, "両方のトラッカーに履歴が2件以上必要です。"); return; }

      // Calculate current rates and get latest counts
      const rate1 = getCurrentRate(data1);
      const rate2 = getCurrentRate(data2);
      const count1 = data1.history[data1.history.length - 1].count;
      const count2 = data2.history[data2.history.length - 1].count;
      const title1 = data1.title || `トラッカー ${Number(id1) + 1}`;
      const title2 = data2.title || `トラッカー ${Number(id2) + 1}`;

      let analysisText = "";

      // Comparison Logic
      if (Math.abs(rate1 - rate2) < 0.01) { // Consider rates effectively equal if very close
          analysisText = `「${title1}」と「${title2}」は現在ほぼ同じペースです。`;
          if (rate1 <= 0) analysisText += " (ペース停滞中または低下中)";
      } else if (rate1 > rate2) {
          analysisText = `「${title1}」の方が早いです (約 ${formatNumber(rate1 - rate2)} pt/時間)。`;
          if (count1 < count2) {
              if (rate1 - rate2 > 0) {
                  const countDiff = count2 - count1;
                  const rateDiff = rate1 - rate2;
                  const timeToOvertakeHours = countDiff / rateDiff;
                  analysisText += ` 約 ${formatDuration(timeToOvertakeHours)} 後に「${title1}」が追いつきます。`;
              } else {
                  analysisText += ` しかし、「${title1}」のペースでは追いつけません。`;
              }
          } else {
              analysisText += ` 現在リードしており、差は開いています。`;
          }
      } else { // rate2 > rate1
          analysisText = `「${title2}」の方が早いです (約 ${formatNumber(rate2 - rate1)} pt/時間)。`;
          if (count2 < count1) {
               if (rate2 - rate1 > 0) {
                  const countDiff = count1 - count2;
                  const rateDiff = rate2 - rate1;
                  const timeToOvertakeHours = countDiff / rateDiff;
                  analysisText += ` 約 ${formatDuration(timeToOvertakeHours)} 後に「${title2}」が追いつきます。`;
               } else {
                   analysisText += ` しかし、「${title2}」のペースでは追いつけません。`;
               }
          } else {
               analysisText += ` 現在リードしており、差は開いています。`;
          }
      }

      // Display Text Results
      updateElementText(comparisonTextResults, analysisText);

      // Prepare and Render Graph
      const datasets = [
          {
              label: title1,
              data: data1.history.map(entry => ({ x: entry.time, y: entry.count })),
              borderColor: 'rgb(75, 192, 192)', // Teal
              tension: 0.1,
              fill: false
          },
          {
              label: title2,
              data: data2.history.map(entry => ({ x: entry.time, y: entry.count })),
              borderColor: 'rgb(255, 99, 132)', // Red
              tension: 0.1,
              fill: false
          }
      ];
      renderComparisonChart(datasets);

      // Show results and hide modal
      comparisonSection.style.display = 'block';
      hideCompareModal();
       // Scroll to results (optional)
       comparisonSection.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Renders the comparison chart using Chart.js.
   * @param {Array} datasets - Array of dataset objects for Chart.js.
   */
  function renderComparisonChart(datasets) {
      if (!comparisonChartCanvas) { console.error("Chart canvas not found!"); return; }
      const ctx = comparisonChartCanvas.getContext('2d');

      // Destroy previous chart instance if it exists
      if (comparisonChartInstance) {
          comparisonChartInstance.destroy();
          comparisonChartInstance = null; // Clear reference
          console.log("Previous chart instance destroyed.");
      }

      // Chart.js configuration
      const config = {
          type: 'line',
          data: { datasets: datasets },
          options: {
              responsive: true,
              maintainAspectRatio: false, // Allow chart to fill container height
              scales: {
                  x: {
                      type: 'time', // Use time scale
                      time: {
                          // tooltipFormat: 'PPpp', // Example format from date-fns
                          unit: 'minute', // Adjust unit based on data range if needed
                           displayFormats: {
                               minute: 'HH:mm', // Format for labels
                               hour: 'HH:mm'
                           }
                      },
                      title: {
                          display: true,
                          text: '時刻'
                      }
                  },
                  y: {
                      beginAtZero: true, // Start y-axis at 0
                      title: {
                          display: true,
                          text: 'ポイント数'
                      }
                  }
              },
              plugins: {
                  tooltip: {
                      mode: 'index',
                      intersect: false
                  },
                  legend: {
                      position: 'top',
                  }
              },
              animation: {
                  duration: 500 // Slight animation
              }
          }
      };

      // Create new chart instance
      try {
           comparisonChartInstance = new Chart(ctx, config);
           console.log("Comparison chart rendered.");
      } catch(e) {
           console.error("Error rendering chart:", e);
           updateElementText(comparisonTextResults, analysisText + "\n\nグラフの描画に失敗しました。");
      }

  }


  // --- Initialization Code ---
  const sharedDataHandled = handleShareUrl();
  if (!sharedDataHandled) {
      const loaded = loadDataFromLocalStorage();
      if (!loaded && Object.keys(trackersData).length === 0) {
          addTracker();
      }
  }

  // --- Global Event Listeners ---
  addTrackerButton.addEventListener('click', () => { addTracker(); saveDataToLocalStorage(); });
  shareButton.addEventListener('click', () => { /* ... share logic ... */
      const url = generateShareUrl();
      if (url) {
          navigator.clipboard.writeText(url).then(() => {
              const originalTooltip = shareButton.getAttribute('data-tooltip');
              shareButton.setAttribute('data-tooltip', 'コピーしました!');
              setTimeout(() => { shareButton.setAttribute('data-tooltip', originalTooltip); }, 1500);
          }).catch(err => { console.error('Failed to copy URL: ', err); alert('コピー失敗'); });
      } else { alert('URL生成失敗'); }
  });

  // Edit Modal Listeners
  modalSaveButton.addEventListener('click', () => {
      const trackerId = modalTrackerIdInput.value;
      const originalTimestamp = parseInt(modalOriginalTimestampInput.value, 10);
      const newTimeValue = modalEditTimeInput.value;
      const newCountValue = modalEditCountInput.value;
      if (!trackerId || isNaN(originalTimestamp)) { alert('編集情報エラー'); return; }
      if (!newTimeValue) { alert('有効日時必須'); modalEditTimeInput.focus(); return; }
      const newCount = parseInt(newCountValue, 10);
      if (isNaN(newCount) || newCount < 0) { alert('ポイント数エラー'); modalEditCountInput.focus(); return; }
      try {
          const newTimestamp = new Date(newTimeValue).getTime();
          if (isNaN(newTimestamp)) throw new Error('Invalid Date');
          const data = trackersData[trackerId];
          if (data) {
              const entryIndex = data.history.findIndex(entry => entry.time === originalTimestamp);
              if (entryIndex !== -1) {
                  data.history[entryIndex].time = newTimestamp;
                  data.history[entryIndex].count = newCount;
                  hideEditModal();
                  calculateRates(trackerId);
                  saveDataToLocalStorage();
              } else { alert('履歴更新エラー'); hideEditModal(); }
          } else { alert('トラッカーデータエラー'); hideEditModal(); }
      } catch (error) { alert('日時形式/更新エラー'); }
  });
  modalCancelButton.addEventListener('click', hideEditModal);
  modalBackdrop.addEventListener('click', hideEditModal);

  // Compare Modal Listeners
  compareButton.addEventListener('click', showCompareModal);
  compareModalCancelButton.addEventListener('click', hideCompareModal);
  compareModalBackdrop.addEventListener('click', hideCompareModal);
  runComparisonButton.addEventListener('click', runComparison);


  console.log("Script initialization complete.");
}); // End of DOMContentLoaded listener