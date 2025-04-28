document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM Loaded. Initializing script...");

  // --- Global Element References ---
  const trackersContainer = document.getElementById('trackers-container');
  const addTrackerButton = document.getElementById('add-tracker');
  const shareButton = document.getElementById('share-button');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const editModal = document.getElementById('edit-modal');
  const modalTrackerIdInput = document.getElementById('modal-tracker-id');
  const modalOriginalTimestampInput = document.getElementById('modal-original-timestamp');
  const modalEditTimeInput = document.getElementById('modal-edit-time');
  const modalEditCountInput = document.getElementById('modal-edit-count');
  const modalSaveButton = document.getElementById('modal-save-button');
  const modalCancelButton = document.getElementById('modal-cancel-button');

  // --- Global State ---
  const LOCAL_STORAGE_KEY = 'trackerData_v3'; // Updated key for structural changes
  let trackersData = {}; // In-memory store for tracker data
  let nextTrackerId = 0; // Counter for assigning unique tracker IDs

  // --- Utility Functions ---
  function formatNumber(num) {
    // Format to 2 decimal places if it has decimals, otherwise show as integer
    return Number.isInteger(num) ? num : num.toFixed(2);
  }

  function formatTime(timestamp) {
      // Formats time as HH:mm:ss for display in history
      return new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function getTrackerElement(trackerId) {
      // Helper to get the DOM element for a specific tracker
      return document.getElementById(`tracker-${trackerId}`);
  }

  function updateElementText(element, text) {
      // Safely update text content of an element
      if (element) element.textContent = text;
  }

  function updateElementHTML(element, html) {
      // Safely update inner HTML of an element
      if (element) element.innerHTML = html;
  }

  // --- Core Logic Functions ---

  /**
   * Calculates rates (per minute, per hour) and estimated time remaining for a tracker.
   * Also updates the history display for the tracker.
   * Assumes data.history is sorted by time ascending.
   * @param {string|number} trackerId - The ID of the tracker to calculate for.
   */
  function calculateRates(trackerId) {
      const data = trackersData[trackerId];
      if (!data) {
          console.warn(`calculateRates called for non-existent trackerId: ${trackerId}`);
          return;
      }

      const trackerElement = getTrackerElement(trackerId);
      if (!trackerElement) {
           console.warn(`calculateRates called but tracker element not found for ID: ${trackerId}`);
           return; // Exit if the tracker element isn't in the DOM
      }

      // Get references to display elements within the specific tracker
      const ratePerMinElement = trackerElement.querySelector('.rate-per-min');
      const ratePerHourElement = trackerElement.querySelector('.rate-per-hour');
      const timeRemainingElement = trackerElement.querySelector('.time-remaining');
      const historyElement = trackerElement.querySelector('.history');
      const errorElement = trackerElement.querySelector('.error-message');

      // *** CRITICAL: Ensure history is sorted by time BEFORE any calculation or rendering ***
      // Although sorting happens before calling this in most cases, it's safest here too.
      data.history.sort((a, b) => a.time - b.time);

      // Reset display elements to default/empty states
      updateElementText(errorElement, '');
      updateElementHTML(ratePerMinElement, `<span class="latex-num">---</span><span class="unit">pt/分</span>`);
      updateElementHTML(ratePerHourElement, `<span class="latex-num">---</span><span class="unit">pt/時間</span>`);
      updateElementText(timeRemainingElement, '');

      // Update history display (generate HTML for history entries)
      historyElement.innerHTML = '履歴:<br>' + data.history.map(entry => `
          <div class="history-entry" data-timestamp="${entry.time}">
              <span class="history-display">
                  ${formatTime(entry.time)}: <span class="latex-num">${entry.count}</span> pt
              </span>
              <div class="history-controls">
                  <button class="edit-history-modal" title="この履歴を編集">✎</button>
                  <button class="delete-history" title="この履歴を削除">×</button>
              </div>
          </div>`).reverse().join(''); // Reverse to show latest entry first

      // Rate Calculation Logic
      if (data.history.length < 2) {
          updateElementText(errorElement, data.history.length === 1 ? 'レート計算には履歴が2件以上必要です' : '');
          return; // Need at least two points
      }

      const latest = data.history[data.history.length - 1];
      const previous = data.history[data.history.length - 2];

      const countDiff = latest.count - previous.count;
      const timeDiffMs = latest.time - previous.time;
      const timeDiffMinutes = timeDiffMs / (1000 * 60); // Time difference in minutes

      // Basic validation for time difference
      if (timeDiffMinutes <= (1 / 600)) { // Check for intervals less than 0.1 seconds
          updateElementText(errorElement, 'エラー: 計測間隔が短すぎます。');
          // Reset rates if interval is too small to be meaningful
          updateElementHTML(ratePerMinElement, `<span class="latex-num">---</span><span class="unit">pt/分</span>`);
          updateElementHTML(ratePerHourElement, `<span class="latex-num">---</span><span class="unit">pt/時間</span>`);
          return;
      }
      if (countDiff < 0) {
           // Display a warning if points decreased, but still calculate rate
          updateElementText(errorElement, '注意: ポイント数が減少しました。');
      }

      // Calculate rates
      const ratePerMinute = countDiff / timeDiffMinutes;
      const ratePerHour = ratePerMinute * 60;

      // Update rate display elements
      updateElementHTML(ratePerMinElement, `<span class="latex-num">${formatNumber(ratePerMinute)}</span><span class="unit">pt/分</span>`);
      updateElementHTML(ratePerHourElement, `<span class="latex-num">${formatNumber(ratePerHour)}</span><span class="unit">pt/時間</span>`);

      // Calculate and display time remaining if target is set
      if (data.target !== null && typeof data.target === 'number' && data.target >= 0) {
           if (data.target <= latest.count) {
               updateElementText(timeRemainingElement, `目標 (${data.target}pt) 達成済み！`);
           } else if (ratePerHour > 0) {
              // Only calculate remaining time if rate is positive
              const remainingCount = data.target - latest.count;
              const remainingHours = remainingCount / ratePerHour;
              const totalMinutes = Math.ceil(remainingHours * 60); // Round up to nearest minute

              const hours = Math.floor(totalMinutes / 60);
              const minutes = totalMinutes % 60;
              updateElementText(timeRemainingElement, `目標 (${data.target}pt) まで: あと 約 ${hours} 時間 ${minutes} 分`);
          } else {
              // Handle cases where rate is zero or negative
              updateElementText(timeRemainingElement, `目標 (${data.target}pt) まで: (ペース低下中または停止中)`);
          }
      } else {
          // Clear remaining time if no valid target is set
          updateElementText(timeRemainingElement, '');
      }
  }

  /**
   * Records a new count entry for a tracker at the current time.
   * @param {string|number} trackerId - The ID of the tracker.
   */
  function recordData(trackerId) {
      const data = trackersData[trackerId];
      if (!data) return;
      const trackerElement = getTrackerElement(trackerId);
      if (!trackerElement) return;

      const countInput = trackerElement.querySelector('.count-input');
      const errorElement = trackerElement.querySelector('.error-message');
      const count = parseInt(countInput.value, 10);

      updateElementText(errorElement, ''); // Clear previous error message

      // Validate the input count
      if (isNaN(count) || count < 0) {
          updateElementText(errorElement, '有効な数値を入力してください。');
          return;
      }

      // Add the new entry to the history array
      data.history.push({ count: count, time: Date.now() }); // Use current timestamp
      countInput.value = ''; // Clear the input field
      calculateRates(trackerId); // Recalculate and update display
      saveDataToLocalStorage(); // Persist changes
  }

  /**
   * Updates the target value for a tracker.
   * @param {string|number} trackerId - The ID of the tracker.
   */
  function updateTarget(trackerId) {
      const data = trackersData[trackerId];
       if (!data) return;
      const trackerElement = getTrackerElement(trackerId);
      if (!trackerElement) return;

      const targetInput = trackerElement.querySelector('.target-input');
      const targetValue = targetInput.value;

      // Update target in data, setting to null if input is empty or invalid
      if (targetValue === '' || targetValue === null) {
          data.target = null;
      } else {
          const target = parseInt(targetValue, 10);
          if (!isNaN(target) && target >= 0) {
              data.target = target;
          } else {
              data.target = null; // Reset target if input is invalid
              targetInput.value = ''; // Clear the invalid input from the field
          }
      }
      calculateRates(trackerId); // Recalculate (mainly for time remaining)
      saveDataToLocalStorage(); // Persist changes
  }

   /**
    * Updates the title of a tracker.
    * @param {string|number} trackerId - The ID of the tracker.
    * @param {string} newTitle - The new title text.
    */
   function updateTitle(trackerId, newTitle) {
      const data = trackersData[trackerId];
      if (data) {
          data.title = newTitle.trim(); // Store trimmed title
          // No need to recalculate rates, just save
          saveDataToLocalStorage();
      }
   }

  /**
   * Deletes a specific history entry from a tracker.
   * @param {string|number} trackerId - The ID of the tracker.
   * @param {number} timestamp - The timestamp (ms) of the entry to delete.
   */
  function deleteHistoryEntry(trackerId, timestamp) {
      const data = trackersData[trackerId];
      if (!data) return;

      const timeNum = Number(timestamp); // Ensure timestamp is a number
      const initialLength = data.history.length;
      data.history = data.history.filter(entry => entry.time !== timeNum); // Filter out the entry

      if (data.history.length < initialLength) {
          console.log(`Deleted history entry with time ${timeNum} from tracker ${trackerId}`);
          calculateRates(trackerId); // Recalculate and update display
          saveDataToLocalStorage(); // Persist changes
      } else {
           console.warn(`History entry with time ${timeNum} not found for deletion in tracker ${trackerId}`);
      }
  }

  /**
   * Removes a tracker completely from the UI and data.
   * @param {string|number} trackerId - The ID of the tracker to remove.
   */
  function removeTracker(trackerId) {
      const trackerElement = getTrackerElement(trackerId);
      if (trackerElement) {
          trackerElement.remove(); // Remove from DOM
      }
      delete trackersData[trackerId]; // Remove from in-memory data
      console.log(`Removed tracker ${trackerId}`);
      saveDataToLocalStorage(); // Persist changes
      updateRemoveButtonsVisibility(); // Adjust visibility of remaining remove buttons
  }

   /**
    * Updates the visibility of remove buttons on all trackers.
    * The button is hidden if only one tracker remains.
    */
   function updateRemoveButtonsVisibility() {
       const remainingTrackers = trackersContainer.querySelectorAll('.tracker');
       const visible = remainingTrackers.length > 1; // Show only if more than one tracker exists
       remainingTrackers.forEach(tracker => {
           const removeButton = tracker.querySelector('.remove-tracker');
           if (removeButton) {
               removeButton.style.display = visible ? 'inline-block' : 'none';
           }
       });
   }

  /**
   * Adds a new tracker element to the UI and initializes its data.
   * Can optionally populate it with initial data (used when loading).
   * @param {object|null} initialData - Optional data to initialize the tracker with {title, history, target}.
   */
  function addTracker(initialData = null) {
      const trackerId = nextTrackerId++; // Assign the next available ID
      const initialTitle = initialData?.title || `トラッカー ${trackerId + 1}`;
      const initialHistory = initialData?.history || [];
      const initialTarget = initialData?.target ?? null;

      // Initialize data for this tracker in the global store
      trackersData[trackerId] = {
          title: initialTitle,
          history: initialHistory.map(h => ({ count: Number(h.count), time: Number(h.time) })), // Ensure types are correct
          target: initialTarget !== null ? Number(initialTarget) : null // Ensure target is number or null
      };

      // Create the main tracker div element
      const trackerDiv = document.createElement('div');
      trackerDiv.classList.add('tracker');
      trackerDiv.id = `tracker-${trackerId}`;

      // Set the inner HTML structure for the tracker
      trackerDiv.innerHTML = `
          <h3>
              <input type="text" value="${initialTitle.replace(/"/g, '&quot;')}" class="tracker-title" placeholder="名前 (例: 自分)" data-tracker-id="${trackerId}">
              <button class="remove-tracker" title="このトラッカーを削除" data-tracker-id="${trackerId}">×</button>
          </h3>
          <div class="input-group">
              <label for="count-${trackerId}">現在:</label>
              <input type="number" id="count-${trackerId}" class="count-input" placeholder="ポイント数" min="0" step="1">
              <button class="record-button" data-tracker-id="${trackerId}">記録</button>
          </div>
           <div class="input-group">
              <label for="target-${trackerId}">目標:</label>
              <input type="number" id="target-${trackerId}" class="target-input" placeholder="任意" min="0" step="1" value="${initialTarget !== null ? initialTarget : ''}">
          </div>
          <div class="results">
              <span class="rate-per-min"><span class="latex-num">---</span><span class="unit">pt/分</span></span>
              <span class="rate-per-hour"><span class="latex-num">---</span><span class="unit">pt/時間</span></span>
          </div>
          <div class="time-remaining"></div>
          <div class="error-message error"></div>
          <div class="info-message"></div>
          <div class="history">履歴:<br></div>
      `;

      trackersContainer.appendChild(trackerDiv); // Add the new tracker to the container

      // --- Add event listeners for the controls within this tracker ---
      const trackerTitleInput = trackerDiv.querySelector('.tracker-title');
      const countInput = trackerDiv.querySelector('.count-input');
      const recordButton = trackerDiv.querySelector('.record-button');
      const targetInput = trackerDiv.querySelector('.target-input');
      const removeButton = trackerDiv.querySelector('.remove-tracker');
      const historyDiv = trackerDiv.querySelector('.history');

      // Use 'input' for immediate feedback, 'change' as fallback/on blur
      trackerTitleInput.addEventListener('input', (e) => updateTitle(trackerId, e.target.value));
      trackerTitleInput.addEventListener('change', (e) => updateTitle(trackerId, e.target.value));

      recordButton.addEventListener('click', () => recordData(trackerId));
      // Allow recording on Enter key press in the count input
      countInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') recordData(trackerId); });

      // Update target on input or change
      targetInput.addEventListener('input', () => updateTarget(trackerId));
      targetInput.addEventListener('change', () => updateTarget(trackerId));

      removeButton.addEventListener('click', () => removeTracker(trackerId));

      // Event delegation for history controls (edit modal trigger, delete)
      historyDiv.addEventListener('click', (e) => {
          const target = e.target;
          const entryDiv = target.closest('.history-entry');
          if (!entryDiv) return;

          const originalTimestamp = parseInt(entryDiv.getAttribute('data-timestamp'), 10);
          if (isNaN(originalTimestamp)) return;

          // Handle Edit Button Click (Show Modal)
          if (target.classList.contains('edit-history-modal')) {
               showEditModal(trackerId, originalTimestamp);
          }
          // Handle Delete Button Click
          else if (target.classList.contains('delete-history')) {
              // Optional: Confirmation dialog
              // if (confirm('この履歴を削除しますか？')) {
                  deleteHistoryEntry(trackerId, originalTimestamp);
              // }
          }
      });

      // Initial calculation and update remove button visibility
      calculateRates(trackerId);
      updateRemoveButtonsVisibility();
      // If added from loaded data, ensure it's saved (in case of minor corrections during load)
      // if (initialData) {
      //     saveDataToLocalStorage();
      // }
       console.log(`Added tracker ${trackerId} with title "${initialTitle}"`);
  }

  // --- LocalStorage Functions ---

  /**
   * Saves the current state of all trackers (trackersData) and the next ID counter
   * to the browser's localStorage.
   */
  function saveDataToLocalStorage() {
      // Ensure latest titles are captured from input fields before saving
      Object.keys(trackersData).forEach(id => {
          const trackerElement = getTrackerElement(id);
          if (trackerElement) {
              const titleInput = trackerElement.querySelector('.tracker-title');
               if (titleInput && trackersData[id]) { // Check if data still exists
                  trackersData[id].title = titleInput.value.trim();
              }
          } else {
              // If tracker element doesn't exist, remove data (consistency check)
              // This might happen if removal failed partially, though unlikely
              // console.warn(`Tracker element for ID ${id} not found during save, removing data.`);
              // delete trackersData[id];
          }
      });

      const dataToSave = {
           trackers: trackersData,
           nextId: nextTrackerId // Persist the next ID to avoid reuse after reload
      };
      try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
          // console.log("Data saved to localStorage."); // Can be noisy, uncomment for debugging
      } catch (e) {
          console.error("Failed to save data to localStorage:", e);
          alert("データの保存に失敗しました。ストレージ容量が不足している可能性があります。");
      }
  }

  /**
   * Loads tracker data from localStorage and repopulates the UI.
   * Returns true if data was loaded successfully, false otherwise.
   */
  function loadDataFromLocalStorage() {
      console.log("Attempting to load data from localStorage...");
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedData) {
          try {
              const parsedData = JSON.parse(savedData);
              // Validate the structure of the loaded data
              if (parsedData && typeof parsedData.trackers === 'object' && typeof parsedData.nextId === 'number') {

                  trackersContainer.innerHTML = ''; // Clear existing UI elements
                  trackersData = {}; // Reset in-memory data store

                  // Load trackers from the parsed data
                  Object.keys(parsedData.trackers).forEach(id => {
                       const tracker = parsedData.trackers[id];
                       // Perform basic sanity check on loaded tracker data
                       if (tracker && typeof tracker.title === 'string' && Array.isArray(tracker.history)) {
                          addTracker(tracker); // Recreate tracker UI and data
                       } else {
                            console.warn(`Skipping invalid tracker data found in storage for ID ${id}`);
                       }
                  });
                  nextTrackerId = parsedData.nextId; // Restore the ID counter
                  console.log("Data loaded successfully from localStorage.");
                  return true; // Indicate successful load
              } else {
                   console.warn("Loaded data format is incorrect. Using default state.");
                   localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupted data
              }
          } catch (e) {
              console.error("Failed to parse data from localStorage:", e);
              localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear potentially corrupted data
          }
      } else {
           console.log("No data found in localStorage.");
      }
      return false; // Indicate data was not loaded
  }

  // --- Sharing Functions ---

  /**
   * Generates a shareable URL containing the current tracker data.
   * @returns {string|null} The generated URL or null if an error occurs.
   */
  function generateShareUrl() {
      // Ensure latest titles are captured before generating URL
      Object.keys(trackersData).forEach(id => {
           const trackerElement = getTrackerElement(id);
           if (trackerElement) {
               const titleInput = trackerElement.querySelector('.tracker-title');
               if (titleInput && trackersData[id]) {
                   trackersData[id].title = titleInput.value.trim();
               }
           }
       });

      const dataToShare = {
          trackers: trackersData,
          // Note: nextId is not typically shared, only used locally
      };

      try {
          const jsonString = JSON.stringify(dataToShare);
          // Use encodeURIComponent for reliable URL encoding of the JSON string
          const encodedData = encodeURIComponent(jsonString);
          const url = `${window.location.origin}${window.location.pathname}?data=${encodedData}`;
          return url;
      } catch (e) {
          console.error("Failed to generate share URL:", e);
          return null;
      }
  }

  /**
   * Checks for shared data in the URL parameters on page load.
   * If found, prompts the user to import it, replacing current data.
   * Returns true if shared data was found (regardless of import choice), false otherwise.
   */
  function handleShareUrl() {
      const urlParams = new URLSearchParams(window.location.search);
      const encodedData = urlParams.get('data'); // Get the 'data' parameter

      if (encodedData) {
          console.log("Shared data detected in URL.");
          let jsonString;
          let parsedData;
          try {
              // Decode the percent-encoded data back to JSON string
              jsonString = decodeURIComponent(encodedData);
              // Parse the JSON string into an object
              parsedData = JSON.parse(jsonString);

               // Validate the basic structure of the shared data
               if (!parsedData || typeof parsedData.trackers !== 'object') {
                   throw new Error("Invalid shared data structure.");
               }

          } catch (e) {
              console.error("Failed to decode or parse shared data:", e);
              if (e instanceof URIError) {
                   alert("共有データの読み込みに失敗しました。URLの形式が正しくない可能性があります。");
              } else {
                   alert("共有データの読み込みに失敗しました。データが破損しているか、形式が違う可能性があります。");
              }
              // Clean the potentially problematic URL parameter and proceed
              history.replaceState(null, '', window.location.pathname);
              return false; // Indicate failure to process shared data
          }

          // Ask user for confirmation to overwrite existing data
          const proceed = confirm("共有されたデータが見つかりました。\n現在のデータを上書きして読み込みますか？");

          if (proceed) {
              console.log("User confirmed overwrite.");
              // Clear current state (localStorage, UI, in-memory data)
              localStorage.removeItem(LOCAL_STORAGE_KEY);
              trackersContainer.innerHTML = '';
              trackersData = {};
              nextTrackerId = 0; // Reset ID counter

              // Load data from the shared parameter object
              Object.keys(parsedData.trackers).forEach(id => {
                  const tracker = parsedData.trackers[id];
                   if (tracker && typeof tracker.title === 'string' && Array.isArray(tracker.history)) {
                        addTracker(tracker); // Recreate tracker from shared data
                   } else {
                       console.warn(`Skipping invalid tracker data found in shared URL for ID ${id}`);
                   }
              });
               // Find the highest existing ID from loaded data to safely set nextTrackerId
               // This handles cases where shared data might have non-sequential IDs
               const maxId = Object.keys(trackersData).reduce((max, idStr) => Math.max(max, parseInt(idStr, 10)), -1);
               nextTrackerId = maxId + 1;

              saveDataToLocalStorage(); // Save the newly imported data
              console.log("Shared data loaded and saved.");

          } else {
              console.log("User cancelled overwrite.");
              // Do nothing with the shared data, local data will be loaded next (if any)
          }

          // IMPORTANT: Remove the 'data' parameter from the URL to prevent re-prompting on refresh
          history.replaceState(null, '', window.location.pathname);
          return true; // Indicate shared data was found and processed (or deliberately ignored)
      }
      return false; // Indicate no shared data parameter was found in the URL
  }

  // --- Modal Functions ---

  /**
   * Shows the edit modal populated with data for a specific history entry.
   * @param {string|number} trackerId - The ID of the tracker containing the entry.
   * @param {number} originalTimestamp - The timestamp (ms) of the history entry to edit.
   */
  function showEditModal(trackerId, originalTimestamp) {
      const data = trackersData[trackerId];
      if (!data) {
           console.error(`Data not found for trackerId ${trackerId} in showEditModal`);
           return;
      }

      const entry = data.history.find(e => e.time === originalTimestamp);
      if (!entry) {
          alert('編集対象の履歴が見つかりません。');
          console.error(`History entry not found for timestamp ${originalTimestamp} in tracker ${trackerId}`);
          return;
      }

      // Populate modal fields with current entry data
      modalTrackerIdInput.value = trackerId;
      modalOriginalTimestampInput.value = originalTimestamp;
      modalEditCountInput.value = entry.count;

      // Format timestamp for the datetime-local input field
      const date = new Date(entry.time);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      modalEditTimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;

      // Display the modal and backdrop
      modalBackdrop.style.display = 'block';
      editModal.style.display = 'block';
      modalEditTimeInput.focus(); // Focus the first input field
  }

  /**
   * Hides the edit modal and clears temporary data.
   */
  function hideEditModal() {
      modalBackdrop.style.display = 'none';
      editModal.style.display = 'none';
      // Clear identifier fields to prevent accidental reuse
      modalTrackerIdInput.value = '';
      modalOriginalTimestampInput.value = '';
  }


  // --- Initialization Code ---

  // 1. Handle incoming share URL first
  const sharedDataHandled = handleShareUrl();

  // 2. If shared data wasn't processed (or didn't exist), load from localStorage
  if (!sharedDataHandled) {
      const loaded = loadDataFromLocalStorage();
      // If nothing loaded from storage (e.g., first visit), add one default tracker
      if (!loaded && Object.keys(trackersData).length === 0) {
           console.log("Adding default tracker.");
           addTracker(); // Add one tracker with default settings
           // updateRemoveButtonsVisibility(); // Already called within addTracker
      }
  }

  // --- Global Event Listeners ---

  // Add Tracker Button
  addTrackerButton.addEventListener('click', () => {
       addTracker(); // Add a new tracker with default settings
       saveDataToLocalStorage(); // Save state after adding
   });

  // Share Button
  shareButton.addEventListener('click', () => {
      const url = generateShareUrl();
      if (url) {
          navigator.clipboard.writeText(url).then(() => {
              // Provide feedback to the user (using tooltip)
              const originalTooltip = shareButton.getAttribute('data-tooltip');
              shareButton.setAttribute('data-tooltip', 'コピーしました!');
              // Reset tooltip after a short delay
              setTimeout(() => {
                  shareButton.setAttribute('data-tooltip', originalTooltip);
              }, 1500);
               console.log("Share URL copied to clipboard:", url);
          }).catch(err => {
              console.error('Failed to copy URL: ', err);
              alert('クリップボードへのコピーに失敗しました。');
          });
      } else {
           alert('共有URLの生成に失敗しました。');
      }
  });

  // Modal Save Button
  modalSaveButton.addEventListener('click', () => {
      // Retrieve identifiers for the entry being edited
      const trackerId = modalTrackerIdInput.value;
      const originalTimestamp = parseInt(modalOriginalTimestampInput.value, 10);
      // Get new values from modal inputs
      const newTimeValue = modalEditTimeInput.value;
      const newCountValue = modalEditCountInput.value;

      // Basic validation of identifiers
      if (!trackerId || isNaN(originalTimestamp)) {
           alert('編集情報の取得に失敗しました。モーダルを一度閉じて再度お試しください。');
           return;
      }

      // Validate new Time input
      if (!newTimeValue) {
           alert('有効な日時を入力してください。');
           modalEditTimeInput.focus(); // Focus the problematic field
           return;
      }
      // Validate new Count input
      const newCount = parseInt(newCountValue, 10);
      if (isNaN(newCount) || newCount < 0) {
          alert('ポイント数には0以上の数値を入力してください。');
          modalEditCountInput.focus(); // Focus the problematic field
          return;
      }

      // Try parsing the new date and updating the data
      try {
          const newTimestamp = new Date(newTimeValue).getTime();
          if (isNaN(newTimestamp)) {
              throw new Error('Invalid Date format');
          }

          // Find the corresponding tracker data
          const data = trackersData[trackerId];
          if (data) {
              // Find the specific history entry by its original timestamp
              const entryIndex = data.history.findIndex(entry => entry.time === originalTimestamp);
              if (entryIndex !== -1) {
                  // Update the time and count of the found entry
                  data.history[entryIndex].time = newTimestamp;
                  data.history[entryIndex].count = newCount;
                  console.log(`Updated entry ${originalTimestamp} to time=${newTimestamp}, count=${newCount} in tracker ${trackerId}`);

                  hideEditModal(); // Close the modal on successful save

                  // Recalculate rates for the affected tracker (this includes sorting)
                  calculateRates(trackerId);
                  // Save the updated data to localStorage
                  saveDataToLocalStorage();
              } else {
                  // This case should be rare if the modal was opened correctly
                  console.error('Could not find history entry to update:', originalTimestamp);
                  alert('履歴エントリが見つからず、更新できませんでした。');
                  hideEditModal(); // Close modal even if entry not found
              }
          } else {
               console.error(`Tracker data not found for ID ${trackerId} during modal save.`);
               alert('トラッカーデータの取得に失敗しました。');
               hideEditModal();
          }
      } catch (error) {
          console.error('Error parsing date or updating entry:', error);
          alert('日時の形式が無効か、更新中にエラーが発生しました。入力内容を確認してください。');
          // Keep the modal open for the user to correct the input
      }
  });

  // Modal Cancel Button
  modalCancelButton.addEventListener('click', hideEditModal);

  // Modal Backdrop Click
  modalBackdrop.addEventListener('click', hideEditModal);

  // --- End of Initialization ---
  console.log("Script initialization complete.");
}); // End of DOMContentLoaded listener