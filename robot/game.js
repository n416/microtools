// === game.js (db.js を利用する修正版, 別ファイル構成用) ===

// グローバルスコープにゲームマネージャーオブジェクトを作成
window.gameManager = (() => {
  // --- 定数 ---
  const PARTS = { HEAD: "頭", UPPER: "上半身", LOWER: "下半身" };
  const MANUFACTURERS = ["ジオ", "ツイ", "アナ"];
  const NUM_ROBOTS = 3;
  const NUM_ROUNDS = 3;
  const CARDS_PER_PLAYER = 9; // 頭/上半身/下半身 各3枚
  const PILOT_CARDS_PER_PLAYER = 1;

  // --- ゲーム状態変数 ---
  let gameState = {
    phase: "idle", // idle, preparation, design, battle_selection, battle_resolution, game_over
    currentRound: 0,
    playerScore: 0,
    cpuScore: 0,
    allCardData: {}, // ロードされた全カードデータ (ID -> card)
    battleLog: [], // 対戦履歴 ({ round, playerRobotIndex, cpuRobotIndex, result })
    player: {
      hand: { head: [], upper: [], lower: [] },
      pilotCard: null,
      robots: [], // 設計されたロボット情報 (最大 NUM_ROBOTS 個)
      selectedRobotIndex: -1, // 戦闘で選択したロボット
      hasDesigned: false, // 設計完了フラグ
      selectedCardIdForClick: null, // クリック選択中のカードID
    },
    cpu: {
      hand: { head: [], upper: [], lower: [] },
      pilotCard: null,
      robots: [],
      selectedRobotIndex: -1,
      hasDesigned: false,
    },
    draggedCardData: null, // ドラッグ中のカードデータ
  };

  // --- DOM要素キャッシュ ---
  const elements = {};

  // --- ヘルパー関数 ---

  // 配列をシャッフル (Fisher-Yates algorithm)
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // メッセージ表示
  function showMessage(message, append = false) {
    if (elements.gameMessage) {
      if (append) {
        elements.gameMessage.innerHTML += `<br>${message}`;
      } else {
        elements.gameMessage.textContent = message;
      }
      elements.gameMessageArea?.scrollTo(0, elements.gameMessageArea.scrollHeight);
    } else {
      console.log("Message:", message); // フォールバック
    }
  }

  /**
   * 指定されたIDの画面コンテナを表示し、他の .game-screen を非表示にする。
   * @param {string} screenId 表示したい画面コンテナのID ('design-screen', 'battle-selection-screen', etc.)
   */
  function showScreen(screenId) {
    console.log(`Switching view to: ${screenId}`);
    document.querySelectorAll('.game-screen').forEach(screen => {
      screen.style.display = 'none';
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      if (screenId === 'design-screen') {
        targetScreen.style.display = 'flex'; // 設計画面はFlexbox
      } else {
        targetScreen.style.display = 'block'; // 他はBlock (game.htmlの初期値に合わせる)
      }
      console.log(`Screen ${screenId} displayed.`);
    } else {
      console.error(`Screen element with ID "${screenId}" not found! Cannot display.`);
      showMessage(`エラー: 画面 (${screenId}) が見つかりません。`);
    }
  }

  // ゲーム状態表示更新
  function updateStatusDisplay() {
    if (elements.gamePhase) elements.gamePhase.textContent = `フェイズ: ${translatePhase(gameState.phase)}`;
    if (elements.roundInfo) elements.roundInfo.textContent = `ラウンド: ${gameState.currentRound} / ${NUM_ROUNDS}`;
    if (elements.playerScore) elements.playerScore.textContent = `プレイヤー勝利数: ${gameState.playerScore}`;
    if (elements.cpuScore) elements.cpuScore.textContent = `CPU勝利数: ${gameState.cpuScore}`;
  }

  // フェーズ名を日本語に変換（表示用）
  function translatePhase(phase) {
    switch (phase) {
      case "idle": return "待機中";
      case "preparation": return "準備中";
      case "design": return "設計フェイズ";
      case "battle_selection": return "戦闘ロボット選択";
      case "battle_resolution": return "戦闘解決";
      case "game_over": return "ゲーム終了";
      default: return phase;
    }
  }

  // カードデータからHTML要素を生成 (ゲーム用) - SVG定義を外に出す
  const SVG_STROKE_COLOR = "#6c757d";
  const SVG_FILL_COLOR = "#e9ecef";
  const SVG_STROKE_WIDTH = "1";
  const SVG_ICON_CLASS = "placeholder-icon";
  const SVG_DEFAULT_PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${SVG_STROKE_COLOR}" stroke-width="${SVG_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" class="${SVG_ICON_CLASS}"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
  const SVG_HEAD = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${SVG_STROKE_COLOR}" stroke-width="${SVG_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" class="${SVG_ICON_CLASS}"><path d="M10 4 h4 l1 2 h-6 l1 -2 z" fill="${SVG_FILL_COLOR}"/><path d="M7 5 h10 l1 3 H6 l1 -3 z" fill="${SVG_FILL_COLOR}"/><path d="M6 8 v6 h-2 l-1 0 V9 l1-1 z" fill="${SVG_FILL_COLOR}"/><path d="M17 8 v6 h2 l1 0 V9 l-1 -1 z" fill="${SVG_FILL_COLOR}"/><rect x="7" y="8" width="10" height="8" fill="#ffffff" stroke-width="0.8"/><line x1="7" y1="12" x2="17" y2="12"/><path d="M9 14 h6 v2 H9 z" fill="${SVG_FILL_COLOR}"/><rect x="7.5" y="9" width="4" height="2" fill="${SVG_FILL_COLOR}" stroke-width="0.8"/><rect x="12.5" y="9" width="4" height="2" fill="${SVG_FILL_COLOR}" stroke-width="0.8"/><circle cx="12" cy="6.5" r="0.75" fill="${SVG_FILL_COLOR}" stroke="none"/></svg>`;
  const SVG_UPPER_BODY = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="${SVG_FILL_COLOR}" stroke="${SVG_STROKE_COLOR}" stroke-width="${SVG_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" class="${SVG_ICON_CLASS}"><path d="M5 6 h14 v10 H5 z" stroke-width="1"/> <path d="M5 6 l-3 5 v5 l3 2 z"/> <line x1="3" y1="12" x2="5" y2="15" stroke-width="1"/> <path d="M19 6 l3 5 v5 l-3 2 z"/> <line x1="19" y1="15" x2="21" y2="12" stroke-width="1"/> <path d="M8 8 L5 8 M16 8 L19 8" stroke-width="1"/> <path d="M8 10 L5 10 M16 10 L19 10" stroke-width="1"/> </svg>`;
  const SVG_LOWER_BODY = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="${SVG_FILL_COLOR}" stroke="${SVG_STROKE_COLOR}" stroke-width="${SVG_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" class="${SVG_ICON_CLASS}"><path d="M6 8 h12 v5 H6 z"/> <path d="M6 13 h4 v7 l-2 2 H6 z"/> <line x1="7" y1="17" x2="9" y2="17" stroke-width="1"/> <path d="M18 13 h-4 v7 l2 2 H18 z"/> <line x1="15" y1="17" x2="17" y2="17" stroke-width="1"/> </svg>`;

  function createGameCardElement(cardData, isDraggable = true) {
    // console.log(`[createGameCardElement] Creating element for card ID: ${cardData?.id}`);
    if (!cardData || typeof cardData !== "object" || !cardData.id) {
      console.error("[createGameCardElement] ERROR: Invalid or missing cardData:", cardData);
      return null;
    }

    const cardElement = document.createElement("div");
    cardElement.classList.add("game-card");
    cardElement.dataset.cardId = cardData.id;

    const imageContainer = document.createElement("div");
    imageContainer.classList.add("card-image");
    const infoContainer = document.createElement("div");
    infoContainer.classList.add("card-info");
    let isValidElement = false;

    try {
      // パイロットカード (manufacturerが空文字列または存在しない)
      if (!cardData.manufacturer || cardData.manufacturer === "") {
        if (!cardData.part || ![PARTS.HEAD, PARTS.UPPER, PARTS.LOWER].includes(cardData.part)) {
          console.error(`[createGameCardElement] ERROR: Invalid pilot card ID ${cardData.id} - missing or invalid part: ${cardData.part}`);
          imageContainer.innerHTML = SVG_DEFAULT_PLACEHOLDER;
          infoContainer.innerHTML = `<div class="pilot-effect">(データエラー)</div>`;
          cardElement.classList.add("invalid-card-data");
        } else {
          cardElement.classList.add("pilot-card");
          let svgIcon = ""; let effectText = "";
          switch (cardData.part) {
            case PARTS.HEAD: svgIcon = SVG_HEAD; effectText = "索敵 +1"; break;
            case PARTS.UPPER: svgIcon = SVG_UPPER_BODY; effectText = "攻撃 +1"; break;
            case PARTS.LOWER: svgIcon = SVG_LOWER_BODY; effectText = "防御 +1"; break;
          }
          imageContainer.innerHTML = svgIcon;
          imageContainer.classList.add("placeholder");
          infoContainer.innerHTML = `<div class="pilot-effect">${effectText}</div>`;
          isValidElement = true;
        }
      }
      // 部位カード
      else {
        if (!cardData.part || ![PARTS.HEAD, PARTS.UPPER, PARTS.LOWER].includes(cardData.part) ||
          !cardData.manufacturer || !MANUFACTURERS.includes(cardData.manufacturer) ||
          !cardData.value || !["1", "2", "3"].includes(String(cardData.value))) {
          console.error(`[createGameCardElement] ERROR: Invalid part card ID ${cardData.id} - missing or invalid data:`, cardData);
          imageContainer.innerHTML = SVG_DEFAULT_PLACEHOLDER;
          infoContainer.innerHTML = `<span>(データエラー)</span>`;
          cardElement.classList.add("invalid-card-data");
        } else {
          if (cardData.image) {
            imageContainer.innerHTML = `<img src="${cardData.image}" alt="${cardData.part}">`;
          } else {
            let svgIcon = "";
            switch (cardData.part) {
              case PARTS.HEAD: svgIcon = SVG_HEAD; break;
              case PARTS.UPPER: svgIcon = SVG_UPPER_BODY; break;
              case PARTS.LOWER: svgIcon = SVG_LOWER_BODY; break;
              default: svgIcon = SVG_DEFAULT_PLACEHOLDER; break;
            }
            imageContainer.innerHTML = svgIcon;
            imageContainer.classList.add("placeholder");
          }
          infoContainer.innerHTML = `
                      <span class="part-display">${cardData.part}</span>
                      <span class="manufacturer-display">${cardData.manufacturer}</span>
                      <span class="value-display value-${cardData.value}">${cardData.value}</span>`; // valueクラスも直接付与

          cardElement.classList.remove("manufacturer-geo", "manufacturer-tsui", "manufacturer-ana"); // Reset
          if (cardData.manufacturer === "ジオ") cardElement.classList.add("manufacturer-geo");
          else if (cardData.manufacturer === "ツイ") cardElement.classList.add("manufacturer-tsui");
          else if (cardData.manufacturer === "アナ") cardElement.classList.add("manufacturer-ana");
          isValidElement = true;
        }
      }

      cardElement.appendChild(imageContainer);
      cardElement.appendChild(infoContainer);

      // ドラッグ可能設定
      if (isValidElement && isDraggable) {
        cardElement.draggable = true;
        // リスナー重複登録防止
        cardElement.removeEventListener("dragstart", handleDragStart);
        cardElement.removeEventListener("dragend", handleDragEnd);
        cardElement.addEventListener("dragstart", handleDragStart);
        cardElement.addEventListener("dragend", handleDragEnd);
        cardElement.style.cursor = "grab";
      } else if (isValidElement && !isDraggable) {
        cardElement.draggable = false;
        cardElement.style.cursor = "default"; // クリック可能な場合はハンドラ側で pointer に変更
      } else {
        cardElement.draggable = false;
        cardElement.style.cursor = "not-allowed";
      }
    } catch (error) {
      console.error(`[createGameCardElement] CRITICAL ERROR during element construction for card ID ${cardData?.id}:`, error);
      return null;
    }

    if (isValidElement) {
      return cardElement;
    } else {
      console.error(`[createGameCardElement] Failed to create a valid element for ${cardData.id}. Returning null.`);
      return null;
    }
  }


  // --- ドラッグ＆ドロップハンドラー ---
  function handleDragStart(event) {
    // event.target が .game-card であることを確認
    const cardElement = event.target.closest('.game-card');
    if (!cardElement) return;

    const cardId = cardElement.dataset.cardId;
    // ドラッグ元が手札エリアか確認
    const handArea = cardElement.closest('#player-hand-cards');
    if (!handArea || !gameState.player.hand) return; // 手札エリア以外からはドラッグしない想定

    // gameStateからカードデータを特定する（手札から）
    const cardData = [
      ...(gameState.player.hand.head || []),
      ...(gameState.player.hand.upper || []),
      ...(gameState.player.hand.lower || [])
    ].find(card => card && card.id === cardId);


    if (cardData) {
      gameState.draggedCardData = cardData;
      event.dataTransfer.setData("text/plain", cardId);
      event.dataTransfer.effectAllowed = "move";
      cardElement.classList.add("dragging");
      console.log("Drag Start:", cardData.part, cardData.manufacturer, cardData.value);
    } else {
      console.error("Dragged card data not found in player's hand:", cardId);
      event.preventDefault();
    }
  }

  function handleDragEnd(event) {
    // event.target が存在し、classList を持つか確認
    if (event.target && event.target.classList) {
      event.target.classList.remove("dragging");
    }
    gameState.draggedCardData = null;
    // console.log("Drag End");
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const dropTarget = event.target.closest(".part-slot");
    if (dropTarget) {
      // 部位タイプが一致するかチェック
      if (gameState.draggedCardData && isPartTypeMatch(gameState.draggedCardData, dropTarget.dataset.partType)) {
        dropTarget.classList.add("drag-over");
      } else {
        dropTarget.classList.remove("drag-over"); // 不一致ならハイライト解除
      }
    }
  }

  function handleDragLeave(event) {
    const dropTarget = event.target.closest(".part-slot");
    if (dropTarget) {
      dropTarget.classList.remove("drag-over");
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    const dropTarget = event.target.closest(".part-slot");
    if (dropTarget) {
      dropTarget.classList.remove("drag-over");
      const cardData = gameState.draggedCardData;
      const robotSlotElement = dropTarget.closest(".robot-slot");
      if (!cardData || !robotSlotElement) {
        console.error("Drop failed: Missing card data or parent robot slot.");
        gameState.draggedCardData = null;
        return;
      }
      const robotIndex = parseInt(robotSlotElement.dataset.robotIndex, 10);
      const partType = dropTarget.dataset.partType; // 'head', 'upper', 'lower'

      console.log("Drop detected on:", `Robot ${robotIndex + 1}`, `Slot ${partType}`);

      if (!isNaN(robotIndex) && partType && isPartTypeMatch(cardData, partType)) {
        placeCardOnRobot(robotIndex, partType, cardData, dropTarget);
      } else {
        showMessage("この部位はここには配置できません。", true);
        console.warn("Part type mismatch or invalid drop target.");
      }
    }
    gameState.draggedCardData = null; // ドロップ後クリア
  }

  // 部位タイプとスロットタイプが一致するかチェック
  function isPartTypeMatch(cardData, slotPartType) {
    if (!cardData || !cardData.part) return false;
    const cardPart = cardData.part;
    if (cardPart === PARTS.HEAD && slotPartType === "head") return true;
    if (cardPart === PARTS.UPPER && slotPartType === "upper") return true;
    if (cardPart === PARTS.LOWER && slotPartType === "lower") return true;
    return false;
  }

  // カードをロボットスロットに配置する処理
  function placeCardOnRobot(robotIndex, partType, cardData, dropTargetElement) {
    console.log(`Placing card ${cardData.id} on Robot ${robotIndex + 1}, Slot ${partType}`);

    // 1. 既存カードを手札に戻す
    const existingCard = gameState.player.robots[robotIndex]?.[partType];
    if (existingCard) {
      console.log("Returning existing card to hand:", existingCard.id);
      addCardToPlayerHand(existingCard);
      // クリックリスナー削除 (handleReturnToHandClick で追加されるため)
      const existingCardElement = dropTargetElement.querySelector(".game-card");
      if (existingCardElement) {
        existingCardElement.removeEventListener("click", handleReturnToHandClick);
      }
    }

    // 2. クリック選択解除
    if (gameState.player.selectedCardIdForClick === cardData.id) {
      gameState.player.selectedCardIdForClick = null;
    }

    // 3. ロボットデータ更新
    gameState.player.robots[robotIndex][partType] = cardData;

    // 4. 手札から削除
    removeCardFromPlayerHand(cardData);

    // 5. UI更新: ドロップターゲットにカード要素追加
    dropTargetElement.innerHTML = ""; // クリア
    const cardElement = createGameCardElement(cardData, false); // 配置後はドラッグ不可

    if (cardElement) {
      cardElement.addEventListener("click", handleReturnToHandClick); // 手札に戻すクリックリスナー
      cardElement.style.cursor = "pointer"; // クリック可能カーソル
      dropTargetElement.appendChild(cardElement);
    } else {
      console.error("Failed to create card element in placeCardOnRobot.");
      // エラー時フォールバック
      let placeholderText = "";
      if (partType === "head") placeholderText = "頭";
      else if (partType === "upper") placeholderText = "上半身";
      else if (partType === "lower") placeholderText = "下半身";
      dropTargetElement.textContent = placeholderText;
      // データもロールバック
      gameState.player.robots[robotIndex][partType] = existingCard || null;
      if (cardData) addCardToPlayerHand(cardData); // 配置しようとしたカードを手札に戻す
      if (existingCard) removeCardFromPlayerHand(existingCard); // addCardToPlayerHandで追加したため
      renderPlayerHand();
      return; // 中断
    }

    // 6. 手札UI更新
    renderPlayerHand();

    // 7. ロボットステータス再計算・表示
    calculateAndDisplayRobotStats(robotIndex);

    // 8. 設計完了ボタンの状態確認
    checkDesignCompletion();
  }

  // カードを手札データに追加
  function addCardToPlayerHand(cardData) {
    if (!cardData || !cardData.part) return; // 不正データは無視
    let handArray;
    if (cardData.part === PARTS.HEAD) handArray = gameState.player.hand.head;
    else if (cardData.part === PARTS.UPPER) handArray = gameState.player.hand.upper;
    else if (cardData.part === PARTS.LOWER) handArray = gameState.player.hand.lower;
    else return; // 部位カード以外

    // 重複追加を防ぐ
    if (!handArray.some((card) => card && card.id === cardData.id)) {
      handArray.push(cardData);
      console.log("Added card back to hand:", cardData.id);
    }
  }

  // カードを手札データから削除
  function removeCardFromPlayerHand(cardData) {
    if (!cardData || !cardData.part) return; // 不正データは無視
    let handArray;
    if (cardData.part === PARTS.HEAD) handArray = gameState.player.hand.head;
    else if (cardData.part === PARTS.UPPER) handArray = gameState.player.hand.upper;
    else if (cardData.part === PARTS.LOWER) handArray = gameState.player.hand.lower;
    else return;

    const index = handArray.findIndex((card) => card && card.id === cardData.id);
    if (index > -1) {
      handArray.splice(index, 1);
      console.log("Removed card from hand:", cardData.id);
    } else {
      console.warn("Card to remove not found in hand:", cardData.id);
    }
  }

  // プレイヤーの手札UIを再描画
  function renderPlayerHand() {
    console.log("Rendering player hand...");
    if (!elements.playerHandCards) {
      console.error("ERROR: 'player-hand-cards' element not found in elements cache!");
      return;
    }
    if (!document.getElementById("player-hand-cards")) {
      console.error("ERROR: Element with ID 'player-hand-cards' not found in the DOM!");
      return;
    }

    elements.playerHandCards.innerHTML = ""; // クリア
    const allHandCards = [
      ...(gameState.player.hand.head || []),
      ...(gameState.player.hand.upper || []),
      ...(gameState.player.hand.lower || [])
    ];
    console.log(`Player hand data contains ${allHandCards.length} cards.`);

    allHandCards.forEach((cardData, index) => {
      if (!cardData || !cardData.id) {
        console.error(`ERROR: Invalid card data at index ${index}. Skipping.`);
        return;
      }
      // console.log(`Attempting to create element for card ${index + 1}: ${cardData.id}`);
      try {
        const cardElement = createGameCardElement(cardData, true); // 手札はドラッグ可能
        if (cardElement instanceof HTMLElement) {
          cardElement.removeEventListener('click', handleHandCardClick); // 既存リスナー削除
          cardElement.addEventListener('click', handleHandCardClick); // クリック配置リスナー
          elements.playerHandCards.appendChild(cardElement);
        } else {
          console.error(`ERROR: Failed to create card element for ${cardData.id}.`);
        }
      } catch (error) {
        console.error(`ERROR: Exception while creating/appending card ${cardData.id}:`, error);
      }
    });

    // 手札枚数表示更新
    if (elements.playerHandCount) {
      elements.playerHandCount.textContent = allHandCards.length;
      // console.log("Updated hand count display to:", allHandCards.length);
    } else {
      console.error("ERROR: 'player-hand-count' element not found in elements cache!");
    }
    console.log("Finished rendering player hand.");
  }

  // 手札のカードがクリックされたときの処理 (自動配置)
  function handleHandCardClick(event) {
    const clickedCardElement = event.currentTarget;
    const cardId = clickedCardElement.dataset.cardId;
    // gameState.allCardData からカードデータを取得
    const cardData = gameState.allCardData ? gameState.allCardData[cardId] : null;

    if (!cardData || !cardData.part || gameState.phase !== 'design') {
      console.warn("Hand card click ignored. Invalid data or phase.");
      return;
    }
    console.log(`Hand card clicked: ${cardId}`);

    // 1. 配置可能な空きスロットを探す
    let targetRobotIndex = -1;
    let targetPartType = null;
    const partTypeKey = cardData.part === PARTS.HEAD ? 'head' : cardData.part === PARTS.UPPER ? 'upper' : 'lower';

    for (let i = 0; i < NUM_ROBOTS; i++) {
      if (gameState.player.robots[i] && !gameState.player.robots[i][partTypeKey]) {
        targetRobotIndex = i;
        targetPartType = partTypeKey;
        console.log(`Found available slot: Robot ${i + 1}, Part ${partTypeKey}`);
        break;
      }
    }

    // 2. 空きスロットが見つかった場合のみ処理
    if (targetRobotIndex !== -1 && targetPartType) {
      // 対象スロット要素を取得
      const targetSlotElement = document.querySelector(`.robot-slot[data-robot-index="${targetRobotIndex}"] .part-slot[data-part-type="${targetPartType}"]`);
      if (targetSlotElement) {
        console.log(`Attempting to place ${cardId} onto Robot ${targetRobotIndex + 1} ${targetPartType} slot via click.`);
        // 配置処理実行 (手札からの削除も内部で行われる)
        placeCardOnRobot(targetRobotIndex, targetPartType, cardData, targetSlotElement);
        // クリック選択状態は placeCardOnRobot 内で解除される
      } else {
        console.error(`Target slot element not found for Robot ${targetRobotIndex} Part ${targetPartType}`);
        showMessage("エラー: 配置先スロットが見つかりません。", true);
      }
    } else {
      // 空きスロットがなかった場合
      console.log(`No available slot found for card ${cardId}`);
      showMessage(`カード「${cardData.part} ${cardData.manufacturer || 'P'} ${cardData.value || ''}」を配置できる空きスロットがありません。`, true);
    }
  }

  // プレイヤーのパイロットカード表示エリアを更新する
  function renderPlayerPilotCard() {
    console.log("Rendering player pilot card...");
    const pilotArea = elements.playerPilotCardArea;
    if (!pilotArea) {
      console.error("ERROR: 'player-pilot-card' element not found in elements cache!"); return;
    }
    if (!document.getElementById("player-pilot-card")) {
      console.error("ERROR: Element with ID 'player-pilot-card' not found in the DOM!"); return;
    }
    pilotArea.innerHTML = ""; // クリア

    const isPilotAssigned = gameState.player.robots.some(robot => robot && robot.pilot);

    // パイロットカードデータがあり、かつ未搭乗の場合のみ表示
    if (gameState.player.pilotCard && !isPilotAssigned) {
      const pilotCardData = gameState.player.pilotCard;
      console.log("Player has pilot card and it's available:", pilotCardData.id);
      if (!pilotCardData || !pilotCardData.id) {
        console.error("Invalid pilot card data."); pilotArea.textContent = "パイロットデータエラー"; return;
      }
      try {
        const cardElement = createGameCardElement(pilotCardData, false); // ドラッグ不可
        if (cardElement instanceof HTMLElement) {
          cardElement.removeEventListener('click', handlePilotCardClickAutoAssign);
          cardElement.addEventListener('click', handlePilotCardClickAutoAssign); // クリック自動搭乗
          pilotArea.appendChild(cardElement);
          console.log("Successfully rendered pilot card in hand area.");
        } else {
          console.error(`Failed to create pilot card element for ${pilotCardData.id}.`);
          pilotArea.textContent = "パイロット表示エラー";
        }
      } catch (error) {
        console.error(`Exception while creating pilot card ${pilotCardData.id}:`, error);
        pilotArea.textContent = "パイロット表示エラー";
      }
    } else if (isPilotAssigned) {
      console.log("Pilot is assigned, hand area remains empty.");
      // pilotArea.textContent = "（搭乗中）"; // 必要ならメッセージ
    } else {
      pilotArea.textContent = "パイロットカードなし";
      console.log("Player has no pilot card.");
    }
    console.log("Finished rendering player pilot card.");
  }

  /**
   * 指定されたロボットにパイロットを搭乗させる共通処理。
   * @param {number} targetRobotIndex パイロットを搭乗させるロボットのインデックス
   * @returns {boolean} 搭乗処理（または移動処理）が成功したかどうか
   */
  function assignPilotToRobot(targetRobotIndex) {
    console.log(`Attempting to assign/move pilot to Robot ${targetRobotIndex + 1}`);
    const pilotCardData = gameState.player.pilotCard;
    const targetRobot = gameState.player.robots[targetRobotIndex];

    // --- 事前チェック ---
    if (!pilotCardData) {
      showMessage("搭乗させるパイロットカードがありません。", true); return false;
    }
    if (!targetRobot || !(targetRobot.head && targetRobot.upper && targetRobot.lower)) {
      showMessage(`ロボット ${targetRobotIndex + 1} はまだ完成していません。`, true); return false;
    }

    // --- 現在の搭乗状況を確認 ---
    const currentlyAssignedIndex = gameState.player.robots.findIndex(r => r && r.pilot);

    // Case 1: 移動が必要な場合
    if (currentlyAssignedIndex !== -1 && currentlyAssignedIndex !== targetRobotIndex) {
      console.log(`Moving pilot from Robot ${currentlyAssignedIndex + 1} to Robot ${targetRobotIndex + 1}`);
      // 1a. 元ロボットから解除 (データ)
      gameState.player.robots[currentlyAssignedIndex].pilot = null;
      // 1b. 元ロボットUI更新 (ボタンに戻す)
      const oldRobotSlotElement = document.querySelector(`.robot-slot[data-robot-index="${currentlyAssignedIndex}"]`);
      if (oldRobotSlotElement) {
        oldRobotSlotElement.classList.remove('has-pilot');
        const oldPilotAssignArea = oldRobotSlotElement.querySelector('.pilot-assign-area');
        if (oldPilotAssignArea) {
          oldPilotAssignArea.innerHTML = ''; // パイロットカード消去
          const assignButton = document.createElement('button');
          assignButton.classList.add('assign-pilot-button');
          assignButton.dataset.robotIndex = String(currentlyAssignedIndex); // datasetは文字列
          assignButton.disabled = false; // 完成済みのはず
          assignButton.textContent = "パイロット搭乗";
          assignButton.removeEventListener('click', handleAssignPilotClick);
          assignButton.addEventListener('click', handleAssignPilotClick);
          oldPilotAssignArea.appendChild(assignButton);
        }
        // 1c. 元ロボットのステータス再計算
        calculateAndDisplayRobotStats(currentlyAssignedIndex);
      } else { console.error(`Cannot find old robot slot UI for index ${currentlyAssignedIndex}`); }
    }
    // Case 2: 同じロボットへの再搭乗指定
    else if (currentlyAssignedIndex === targetRobotIndex) {
      showMessage(`パイロットは既にこのロボットに搭乗済みです。`, true); return false;
    }
    // Case 3: どこにも搭乗していない -> そのまま搭乗処理へ

    // --- 新しいロボットへの搭乗処理 ---
    console.log(`Assigning pilot ${pilotCardData.id} to Robot ${targetRobotIndex + 1}`);
    // a) データ更新
    targetRobot.pilot = pilotCardData;
    // b) 手札パイロットカード表示更新 (未搭乗だった場合のみ手札から消える)
    if (currentlyAssignedIndex === -1) renderPlayerPilotCard();
    // c) 搭乗先ロボットスロットUI更新
    const targetRobotSlotElement = document.querySelector(`.robot-slot[data-robot-index="${targetRobotIndex}"]`);
    if (targetRobotSlotElement) {
      targetRobotSlotElement.classList.add('has-pilot');
      const targetPilotAssignArea = targetRobotSlotElement.querySelector('.pilot-assign-area');
      if (targetPilotAssignArea) {
        targetPilotAssignArea.innerHTML = ''; // ボタンクリア
        const pilotCardElementOnRobot = createGameCardElement(pilotCardData, false);
        if (pilotCardElementOnRobot) {
          pilotCardElementOnRobot.classList.add('assigned-pilot'); // スタイル適用
          pilotCardElementOnRobot.removeEventListener('click', handleUnassignPilotClick);
          pilotCardElementOnRobot.addEventListener('click', handleUnassignPilotClick); // 解除用リスナー
          targetPilotAssignArea.appendChild(pilotCardElementOnRobot);
        } else {
          console.error("Failed to create assigned pilot card element."); targetPilotAssignArea.textContent = '表示エラー';
          targetRobot.pilot = null; renderPlayerPilotCard(); return false; // ロールバック
        }
      } else {
        console.error(`Pilot assign area not found for target robot ${targetRobotIndex}`);
        targetRobot.pilot = null; renderPlayerPilotCard(); return false;
      }
    } else {
      console.error(`Target robot slot element not found for index ${targetRobotIndex}`);
      targetRobot.pilot = null; renderPlayerPilotCard(); return false;
    }
    // d) ステータス更新
    calculateAndDisplayRobotStats(targetRobotIndex);
    // e) 設計完了チェック
    checkDesignCompletion();
    // f) メッセージ表示
    if (currentlyAssignedIndex !== -1 && currentlyAssignedIndex !== targetRobotIndex) {
      showMessage(`パイロットをロボット ${currentlyAssignedIndex + 1} からロボット ${targetRobotIndex + 1} に移動しました。`, true);
    } else {
      showMessage(`パイロットがロボット ${targetRobotIndex + 1} に搭乗しました。`, true);
    }
    return true; // 成功
  }

  /**
   * 手札のパイロットカードがクリックされた際の処理 (自動搭乗)。
   */
  function handlePilotCardClickAutoAssign(event) {
    console.log("Pilot card click detected (Auto-Assign Logic)");
    const pilotCardData = gameState.player.pilotCard;
    if (!pilotCardData || gameState.phase !== 'design') return; // ガード節

    const isPilotAlreadyAssigned = gameState.player.robots.some(robot => robot && robot.pilot);
    if (isPilotAlreadyAssigned) {
      showMessage("既にパイロットは他のロボットに搭乗済みです。", true); return;
    }

    // 搭乗可能な完成済みロボットを探す
    let targetRobotIndex = -1;
    for (let i = 0; i < NUM_ROBOTS; i++) {
      const robot = gameState.player.robots[i];
      if (robot && robot.head && robot.upper && robot.lower && !robot.pilot) {
        targetRobotIndex = i; break;
      }
    }

    if (targetRobotIndex !== -1) {
      assignPilotToRobot(targetRobotIndex); // 共通関数呼び出し
    } else {
      showMessage("パイロットを搭乗させられる完成済みロボットがありません。", true);
    }
  }

  /**
   * 搭乗ボタンがクリックされた際の処理。
   */
  function handleAssignPilotClick(event) {
    const button = event.currentTarget;
    const robotIndex = parseInt(button.dataset.robotIndex, 10);
    console.log(`Assign Pilot button clicked for Robot ${robotIndex + 1}`);
    if (!isNaN(robotIndex)) {
      assignPilotToRobot(robotIndex); // 共通関数呼び出し
    } else {
      console.error("Invalid robot index on assign button:", button.dataset.robotIndex);
    }
  }

  /**
   * ロボットスロット上のパイロットカードがクリックされた際の処理 (搭乗解除)。
   */
  function handleUnassignPilotClick(event) {
    console.log("Assigned pilot card clicked (Unassign Logic)");
    const clickedPilotCardElement = event.currentTarget;
    const robotSlotElement = clickedPilotCardElement.closest('.robot-slot');
    if (!robotSlotElement) { console.error("Could not find parent robot slot for unassign click."); return; }
    const robotIndex = parseInt(robotSlotElement.dataset.robotIndex, 10);

    // ガード節: 状態確認
    if (isNaN(robotIndex) || robotIndex < 0 || robotIndex >= NUM_ROBOTS || !gameState.player.robots[robotIndex] || !gameState.player.robots[robotIndex].pilot) {
      console.error(`Invalid state or index for unassigning pilot from robot index ${robotIndex}.`);
      renderPlayerPilotCard(); // UI再描画試行
      return;
    }

    const pilotData = gameState.player.robots[robotIndex].pilot;
    console.log(`Unassigning pilot ${pilotData.id} from Robot ${robotIndex + 1}`);

    // 1. データ更新: パイロット解除
    gameState.player.robots[robotIndex].pilot = null;
    // 2. ロボットスロットUI更新 (ボタンに戻す)
    robotSlotElement.classList.remove('has-pilot');
    const pilotAssignArea = robotSlotElement.querySelector('.pilot-assign-area');
    if (pilotAssignArea) {
      pilotAssignArea.innerHTML = ''; // パイロットカード消去
      const assignButton = document.createElement('button');
      assignButton.classList.add('assign-pilot-button');
      assignButton.dataset.robotIndex = String(robotIndex);
      // ロボットが完成しているかチェックして disabled 設定
      const robot = gameState.player.robots[robotIndex];
      assignButton.disabled = !(robot && robot.head && robot.upper && robot.lower);
      assignButton.textContent = "パイロット搭乗";
      assignButton.removeEventListener('click', handleAssignPilotClick);
      assignButton.addEventListener('click', handleAssignPilotClick);
      pilotAssignArea.appendChild(assignButton);
    } else { console.error(`Pilot assign area not found in robot ${robotIndex} during unassign.`); }
    // 3. 手札パイロットカード表示更新
    renderPlayerPilotCard();
    // 4. ステータス再計算
    calculateAndDisplayRobotStats(robotIndex);
    // 5. 設計完了状態チェック
    checkDesignCompletion();
    // 6. メッセージ表示
    showMessage(`ロボット ${robotIndex + 1} からパイロットの搭乗を解除しました。`, true);
  }


  // ロボットのステータス計算と表示
  function calculateAndDisplayRobotStats(robotIndex) {
    const robot = gameState.player.robots[robotIndex];
    const statsElement = document.querySelector(`.robot-slot[data-robot-index="${robotIndex}"] .robot-stats`);
    if (!statsElement) return; // 表示要素がなければ終了

    // 部品が揃っていない場合は表示をクリア
    if (!robot || !robot.head || !robot.upper || !robot.lower) {
      statsElement.innerHTML = "";
      // 搭乗ボタンも無効化 (部品が外された場合)
      const assignButton = document.querySelector(`.robot-slot[data-robot-index="${robotIndex}"] .assign-pilot-button`);
      if (assignButton) assignButton.disabled = true;
      return;
    }

    // 部品が揃っていれば搭乗ボタンを有効化 (パイロットがまだ搭乗していなければ)
    const assignButton = document.querySelector(`.robot-slot[data-robot-index="${robotIndex}"] .assign-pilot-button`);
    if (assignButton && !robot.pilot) { // ボタンがあり、かつパイロット未搭乗の場合
      assignButton.disabled = false;
    } else if (assignButton && robot.pilot) {
      assignButton.disabled = true; // 搭乗済みなら無効
    }

    // ステータス計算
    let headValue = parseInt(robot.head.value, 10) || 0;
    let upperValue = parseInt(robot.upper.value, 10) || 0;
    let lowerValue = parseInt(robot.lower.value, 10) || 0;
    const isSameManufacturer =
      robot.head.manufacturer === robot.upper.manufacturer &&
      robot.upper.manufacturer === robot.lower.manufacturer &&
      robot.head.manufacturer !== "";
    const manufacturerBonus = isSameManufacturer ? 1 : 0;
    let pilotBonus = { head: 0, upper: 0, lower: 0 };
    if (robot.pilot) {
      if (robot.pilot.part === PARTS.HEAD) pilotBonus.head = 1;
      else if (robot.pilot.part === PARTS.UPPER) pilotBonus.upper = 1;
      else if (robot.pilot.part === PARTS.LOWER) pilotBonus.lower = 1;
    }

    robot.stats = {
      search: headValue + manufacturerBonus + pilotBonus.head,
      attack: upperValue + manufacturerBonus + pilotBonus.upper,
      defense: lowerValue + manufacturerBonus + pilotBonus.lower,
      manufacturerBonus: isSameManufacturer,
    };

    // UIに表示
    statsElement.innerHTML = `
          <p>索敵: ${robot.stats.search} ${manufacturerBonus ? "(+1)" : ""} ${pilotBonus.head ? "(P+1)" : ""}</p>
          <p>攻撃: ${robot.stats.attack} ${manufacturerBonus ? "(+1)" : ""} ${pilotBonus.upper ? "(P+1)" : ""}</p>
          <p>防御: ${robot.stats.defense} ${manufacturerBonus ? "(+1)" : ""} ${pilotBonus.lower ? "(P+1)" : ""}</p>
          ${isSameManufacturer ? '<p style="color: green; font-size:0.8em;">製造所ボーナス!</p>' : ""}
      `;
  }

  // 設計エリアのカードクリックで手札に戻すハンドラ
  function handleReturnToHandClick(event) {
    const clickedCardElement = event.currentTarget;
    const cardId = clickedCardElement.dataset.cardId;
    const partSlotElement = clickedCardElement.closest(".part-slot");
    const robotSlotElement = clickedCardElement.closest(".robot-slot");

    if (gameState.phase !== "design" || !partSlotElement || !robotSlotElement || !cardId) {
      console.warn("Return to hand click ignored."); return;
    }
    const robotIndex = parseInt(robotSlotElement.dataset.robotIndex, 10);
    const partType = partSlotElement.dataset.partType;
    const cardData = gameState.player.robots[robotIndex]?.[partType];

    if (!cardData || cardData.id !== cardId) {
      console.error(`Return to hand click: Card data mismatch for robot ${robotIndex}, part ${partType}, cardId ${cardId}.`);
      partSlotElement.textContent = partType === "head" ? "頭" : partType === "upper" ? "上半身" : "下半身";
      return;
    }

    console.log(`Returning card ${cardId} from Robot ${robotIndex + 1} to hand.`);
    // 1. データから削除
    gameState.player.robots[robotIndex][partType] = null;
    // 2. 手札に追加
    addCardToPlayerHand(cardData);
    // 3. DOMから削除
    clickedCardElement.remove();
    // 4. プレースホルダ表示
    partSlotElement.textContent = partType === "head" ? "頭" : partType === "upper" ? "上半身" : "下半身";
    // 5. 手札UI更新
    renderPlayerHand();
    // 6. ロボットステータス更新
    calculateAndDisplayRobotStats(robotIndex); // 部品がなくなったので表示クリア＆ボタン無効化されるはず
    // 7. 設計完了状態更新
    checkDesignCompletion();
  }


  // プレイヤーの設計が完了したかチェック
  function checkDesignCompletion() {
    let completeCount = 0;
    let pilotAssigned = false;
    for (let i = 0; i < NUM_ROBOTS; i++) {
      const robot = gameState.player.robots[i];
      if (robot && robot.head && robot.upper && robot.lower) {
        completeCount++;
        if (robot.pilot) {
          pilotAssigned = true;
        }
      }
    }
    // 全ロボット完成 かつ パイロットが1人搭乗している
    gameState.player.hasDesigned = (completeCount === NUM_ROBOTS && pilotAssigned);

    // 設計完了ボタンの状態更新
    if (elements.confirmDesignButton) {
      elements.confirmDesignButton.disabled = !gameState.player.hasDesigned;
    }
  }

  // --- ゲームフロー関数 ---

  // ゲーム初期化・開始
  function startGame(allCards) {
    console.log("gameManager.startGame called");
    gameState.allCardData = allCards; // 受け取ったカードデータをセット
    gameState.phase = "preparation";
    resetGame(); // ゲーム状態リセット (UI含む)
    updateStatusDisplay();
    showMessage("カードを配布しています...");

    // 1. カードを分類 (allCardsから)
    const allPartCards = [];
    const allPilotCards = [];
    Object.values(gameState.allCardData).forEach((card) => {
      if (!card) return; // nullやundefinedを除外
      // パイロットカード判定
      if (card.manufacturer === "" && card.part && [PARTS.HEAD, PARTS.UPPER, PARTS.LOWER].includes(card.part)) {
        allPilotCards.push({ ...card });
      }
      // 部位カード判定
      else if (card.manufacturer && MANUFACTURERS.includes(card.manufacturer) &&
        card.part && [PARTS.HEAD, PARTS.UPPER, PARTS.LOWER].includes(card.part) &&
        card.value && ["1", "2", "3"].includes(String(card.value))) {
        allPartCards.push({ ...card });
      }
    });
    console.log(`Found ${allPartCards.length} valid part cards and ${allPilotCards.length} valid pilot cards.`);

    // カード枚数チェック
    const requiredParts = CARDS_PER_PLAYER * 2;
    const requiredPilots = PILOT_CARDS_PER_PLAYER * 2;
    if (allPartCards.length < requiredParts || allPilotCards.length < requiredPilots) {
      const errorMsg = `エラー: ゲーム開始に必要なカード枚数が足りません。(部位: ${allPartCards.length}/${requiredParts}, パイロット: ${allPilotCards.length}/${requiredPilots})`;
      showMessage(errorMsg); console.error(errorMsg);
      gameState.phase = "idle"; updateStatusDisplay(); return;
    }

    // 部位カードを部位ごとに分類したプールを作成
    const partPool = { head: [], upper: [], lower: [] };
    allPartCards.forEach((card) => {
      if (card.part === PARTS.HEAD) partPool.head.push(card);
      else if (card.part === PARTS.UPPER) partPool.upper.push(card);
      else if (card.part === PARTS.LOWER) partPool.lower.push(card);
    });
    // 各プールとパイロットをシャッフル
    shuffleArray(partPool.head); shuffleArray(partPool.upper); shuffleArray(partPool.lower);
    shuffleArray(allPilotCards);

    // 2. プレイヤーへの配布
    gameState.player.hand.head = partPool.head.splice(0, 3);
    gameState.player.hand.upper = partPool.upper.splice(0, 3);
    gameState.player.hand.lower = partPool.lower.splice(0, 3);
    gameState.player.pilotCard = allPilotCards.pop();

    // 3. CPUへの配布
    gameState.cpu.hand.head = partPool.head.splice(0, 3);
    gameState.cpu.hand.upper = partPool.upper.splice(0, 3);
    gameState.cpu.hand.lower = partPool.lower.splice(0, 3);
    gameState.cpu.pilotCard = allPilotCards.pop();

    console.log("Player received cards:", `H:${gameState.player.hand.head.length}, U:${gameState.player.hand.upper.length}, L:${gameState.player.hand.lower.length}`, "Pilot:", gameState.player.pilotCard?.id);
    console.log("CPU received cards:", `H:${gameState.cpu.hand.head.length}, U:${gameState.cpu.hand.upper.length}, L:${gameState.cpu.hand.lower.length}`, "Pilot:", gameState.cpu.pilotCard?.id);

    // 4. 設計フェイズへ
    enterDesignPhase();
  }


  // 設計フェイズ開始
  function enterDesignPhase() {
    console.log("Entering Design Phase");
    gameState.phase = "design";
    showScreen('design-screen'); // 設計画面表示
    updateStatusDisplay();
    showMessage(
      "設計フェイズ: 手札のカードを配置しロボット3体を完成させ、パイロット1人を搭乗させてください。"
    );

    // 設計エリアリセット (resetGame内で呼ばれるが念のため)
    resetDesignAreaUI(); // UIのみリセット
    // プレイヤーのロボットデータ構造初期化
    gameState.player.robots = [];
    for (let i = 0; i < NUM_ROBOTS; i++) {
      gameState.player.robots.push({ head: null, upper: null, lower: null, pilot: null, stats: {}, used: false, battleResult: null });
    }
    gameState.player.hasDesigned = false;


    // プレイヤー手札・パイロット表示
    renderPlayerHand();
    renderPlayerPilotCard();

    // インタラクション有効化
    enableDesignInteraction();

    // CPU設計開始
    startCpuDesign();

    // 設計完了ボタン準備
    if (elements.confirmDesignButton) {
      elements.confirmDesignButton.disabled = true;
      elements.confirmDesignButton.removeEventListener('click', handleConfirmDesign);
      elements.confirmDesignButton.addEventListener('click', handleConfirmDesign);
    }
  }

  // 設計エリアのUIのみリセットする関数
  function resetDesignAreaUI() {
    for (let i = 0; i < NUM_ROBOTS; i++) {
      const robotSlot = document.querySelector(`.robot-slot[data-robot-index="${i}"]`);
      if (robotSlot) {
        robotSlot.classList.remove("has-pilot");
        robotSlot.querySelectorAll(".part-slot").forEach((slot) => {
          slot.innerHTML = slot.dataset.partType === "head" ? "頭" : slot.dataset.partType === "upper" ? "上半身" : "下半身";
          slot.classList.remove("drag-over");
        });
        const statsElement = robotSlot.querySelector(".robot-stats");
        if (statsElement) statsElement.innerHTML = "";
        const pilotAssignArea = robotSlot.querySelector(".pilot-assign-area");
        if (pilotAssignArea) {
          // ボタンを再生成してリスナーを確実に追加
          pilotAssignArea.innerHTML = ''; // 中身をクリア
          const assignButton = document.createElement('button');
          assignButton.classList.add('assign-pilot-button');
          assignButton.dataset.robotIndex = String(i);
          assignButton.disabled = true; // 初期状態は無効
          assignButton.textContent = "パイロット搭乗";
          assignButton.addEventListener('click', handleAssignPilotClick);
          pilotAssignArea.appendChild(assignButton);
        }
      }
    }
    // 手札エリアもクリア (renderPlayerHandで再描画される)
    if (elements.playerHandCards) elements.playerHandCards.innerHTML = '';
    if (elements.playerPilotCardArea) elements.playerPilotCardArea.innerHTML = '';
    if (elements.playerHandCount) elements.playerHandCount.textContent = '0';
  }


  // 設計関連インタラクション有効化
  function enableDesignInteraction() {
    // ドラッグ＆ドロップリスナー設定
    const partSlots = document.querySelectorAll("#player-robot-slots .part-slot");
    partSlots.forEach((slot) => {
      slot.removeEventListener("dragover", handleDragOver);
      slot.removeEventListener("dragleave", handleDragLeave);
      slot.removeEventListener("drop", handleDrop);
      slot.addEventListener("dragover", handleDragOver);
      slot.addEventListener("dragleave", handleDragLeave);
      slot.addEventListener("drop", handleDrop);
    });
    // 手札カードのドラッグ開始/終了は renderPlayerHand 内の createGameCardElement で設定
    // 配置済みカードの手札戻しクリックは placeCardOnRobot 内で設定
    // 手札カードのクリック配置は renderPlayerHand 内で設定
    // パイロットカードのクリック搭乗は renderPlayerPilotCard 内で設定
    // 搭乗ボタンのクリックは resetDesignAreaUI / handleUnassignPilotClick で設定
  }

  // 設計完了ボタン処理
  function handleConfirmDesign() {
    console.log("Confirm Design button clicked.");
    if (!gameState.player.hasDesigned) {
      showMessage("まだ設計が完了していません。", true); return;
    }
    if (!gameState.cpu.hasDesigned) {
      showMessage("CPUがまだ設計中です。お待ちください...", true); return;
    }
    showMessage("プレイヤー 設計完了！ CPUも完了。戦闘フェイズへ進みます。", true);
    disableDesignInteraction();
    enterBattlePhase(); // 戦闘フェイズへ
  }

  // 設計関連インタラクション無効化
  function disableDesignInteraction() {
    console.log("Disabling design interactions...");
    // 手札カードドラッグ不可
    document.querySelectorAll("#player-hand-cards .game-card").forEach((card) => { card.draggable = false; card.style.cursor = 'default'; });
    // 手札カードクリック無効化 (リスナー削除)
    document.querySelectorAll("#player-hand-cards .game-card").forEach(card => card.removeEventListener('click', handleHandCardClick));
    // ドロップリスナー解除
    document.querySelectorAll("#player-robot-slots .part-slot").forEach((slot) => {
      slot.removeEventListener("dragover", handleDragOver);
      slot.removeEventListener("dragleave", handleDragLeave);
      slot.removeEventListener("drop", handleDrop);
      slot.classList.remove("drag-over");
    });
    // 配置済みカードクリック無効化
    document.querySelectorAll("#player-robot-slots .part-slot .game-card").forEach(card => {
      card.removeEventListener('click', handleReturnToHandClick);
      card.style.cursor = 'default';
    });
    // パイロット手札クリック無効化
    const pilotCardInHand = elements.playerPilotCardArea?.querySelector('.game-card');
    if (pilotCardInHand) pilotCardInHand.removeEventListener('click', handlePilotCardClickAutoAssign);
    // 搭乗ボタン無効化
    document.querySelectorAll(".assign-pilot-button").forEach(button => button.disabled = true);
    // 搭乗済みパイロットクリック無効化
    document.querySelectorAll(".assigned-pilot").forEach(card => card.removeEventListener('click', handleUnassignPilotClick));
    // 設計完了ボタン無効化
    if (elements.confirmDesignButton) elements.confirmDesignButton.disabled = true;
    console.log("Design interactions disabled.");
  }


  // CPUの設計処理 (戦略的バージョン)
  function startCpuDesign() {
    console.log("Starting CPU design (Strategic)...");
    gameState.cpu.robots = []; // ロボットデータ初期化
    for (let i = 0; i < NUM_ROBOTS; i++) {
      gameState.cpu.robots.push({ head: null, upper: null, lower: null, pilot: null, stats: {}, used: false, battleResult: null });
    }
    const cpuHand = { // 手札コピー
      head: [...(gameState.cpu.hand.head || [])],
      upper: [...(gameState.cpu.hand.upper || [])],
      lower: [...(gameState.cpu.hand.lower || [])],
    };
    let availableCards = [...cpuHand.head, ...cpuHand.upper, ...cpuHand.lower];
    console.log(`CPU Hand before strategic design: Total ${availableCards.length}`);

    setTimeout(() => { // 非同期に見せる
      let designSuccess = true;
      let assignedRobotCount = 0;
      const manufacturerBonusSets = [];

      // 1. 製造所ボーナス候補を探す
      MANUFACTURERS.forEach(manufacturer => {
        const manuCards = availableCards.filter(card => card && card.manufacturer === manufacturer);
        const headCards = manuCards.filter(card => card.part === PARTS.HEAD).sort((a, b) => parseInt(b.value) - parseInt(a.value));
        const upperCards = manuCards.filter(card => card.part === PARTS.UPPER).sort((a, b) => parseInt(b.value) - parseInt(a.value));
        const lowerCards = manuCards.filter(card => card.part === PARTS.LOWER).sort((a, b) => parseInt(b.value) - parseInt(a.value));
        if (headCards.length > 0 && upperCards.length > 0 && lowerCards.length > 0) {
          const bestSet = { head: headCards[0], upper: upperCards[0], lower: lowerCards[0] };
          const totalValue = parseInt(bestSet.head.value) + parseInt(bestSet.upper.value) + parseInt(bestSet.lower.value);
          manufacturerBonusSets.push({ manufacturer, set: bestSet, totalValue });
        }
      });
      manufacturerBonusSets.sort((a, b) => b.totalValue - a.totalValue); // Value合計でソート
      console.log("Found Manufacturer Bonus Sets:", manufacturerBonusSets.map(s => `${s.manufacturer}(${s.totalValue})`));

      // 2. 製造所ボーナス機体を割り当て
      manufacturerBonusSets.forEach(bonusSet => {
        if (assignedRobotCount < NUM_ROBOTS) {
          const headIdx = availableCards.findIndex(c => c && c.id === bonusSet.set.head.id);
          const upperIdx = availableCards.findIndex(c => c && c.id === bonusSet.set.upper.id);
          const lowerIdx = availableCards.findIndex(c => c && c.id === bonusSet.set.lower.id);
          if (headIdx !== -1 && upperIdx !== -1 && lowerIdx !== -1) {
            console.log(`Assigning Manufacturer Bonus set: ${bonusSet.manufacturer} to Robot ${assignedRobotCount + 1}`);
            gameState.cpu.robots[assignedRobotCount].head = availableCards[headIdx];
            gameState.cpu.robots[assignedRobotCount].upper = availableCards[upperIdx];
            gameState.cpu.robots[assignedRobotCount].lower = availableCards[lowerIdx];
            assignedRobotCount++;
            // 使用済みカードIDリスト作成
            const usedIds = [bonusSet.set.head.id, bonusSet.set.upper.id, bonusSet.set.lower.id];
            // availableCards から削除
            availableCards = availableCards.filter(card => card && !usedIds.includes(card.id));
          }
        }
      });
      console.log(`Assigned ${assignedRobotCount} robots using bonus sets. ${availableCards.length} cards remaining.`);

      // 3. 残りのスロットを埋める
      if (assignedRobotCount < NUM_ROBOTS && availableCards.length >= (NUM_ROBOTS - assignedRobotCount) * 3) {
        console.log("Filling remaining robot slots...");
        const remainingHeads = availableCards.filter(c => c && c.part === PARTS.HEAD).sort((a, b) => parseInt(b.value) - parseInt(a.value));
        const remainingUppers = availableCards.filter(c => c && c.part === PARTS.UPPER).sort((a, b) => parseInt(b.value) - parseInt(a.value));
        const remainingLowers = availableCards.filter(c => c && c.part === PARTS.LOWER).sort((a, b) => parseInt(b.value) - parseInt(a.value));
        for (let i = assignedRobotCount; i < NUM_ROBOTS; i++) {
          if (remainingHeads.length > 0 && remainingUppers.length > 0 && remainingLowers.length > 0) {
            gameState.cpu.robots[i].head = remainingHeads.shift();
            gameState.cpu.robots[i].upper = remainingUppers.shift();
            gameState.cpu.robots[i].lower = remainingLowers.shift();
            assignedRobotCount++;
            console.log(`Successfully built Robot ${i + 1} with remaining parts.`);
          } else {
            console.error(`CPU design error: Not enough variety of parts remaining for Robot ${i + 1}.`);
            designSuccess = false; break;
          }
        }
      } else if (assignedRobotCount < NUM_ROBOTS) {
        console.error(`CPU design error: Not enough remaining cards (${availableCards.length})`);
        designSuccess = false;
      }

      // 4. 設計完了チェック
      if (assignedRobotCount !== NUM_ROBOTS) designSuccess = false;
      for (let i = 0; i < NUM_ROBOTS; i++) {
        const r = gameState.cpu.robots[i];
        if (!r || !r.head || !r.upper || !r.lower) designSuccess = false;
      }
      if (!designSuccess) console.error("CPU design failed!");

      // 5. パイロット割り当て (設計成功時)
      let pilotAssigned = false;
      if (designSuccess && gameState.cpu.pilotCard) {
        let bestRobotIndex = -1; let maxStatSum = -1;
        for (let i = 0; i < NUM_ROBOTS; i++) {
          const robot = gameState.cpu.robots[i];
          let h = parseInt(robot.head.value, 10) || 0; let u = parseInt(robot.upper.value, 10) || 0; let l = parseInt(robot.lower.value, 10) || 0;
          const isSame = robot.head.manufacturer === robot.upper.manufacturer && robot.upper.manufacturer === robot.lower.manufacturer && robot.head.manufacturer !== "";
          const bonus = isSame ? 1 : 0;
          const currentStatSum = (h + bonus) + (u + bonus) + (l + bonus); // パイロットボーナス抜き
          // console.log(`CPU Robot ${i + 1} Base Stat Sum: ${currentStatSum}`);
          if (currentStatSum > maxStatSum) { maxStatSum = currentStatSum; bestRobotIndex = i; }
        }
        if (bestRobotIndex !== -1) {
          gameState.cpu.robots[bestRobotIndex].pilot = gameState.cpu.pilotCard;
          pilotAssigned = true;
          console.log(`CPU assigned pilot to Robot ${bestRobotIndex + 1} (Sum: ${maxStatSum})`);
        } else { // フォールバック
          const fallbackIndex = Math.floor(Math.random() * NUM_ROBOTS);
          gameState.cpu.robots[fallbackIndex].pilot = gameState.cpu.pilotCard;
          pilotAssigned = true;
          console.log(`CPU assigned pilot randomly to Robot ${fallbackIndex + 1} as fallback.`);
        }
      }

      // 6. 設計完了フラグ設定 & 最終ステータス計算
      gameState.cpu.hasDesigned = designSuccess && (pilotAssigned || !gameState.cpu.pilotCard);
      console.log("CPU Robots state after strategic design:");
      gameState.cpu.robots.forEach((robot, index) => {
        if (robot.head && robot.upper && robot.lower) calculateCpuRobotStats(index); // 最終ステータス計算
        console.log(`CPU Robot ${index + 1}: H:${robot.head?.id} U:${robot.upper?.id} L:${robot.lower?.id} P:${robot.pilot?.id} Stats:`, robot.stats);
      });
      console.log("gameState.cpu.hasDesigned set to:", gameState.cpu.hasDesigned);

      // 7. プレイヤーの準備状態を確認して次へ
      if (gameState.player.hasDesigned) {
        if (gameState.cpu.hasDesigned) {
          console.log("CPU detects player is ready. Entering battle phase from CPU callback.");
          showMessage("CPU 設計完了！戦闘フェイズへ進みます。", true);
          disableDesignInteraction();
          enterBattlePhase();
        } else {
          showMessage("エラー: CPUがロボットを設計できませんでした。", true);
        }
      } else {
        if (gameState.cpu.hasDesigned) showMessage("CPU 設計完了！プレイヤーの設計完了待ち...", true);
        else showMessage("エラー: CPUがロボットを設計できませんでした。プレイヤーの設計完了待ち...", true);
      }
    }, 500); // CPU思考時間
  }

  // CPUロボットのステータス計算
  function calculateCpuRobotStats(robotIndex) {
    const robot = gameState.cpu.robots[robotIndex];
    if (!robot || !robot.head || !robot.upper || !robot.lower) {
      // console.warn(`CPU Robot ${robotIndex + 1} is incomplete.`);
      robot.stats = { search: 0, attack: 0, defense: 0, manufacturerBonus: false };
      return;
    }
    let h = parseInt(robot.head.value, 10) || 0; let u = parseInt(robot.upper.value, 10) || 0; let l = parseInt(robot.lower.value, 10) || 0;
    const isSame = robot.head.manufacturer === robot.upper.manufacturer && robot.upper.manufacturer === robot.lower.manufacturer && robot.head.manufacturer !== "";
    const bonus = isSame ? 1 : 0;
    let pilotBonus = { head: 0, upper: 0, lower: 0 };
    if (robot.pilot) {
      if (robot.pilot.part === PARTS.HEAD) pilotBonus.head = 1;
      else if (robot.pilot.part === PARTS.UPPER) pilotBonus.upper = 1;
      else if (robot.pilot.part === PARTS.LOWER) pilotBonus.lower = 1;
    }
    robot.stats = {
      search: h + bonus + pilotBonus.head,
      attack: u + bonus + pilotBonus.upper,
      defense: l + bonus + pilotBonus.lower,
      manufacturerBonus: isSame,
    };
    // console.log(`CPU Robot ${robotIndex + 1} Final Stats:`, robot.stats);
  }


  // 戦闘フェイズ開始
  function enterBattlePhase() {
    console.log("Entering Battle Phase");
    gameState.currentRound = 1;
    prepareBattleSelection(); // 最初のラウンドの選択準備へ
  }

  // 戦闘ロボット選択フェイズ準備
  function prepareBattleSelection() {
    console.log("Preparing Battle Selection Phase");
    gameState.phase = "battle_selection";
    showScreen('battle-selection-screen');
    gameState.player.selectedRobotIndex = -1; // プレイヤー選択リセット
    updateStatusDisplay();
    showMessage(`ラウンド ${gameState.currentRound}: 戦闘に出すロボットを選択してください。`);
    renderBattleSelectionOptions(); // プレイヤーの選択肢を描画

    // 戦闘開始ボタン準備
    if (elements.confirmBattleRobotButton) {
      elements.confirmBattleRobotButton.disabled = true;
      elements.confirmBattleRobotButton.removeEventListener('click', handleConfirmBattleRobot);
      elements.confirmBattleRobotButton.addEventListener('click', handleConfirmBattleRobot);
    }
  }

  // 戦闘ロボット選択肢を描画
  function renderBattleSelectionOptions() {
    console.log("Rendering battle selection options...");
    const selectionContainer = elements.playerBattleRobotSelection;
    if (!selectionContainer) { console.error("playerBattleRobotSelection element not cached!"); return; }
    selectionContainer.innerHTML = ""; // クリア

    gameState.player.robots.forEach((robot, index) => {
      if (robot && robot.head && robot.upper && robot.lower) { // 完成済みロボットのみ
        const robotSlotClone = document.createElement("div");
        robotSlotClone.classList.add("robot-slot", "battle-selection-slot"); // CSSクラス追加
        robotSlotClone.dataset.robotIndex = String(index);

        // カード要素生成 (簡略化のためステータスのみ表示も可)
        const headCard = robot.head ? createGameCardElement(robot.head, false) : document.createElement('div');
        const upperCard = robot.upper ? createGameCardElement(robot.upper, false) : document.createElement('div');
        const lowerCard = robot.lower ? createGameCardElement(robot.lower, false) : document.createElement('div');

        robotSlotClone.innerHTML = `
                  <h4>ロボット ${index + 1} ${robot.pilot ? "(P)" : ""}</h4>
                  <div class="part-slot head-slot"></div>
                  <div class="part-slot upper-body-slot"></div>
                  <div class="part-slot lower-body-slot"></div>
                  <div class="robot-stats"></div> `;
        const headSlot = robotSlotClone.querySelector(".head-slot");
        const upperSlot = robotSlotClone.querySelector(".upper-body-slot");
        const lowerSlot = robotSlotClone.querySelector(".lower-body-slot");
        if (headSlot && headCard) headSlot.appendChild(headCard);
        if (upperSlot && upperCard) upperSlot.appendChild(upperCard);
        if (lowerSlot && lowerCard) lowerSlot.appendChild(lowerCard);

        // 簡易ステータス表示
        const statsElement = robotSlotClone.querySelector(".robot-stats");
        if (statsElement && robot.stats) {
          statsElement.innerHTML = `<p>索:${robot.stats.search || '-'} 攻:${robot.stats.attack || '-'} 防:${robot.stats.defense || '-'}</p>${robot.stats.manufacturerBonus ? '<p style="color:green;font-size:0.8em;">製造B</p>' : ''}`;
        }
        if (robot.pilot) robotSlotClone.classList.add("has-pilot");

        // 使用済み & 結果表示
        if (robot.used) {
          robotSlotClone.classList.add("used");
          robotSlotClone.style.cursor = "not-allowed";
          const resultLabel = document.createElement("div");
          resultLabel.classList.add("battle-result-label");
          let labelText = "使用済"; let labelClass = "";
          switch (robot.battleResult) {
            case "win": labelText = "勝利"; labelClass = "win"; break;
            case "lose": labelText = "敗北"; labelClass = "lose"; break;
            case "draw": labelText = "引分"; labelClass = "draw"; break;
          }
          resultLabel.textContent = labelText;
          if (labelClass) resultLabel.classList.add(labelClass);
          robotSlotClone.appendChild(resultLabel);
        } else {
          // 未使用ならクリックイベント追加
          robotSlotClone.removeEventListener('click', handleBattleRobotSelection);
          robotSlotClone.addEventListener('click', handleBattleRobotSelection);
          robotSlotClone.style.cursor = "pointer";
        }
        selectionContainer.appendChild(robotSlotClone);
      }
    });
  }

  // プレイヤーが戦闘ロボットを選択した時の処理
  function handleBattleRobotSelection(event) {
    const selectedSlot = event.currentTarget;
    const robotIndex = parseInt(selectedSlot.dataset.robotIndex, 10);
    if (isNaN(robotIndex)) return;

    // 選択状態のUI切り替え
    document.querySelectorAll("#player-battle-robot-selection .robot-slot.selected").forEach(slot => slot.classList.remove("selected"));
    selectedSlot.classList.add("selected");
    gameState.player.selectedRobotIndex = robotIndex;
    console.log(`Player selected Robot ${robotIndex + 1} for battle`);

    // 戦闘開始ボタンを有効化
    if (elements.confirmBattleRobotButton) elements.confirmBattleRobotButton.disabled = false;
  }


  // 「戦闘開始」ボタンが押された時の処理 (戦略的CPU選択)
  function handleConfirmBattleRobot() {
    // プレイヤー選択チェック
    if (gameState.player.selectedRobotIndex < 0) { showMessage("戦闘に出すあなたのロボットを選択してください。", true); return; }
    const playerSelectedRobot = gameState.player.robots[gameState.player.selectedRobotIndex];
    if (!playerSelectedRobot || playerSelectedRobot.used) { showMessage("選択されたロボットは無効か使用済みです。", true); return; }

    // 1. 使用可能なCPUロボットのインデックスリストを作成
    const availableCpuRobotsIndices = gameState.cpu.robots
      .map((robot, index) => (robot && robot.head && robot.upper && robot.lower && !robot.used) ? index : -1)
      .filter((index) => index !== -1);
    if (availableCpuRobotsIndices.length === 0) { showMessage("エラー: CPUが戦闘に出せる未使用のロボットがいません！"); return; }

    // 2. CPUの選択を決定
    const alwaysRandom = Math.random() < 0.2; // 20%で常にランダム
    let cpuChoiceReason = ""; let selectedCpuIndex = -1;

    if (alwaysRandom) {
      selectedCpuIndex = availableCpuRobotsIndices[Math.floor(Math.random() * availableCpuRobotsIndices.length)];
      cpuChoiceReason = "Always Random (20%)";
    } else if (gameState.currentRound === 1) {
      selectedCpuIndex = availableCpuRobotsIndices[Math.floor(Math.random() * availableCpuRobotsIndices.length)];
      cpuChoiceReason = "Round 1 Random";
    } else if (gameState.currentRound === 2) {
      const firstRoundLog = gameState.battleLog[0];
      if (!firstRoundLog) { // ログ欠損時のフォールバック
        selectedCpuIndex = availableCpuRobotsIndices[Math.floor(Math.random() * availableCpuRobotsIndices.length)];
        cpuChoiceReason = "Round 2 Fallback Random (Log Missing)";
      } else {
        const cpuLostFirstRound = firstRoundLog.result === 'win'; // player視点の結果
        if (cpuLostFirstRound) {
          // 1戦目負け: 最強機体選択
          let bestRobotIndex = -1; let maxStatSum = -1;
          availableCpuRobotsIndices.forEach(index => {
            const robot = gameState.cpu.robots[index];
            if (robot && robot.stats && typeof robot.stats.search === 'number') {
              const currentStatSum = robot.stats.search + robot.stats.attack + robot.stats.defense;
              if (currentStatSum > maxStatSum) { maxStatSum = currentStatSum; bestRobotIndex = index; }
            }
          });
          if (bestRobotIndex !== -1) {
            selectedCpuIndex = bestRobotIndex;
            cpuChoiceReason = `Round 2 Strategic (Lost R1): Strongest (Idx ${bestRobotIndex + 1}, Sum ${maxStatSum})`;
          } else { // フォールバック
            selectedCpuIndex = availableCpuRobotsIndices[Math.floor(Math.random() * availableCpuRobotsIndices.length)];
            cpuChoiceReason = "Round 2 Fallback Random (Strongest Undetermined)";
          }
        } else { // 1戦目勝ち/引き分け: ランダム
          selectedCpuIndex = availableCpuRobotsIndices[Math.floor(Math.random() * availableCpuRobotsIndices.length)];
          cpuChoiceReason = "Round 2 Random (Won/Drew R1)";
        }
      }
    } else if (gameState.currentRound === 3) {
      if (availableCpuRobotsIndices.length === 1) {
        selectedCpuIndex = availableCpuRobotsIndices[0];
        cpuChoiceReason = "Round 3 (Last Remaining)";
      } else { // エラーフォールバック
        selectedCpuIndex = availableCpuRobotsIndices[0];
        cpuChoiceReason = "Round 3 Fallback (Count mismatch)";
      }
    } else { // 予期せぬラウンド
      selectedCpuIndex = availableCpuRobotsIndices[Math.floor(Math.random() * availableCpuRobotsIndices.length)];
      cpuChoiceReason = `Fallback Random (Unexpected Round ${gameState.currentRound})`;
    }

    // 3. 選択結果をgameStateに反映
    if (selectedCpuIndex === -1 || !availableCpuRobotsIndices.includes(selectedCpuIndex)) {
      console.error("Error: CPU failed to select a valid robot index. Fallback.");
      selectedCpuIndex = availableCpuRobotsIndices[0];
      cpuChoiceReason += " -> Fallback to first available!";
    }
    gameState.cpu.selectedRobotIndex = selectedCpuIndex;
    console.log(`CPU selected Robot ${gameState.cpu.selectedRobotIndex + 1}. Reason: ${cpuChoiceReason}. (Available: ${availableCpuRobotsIndices.map(i => i + 1).join(', ')})`);

    // 4. 戦闘解決へ
    resolveBattle();
  }

  // 戦闘解決処理
  function resolveBattle() {
    console.log("Resolving Battle...");
    gameState.phase = "battle_resolution";
    showScreen('battle-resolution-screen');
    updateStatusDisplay();
    showMessage(`ラウンド ${gameState.currentRound}: 戦闘解決！`);
    if (elements.battleDisplayArea) elements.battleDisplayArea.style.display = 'flex';

    const playerRobotIndex = gameState.player.selectedRobotIndex;
    const cpuRobotIndex = gameState.cpu.selectedRobotIndex;
    if (playerRobotIndex < 0 || cpuRobotIndex < 0) { /* エラー処理 */ return; } // 選択インデックスチェック
    const playerRobot = gameState.player.robots[playerRobotIndex];
    const cpuRobot = gameState.cpu.robots[cpuRobotIndex];
    if (!playerRobot || !cpuRobot || !playerRobot.stats || !cpuRobot.stats) { /* エラー処理 */ return; } // データ存在チェック

    // 戦闘表示エリアにロボット情報を表示
    displayBattleRobots(playerRobot, cpuRobot);

    // 戦闘ロジック (変更なし)
    let resultMessage = ""; let winner = null;
    const pS = playerRobot.stats.search, pA = playerRobot.stats.attack, pD = playerRobot.stats.defense;
    const cS = cpuRobot.stats.search, cA = cpuRobot.stats.attack, cD = cpuRobot.stats.defense;
    resultMessage += `プレイヤー(R${playerRobotIndex + 1}): 索${pS} 攻${pA} 防${pD}<br>`;
    resultMessage += `CPU(R${cpuRobotIndex + 1}): 索${cS} 攻${cA} 防${cD}<br>--------------------<br>`;
    if (pS > cS) { // Player first
      resultMessage += "プレイヤー先制！ ";
      if (pA > cD) { resultMessage += `攻撃成功！ (${pA} > ${cD})<br><strong style="color:green;">プレイヤー勝利！</strong>`; winner = 'player'; }
      else {
        resultMessage += `攻撃失敗 (${pA} <= ${cD}) → CPU反撃！ `;
        if (cA > pD) { resultMessage += `反撃成功！ (${cA} > ${pD})<br><strong style="color:red;">CPU勝利！</strong>`; winner = 'cpu'; }
        else { resultMessage += `反撃失敗 (${cA} <= ${pD})<br><strong style="color:gray;">引き分け！</strong>`; winner = 'draw'; }
      }
    } else if (cS > pS) { // CPU first
      resultMessage += "CPU先制！ ";
      if (cA > pD) { resultMessage += `攻撃成功！ (${cA} > ${pD})<br><strong style="color:red;">CPU勝利！</strong>`; winner = 'cpu'; }
      else {
        resultMessage += `攻撃失敗 (${cA} <= ${pD}) → プレイヤー反撃！ `;
        if (pA > cD) { resultMessage += `反撃成功！ (${pA} > ${cD})<br><strong style="color:green;">プレイヤー勝利！</strong>`; winner = 'player'; }
        else { resultMessage += `反撃失敗 (${pA} <= ${cD})<br><strong style="color:gray;">引き分け！</strong>`; winner = 'draw'; }
      }
    } else { // Simultaneous
      resultMessage += "同時攻撃！ ";
      const playerHit = pA > cD; const cpuHit = cA > pD;
      if (playerHit && cpuHit) { resultMessage += `相打ち！<br><strong style="color: gray;">引き分け！</strong>`; winner = 'draw'; }
      else if (playerHit) { resultMessage += `プレイヤーのみヒット！<br><strong style="color: green;">プレイヤー勝利！</strong>`; winner = 'player'; }
      else if (cpuHit) { resultMessage += `CPUのみヒット！<br><strong style="color: red;">CPU勝利！</strong>`; winner = 'cpu'; }
      else { resultMessage += `両者耐えた！<br><strong style="color: gray;">引き分け！</strong>`; winner = 'draw'; }
    }

    // 戦闘結果を反映
    let playerBattleResult = 'draw';
    if (winner === "player") { gameState.playerScore++; playerBattleResult = "win"; }
    else if (winner === "cpu") { gameState.cpuScore++; playerBattleResult = "lose"; }
    playerRobot.used = true; playerRobot.battleResult = playerBattleResult;
    cpuRobot.used = true; cpuRobot.battleResult = (winner === 'cpu' ? 'win' : (winner === 'player' ? 'lose' : 'draw'));

    // 対戦ログ記録
    try {
      gameState.battleLog.push({
        round: gameState.currentRound,
        playerRobotIndex: playerRobotIndex,
        cpuRobotIndex: cpuRobotIndex,
        result: playerBattleResult // プレイヤー視点の結果
      });
      console.log("Battle log recorded:", gameState.battleLog[gameState.battleLog.length - 1]);
    } catch (e) { console.error("Failed to record battle log:", e); }

    updateStatusDisplay(); // スコア表示更新

    // 結果メッセージ表示
    if (elements.battleResultMessage) elements.battleResultMessage.innerHTML = resultMessage;
    else console.error("Battle Result Message element not cached!");

    // 次のアクションボタン表示
    showNextActionButtons();
    console.log("Battle resolution finished.");
  }

  // 戦闘エリアに選択されたロボットを表示
  function displayBattleRobots(playerRobot, cpuRobot) {
    displayRobotInBattleSlot(elements.playerBattleRobotSlot, playerRobot, gameState.player.selectedRobotIndex);
    displayRobotStats(elements.playerBattleStats, playerRobot.stats);
    displayRobotInBattleSlot(elements.cpuBattleRobotSlot, cpuRobot, gameState.cpu.selectedRobotIndex);
    displayRobotStats(elements.cpuBattleStats, cpuRobot.stats);
  }

  // 特定のスロットにロボット情報を表示 (インデックスも引数に追加)
  function displayRobotInBattleSlot(slotElement, robotData, robotIndex) {
    if (!slotElement || !robotData) return;
    slotElement.innerHTML = ""; // クリア
    slotElement.classList.remove("has-pilot");

    const headCard = robotData.head ? createGameCardElement(robotData.head, false) : document.createElement('div');
    const upperCard = robotData.upper ? createGameCardElement(robotData.upper, false) : document.createElement('div');
    const lowerCard = robotData.lower ? createGameCardElement(robotData.lower, false) : document.createElement('div');
    const ownerLabel = slotElement.id.includes('player') ? "プレイヤー" : "CPU";

    slotElement.innerHTML = `
          <h4>${ownerLabel} ロボット ${robotIndex + 1} ${robotData.pilot ? "(P)" : ""}</h4>
          <div class="part-slot head-slot"></div>
          <div class="part-slot upper-body-slot"></div>
          <div class="part-slot lower-body-slot"></div>
      `;
    const headSlot = slotElement.querySelector(".head-slot");
    const upperSlot = slotElement.querySelector(".upper-body-slot");
    const lowerSlot = slotElement.querySelector(".lower-body-slot");
    if (headSlot && headCard) headSlot.appendChild(headCard);
    if (upperSlot && upperCard) upperSlot.appendChild(upperCard);
    if (lowerSlot && lowerCard) lowerSlot.appendChild(lowerCard);

    if (robotData.pilot) slotElement.classList.add("has-pilot");
  }

  // 特定のエリアにロボットステータスを表示
  function displayRobotStats(statsElement, statsData) {
    if (!statsElement || !statsData) return;
    statsElement.innerHTML = `
          <p>索敵: ${statsData.search ?? 0}</p>
          <p>攻撃: ${statsData.attack ?? 0}</p>
          <p>防御: ${statsData.defense ?? 0}</p>
          ${statsData.manufacturerBonus ? '<p style="color: green; font-size: 0.9em;">(製造所ボーナス +1)</p>' : ""}
      `;
  }

  // 次のラウンドへ進むか、最終結果表示かのボタンを表示
  function showNextActionButtons() {
    const isFinalRound = gameState.currentRound >= NUM_ROUNDS;
    if (elements.nextRoundButton) {
      elements.nextRoundButton.style.display = isFinalRound ? "none" : "inline-block";
      elements.nextRoundButton.removeEventListener('click', handleNextRound);
      if (!isFinalRound) elements.nextRoundButton.addEventListener('click', handleNextRound);
    }
    if (elements.showFinalResultButton) {
      elements.showFinalResultButton.style.display = isFinalRound ? "inline-block" : "none";
      elements.showFinalResultButton.removeEventListener('click', handleShowFinalResult);
      if (isFinalRound) elements.showFinalResultButton.addEventListener('click', handleShowFinalResult);
    }
  }

  // 次のラウンドへ進む処理
  function handleNextRound() {
    gameState.currentRound++;
    prepareBattleSelection(); // 次の戦闘選択準備へ
  }

  // 最終結果表示処理
  // game.js の handleShowFinalResult 関数を修正
  function handleShowFinalResult() {
    console.log("Attempting to show Final Result screen..."); // ログ追加
    gameState.phase = "game_over";
    showScreen('game-over-screen'); // これで表示されるはず

    // ★ 表示されたか確認ログを追加 ★
    const gameOverScreenElement = document.getElementById('game-over-screen');
    if (gameOverScreenElement) {
      console.log(`game-over-screen display style after showScreen: ${gameOverScreenElement.style.display}`);
      // スタイルが 'none' のままなら showScreen 関数に問題がある可能性
    } else {
      console.error("FATAL: game-over-screen element NOT FOUND after trying to show it!");
      showMessage("エラー: ゲームオーバー画面の要素が見つかりません。", true);
      return; // 要素がないと何もできないので中断
    }

    updateStatusDisplay(); // ステータス表示更新

    // --- UI要素取得 (キャッシュを使うように統一) ---
    const finalResultMsgElement = elements.finalResultMessage; // キャッシュから取得
    const playAgainButtonElement = elements.playAgainButton; // キャッシュから取得
    const battleLogContainer = document.getElementById('battle-pairing-log');
    const finalPlayerRobotsContainer = document.querySelector('#final-player-robots .robot-slots-container');
    const finalCpuRobotsContainer = document.querySelector('#final-cpu-robots .robot-slots-container');

    // 必須要素の存在チェック (より丁寧に)
    let missingElements = [];
    if (!finalResultMsgElement) missingElements.push('finalResultMessage (cache)');
    if (!playAgainButtonElement) missingElements.push('playAgainButton (cache)');
    // game.html の構造に合わせて修正
    if (!battleLogContainer) missingElements.push('#battle-pairing-log');
    if (!finalPlayerRobotsContainer) missingElements.push('#final-player-robots .robot-slots-container');
    if (!finalCpuRobotsContainer) missingElements.push('#final-cpu-robots .robot-slots-container');

    if (missingElements.length > 0) {
      const errorMsg = `エラー: ゲームオーバー画面の表示に必要な要素が見つかりません: ${missingElements.join(', ')}`;
      console.error(errorMsg);
      showMessage(errorMsg, true);
      // 要素がなくても表示自体は試みる
    }

    // --- 1. 最終結果メッセージ表示 ---
    let finalMessage = `最終結果: プレイヤー ${gameState.playerScore}勝 - CPU ${gameState.cpuScore}勝<br>`;
    if (gameState.playerScore > gameState.cpuScore) { finalMessage += '<strong style="color: green; font-size: 1.2em;">プレイヤーの勝利！</strong>'; }
    else if (gameState.cpuScore > gameState.playerScore) { finalMessage += '<strong style="color: red; font-size: 1.2em;">CPUの勝利！</strong>'; }
    else { finalMessage += '<strong style="color: gray; font-size: 1.2em;">引き分け！</strong>'; }
    if (finalResultMsgElement) { // null チェック
      finalResultMsgElement.innerHTML = finalMessage;
    }

    // --- 2. 対戦履歴表示 ---
    if (battleLogContainer) { // null チェック
      battleLogContainer.innerHTML = ""; // クリア
      if (gameState.battleLog && gameState.battleLog.length > 0) {
        const logList = document.createElement('ul');
        logList.style.listStyleType = 'none'; logList.style.paddingLeft = '0';
        gameState.battleLog.forEach(logEntry => {
          const listItem = document.createElement('li');
          listItem.style.marginBottom = '5px';
          let resultText = "", resultColor = "gray";
          switch (logEntry.result) {
            case 'win': resultText = "勝利"; resultColor = "green"; break;
            case 'lose': resultText = "敗北"; resultColor = "red"; break;
            case 'draw': resultText = "引分"; resultColor = "gray"; break;
          }
          listItem.innerHTML = `ラウンド ${logEntry.round}: あなたのロボット ${logEntry.playerRobotIndex + 1} vs CPUロボット ${logEntry.cpuRobotIndex + 1} → <strong style="color:${resultColor};">${resultText}</strong>`;
          logList.appendChild(listItem);
        });
        battleLogContainer.appendChild(logList);
      } else { battleLogContainer.textContent = "対戦履歴はありません。"; }
    } else { console.warn("Battle log container (#battle-pairing-log) not found."); }

    // --- 3. 最終ロボット構成表示 ---
    if (finalPlayerRobotsContainer) { // null チェック
      finalPlayerRobotsContainer.innerHTML = "";
      gameState.player.robots.forEach((robot, index) => {
        const robotElement = createRobotDisplayElement(robot, index, 'あなた');
        if (robotElement) finalPlayerRobotsContainer.appendChild(robotElement);
      });
    } else { console.warn("Player final robots container not found."); }

    if (finalCpuRobotsContainer) { // null チェック
      finalCpuRobotsContainer.innerHTML = "";
      gameState.cpu.robots.forEach((robot, index) => {
        // calculateCpuRobotStats(index); // 計算済みのはず
        const robotElement = createRobotDisplayElement(robot, index, 'CPU');
        if (robotElement) finalCpuRobotsContainer.appendChild(robotElement);
      });
    } else { console.warn("CPU final robots container not found."); }


    // --- 4. もう一度プレイボタンのリスナー設定 ---
    if (playAgainButtonElement) { // null チェック
      playAgainButtonElement.removeEventListener('click', handlePlayAgain);
      playAgainButtonElement.addEventListener('click', handlePlayAgain);
    } else { console.warn("Play again button element not found in cache."); }

    console.log("Final Result screen setup complete.");
  }
  /**
   * 最終結果表示用のロボット要素を作成
   */
  function createRobotDisplayElement(robotData, index, ownerLabel) {
    console.log(`Creating display element for ${ownerLabel}'s Robot ${index + 1}`);
    if (!robotData) return null;

    const robotSlotElement = document.createElement("div");
    robotSlotElement.classList.add("robot-slot", "final-robot-view");
    robotSlotElement.dataset.robotIndex = String(index);

    const headCard = robotData.head ? createGameCardElement(robotData.head, false) : document.createElement('div');
    const upperCard = robotData.upper ? createGameCardElement(robotData.upper, false) : document.createElement('div');
    const lowerCard = robotData.lower ? createGameCardElement(robotData.lower, false) : document.createElement('div');

    robotSlotElement.innerHTML = `
          <h4>${ownerLabel}${index + 1} ${robotData.pilot ? "(P)" : ""}</h4>
          <div class="part-slot head-slot">${!robotData.head ? '頭なし' : ''}</div>
          <div class="part-slot upper-body-slot">${!robotData.upper ? '上半身なし' : ''}</div>
          <div class="part-slot lower-body-slot">${!robotData.lower ? '下半身なし' : ''}</div>
          <div class="robot-stats final-stats"></div>
          ${robotData.pilot ? '<div class="pilot-display-area"></div>' : ''}
      `;
    const headSlot = robotSlotElement.querySelector(".head-slot");
    const upperSlot = robotSlotElement.querySelector(".upper-body-slot");
    const lowerSlot = robotSlotElement.querySelector(".lower-body-slot");
    if (headSlot && headCard instanceof Node) headSlot.appendChild(headCard);
    if (upperSlot && upperCard instanceof Node) upperSlot.appendChild(upperCard);
    if (lowerSlot && lowerCard instanceof Node) lowerSlot.appendChild(lowerCard);

    // ステータス表示
    const statsElement = robotSlotElement.querySelector(".robot-stats.final-stats");
    if (statsElement && robotData.stats) {
      statsElement.innerHTML = `
              <p>索:${robotData.stats.search ?? '-'} 攻:${robotData.stats.attack ?? '-'} 防:${robotData.stats.defense ?? '-'}</p>
              ${robotData.stats.manufacturerBonus ? '<p style="color:green;font-size:0.8em;">製造B</p>' : ''}
          `;
    } else if (statsElement) { // statsがない場合でも最低限の表示
      statsElement.innerHTML = `<p>索:- 攻:- 防:-</p>`;
    }

    // パイロット表示
    if (robotData.pilot) {
      robotSlotElement.classList.add('has-pilot');
      const pilotDisplayArea = robotSlotElement.querySelector('.pilot-display-area');
      if (pilotDisplayArea) {
        const pilotCardElement = createGameCardElement(robotData.pilot, false);
        if (pilotCardElement) {
          pilotCardElement.classList.add('assigned-pilot'); // 小さいスタイル適用
          pilotDisplayArea.appendChild(pilotCardElement);
        }
      }
    }
    return robotSlotElement;
  }

  /**
   * 「もう一度プレイ」ボタン処理
   */
  async function handlePlayAgain() {
    console.log("Play Again button clicked");
    // 同じカードデータでゲームをリセットして開始
    // startGame は内部で resetGame を呼ぶ
    // 最新のDBデータを再ロードして開始するのがより安全
    try {
      const result = await loadAllCardDataFromDB();
      if (result && result.data) {
        startGame(result.data);
      } else {
        throw new Error("Failed to reload card data.");
      }
    } catch (error) {
      console.error("Error restarting game:", error);
      showMessage("エラー: ゲームの再開に失敗しました。", false);
      // エラー時はアイドル状態に戻すなど
      resetGame();
      gameState.phase = 'idle';
      updateStatusDisplay();
      showScreen('game-over-screen'); // とりあえず終了画面のまま
    }
  }


  // ゲーム状態リセット (UIリセットは resetDesignAreaUI などで行う)
  function resetGame() {
    console.log("Resetting game state...");
    gameState.currentRound = 0;
    gameState.playerScore = 0;
    gameState.cpuScore = 0;
    gameState.battleLog = [];
    gameState.player = {
      hand: { head: [], upper: [], lower: [] }, pilotCard: null, robots: [],
      selectedRobotIndex: -1, hasDesigned: false, selectedCardIdForClick: null,
    };
    gameState.cpu = {
      hand: { head: [], upper: [], lower: [] }, pilotCard: null, robots: [],
      selectedRobotIndex: -1, hasDesigned: false,
    };
    // ロボット配列の初期化は startGame / enterDesignPhase で行う

    // UIリセット呼び出し
    resetDesignAreaUI(); // 設計エリアUI
    if (elements.battleResultMessage) elements.battleResultMessage.textContent = "";
    if (elements.nextRoundButton) elements.nextRoundButton.style.display = "none";
    if (elements.showFinalResultButton) elements.showFinalResultButton.style.display = "none";
    if (elements.confirmDesignButton) elements.confirmDesignButton.disabled = true;
    if (elements.confirmBattleRobotButton) elements.confirmBattleRobotButton.disabled = true;

    // 各画面を非表示にする (showScreenで制御されるが念のため)
    document.querySelectorAll('.game-screen').forEach(screen => {
      if (screen.id !== 'design-screen') { // 開始は設計画面からなのでそれ以外を非表示
        screen.style.display = 'none';
      }
    });


    // 状態表示リセット
    updateStatusDisplay();
  }

  // --- インポート処理 ---


  // --- インポート処理関数 (デバッグ強化版) ---
  async function handleGameImport(event) {
    const file = event.target.files[0];
    const inputElement = event.target;
    if (!file) return;
    console.log(`[Game Import] Starting import for file: ${file.name}`);

    // 確認ダイアログ (変更なし)
    if (gameState.phase !== 'idle' && gameState.phase !== 'game_over') {
      if (!confirm("現在プレイ中のゲームがあります。\nインポートすると現在のカードデータが上書きされ、新しいゲームが開始されます。\nよろしいですか？")) {
        inputElement.value = ""; return;
      }
    } else {
      if (!confirm("カードデータをインポートします。\n現在のカードデータは上書きされ、新しいゲームが開始されます。\nよろしいですか？")) {
        inputElement.value = ""; return;
      }
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      let loadedDataForGame = null; // ロードしたデータを格納する変数
      try {
        const jsonContent = e.target.result;
        console.log("[Game Import] File read successfully.");
        const importedDataArray = JSON.parse(jsonContent);
        console.log("[Game Import] JSON parsed successfully.");

        // データ検証 (変更なし)
        if (!Array.isArray(importedDataArray)) throw new Error("Invalid file format (not an array).");
        if (importedDataArray.length === 0) throw new Error("Import data is empty.");
        console.log(`[Game Import] Found ${importedDataArray.length} items in the array.`);
        const isValidData = importedDataArray.every(card => card && typeof card.id === 'string');
        if (!isValidData) console.warn("[Game Import] Some imported card data might be invalid...");

        // DB関数チェック (変更なし)
        if (typeof clearAllDBData !== 'function' || typeof saveCardData !== 'function' || typeof loadAllCardDataFromDB !== 'function') {
          throw new Error("Database functions not found.");
        }

        // 1. DBクリア
        console.log("[Game Import] Clearing existing DB data...");
        await clearAllDBData(); // db.js の関数呼び出し
        console.log("[Game Import] DB cleared.");

        // 2. インポートデータ保存
        console.log("[Game Import] Saving imported data to DB...");
        let savedCount = 0;
        const savePromises = importedDataArray.map(card => {
          if (card && card.id) {
            const cardToSave = { id: card.id, page: card.page || 0, index: card.index || 0, image: card.image || null, manufacturer: card.manufacturer ?? "", value: card.value ?? "", part: card.part || "" };
            return saveCardData(cardToSave.id, cardToSave).then(() => { savedCount++; }); // db.js の関数呼び出し
          } else { return Promise.resolve(); }
        });
        // ★★★ すべての保存処理が完了するのを待つ ★★★
        await Promise.all(savePromises);
        console.log(`[Game Import] ${savedCount} cards save operations completed.`);
        if (savedCount === 0 && importedDataArray.length > 0) {
          throw new Error("有効なカードデータをファイルから保存できませんでした。");
        }

        // ★★★ 3. DBからデータを **再ロード** ★★★
        console.log("[Game Import] Reloading data from DB after save...");
        // loadAllCardDataFromDB が完了するのを待つ
        const result = await loadAllCardDataFromDB(); // db.js の関数呼び出し
        console.log("[Game Import] Data reloaded from DB:", result); // ★ ロード結果をログ出力

        // ★★★ ロード結果を厳密にチェック ★★★
        if (!result || !result.data || typeof result.data !== 'object' || Object.keys(result.data).length === 0) {
          // ★ 保存は完了したが、ロードで失敗した場合 ★
          console.error("[Game Import] Failed to load data correctly from DB after import, or data is empty. Result:", result);
          // 保存されたはずなのに読めない -> DB周りの問題の可能性
          throw new Error("データのインポートは完了しましたが、再読み込みに失敗しました。");
        }

        loadedDataForGame = result.data; // ★ ロード成功したデータを変数に格納
        console.log(`[Game Import] Successfully loaded ${Object.keys(loadedDataForGame).length} cards from DB for game start.`);

        // ★★★ 4. ゲーム開始 (ロード成功後に行う) ★★★
        gameManager.startGame(loadedDataForGame);
        showMessage("カードデータをインポートし、新しいゲームを開始しました。", false);

      } catch (error) {
        console.error("[Game Import] Failed:", error);
        alert(`インポート処理中にエラーが発生しました。\nエラー: ${error.message}`);
        // エラー発生時はゲームをリセット
        resetGame();
        gameState.phase = 'idle';
        updateStatusDisplay();
        showMessage("カードデータのインポートに失敗しました。", false);
      } finally {
        inputElement.value = ""; // 成功・失敗に関わらず input をリセット
      }
    };
    reader.onerror = (error) => {
      console.error("[Game Import] File read error:", error);
      alert("ファイルの読み込みに失敗しました。");
      inputElement.value = "";
    };
    reader.readAsText(file);
  }


  // 初期化処理 (DOM要素取得、イベントリスナー設定)
  function init() {
    console.log("Initializing gameManager...");
    // DOM要素キャッシュ
    elements.gameContainer = document.getElementById("game-container");
    elements.gamePhase = document.getElementById("game-phase");
    elements.roundInfo = document.getElementById("round-info");
    elements.playerScore = document.getElementById("player-score");
    elements.cpuScore = document.getElementById("cpu-score");
    elements.gameMessageArea = document.getElementById("game-message-area");
    elements.gameMessage = document.getElementById("game-message");
    elements.playerHandCards = document.getElementById("player-hand-cards");
    elements.playerHandCount = document.getElementById("player-hand-count");
    elements.playerPilotCardArea = document.getElementById("player-pilot-card");
    elements.playerRobotSlots = document.getElementById("player-robot-slots"); // 設計スロットコンテナ
    elements.confirmDesignButton = document.getElementById("confirm-design-button");
    // elements.cpuStatus = document.getElementById("cpu-status"); // HTMLに存在しないなら削除
    // elements.battleArea = document.getElementById("battle-area"); // 不要かも
    elements.battleSelectionArea = document.getElementById("battle-selection-area"); // game.htmlに存在しないなら削除
    elements.playerBattleRobotSelection = document.getElementById("player-battle-robot-selection");
    elements.confirmBattleRobotButton = document.getElementById("confirm-battle-robot-button");
    elements.battleDisplayArea = document.getElementById("battle-display-area");
    elements.playerBattleRobotSlot = document.getElementById("player-battle-robot");
    elements.playerBattleStats = document.getElementById("player-battle-stats");
    elements.cpuBattleRobotSlot = document.getElementById("cpu-battle-robot");
    elements.cpuBattleStats = document.getElementById("cpu-battle-stats");
    elements.battleResultArea = document.getElementById("battle-result-area");
    elements.battleResultMessage = document.getElementById("battle-result-message");
    elements.nextRoundButton = document.getElementById("next-round-button");
    elements.showFinalResultButton = document.getElementById("show-final-result-button");
    elements.gameOverScreen = document.getElementById("game-over-screen");
    elements.finalResultMessage = document.getElementById("final-result-message");
    elements.playAgainButton = document.getElementById("play-again-button");
    elements.importFileInput = document.getElementById("game-import-file-input");
    elements.importButtonLabel = document.getElementById("game-import-button-label");

    // イベントリスナー設定
    if (elements.importFileInput) {
      elements.importFileInput.addEventListener('change', handleGameImport);
    } else {
      console.error("Game Import File Input element not found during init!");
    }
    // 他のボタンリスナーは必要に応じて各フェーズ開始時に設定/解除

    // 初期状態設定
    gameState.phase = "idle";
    updateStatusDisplay();
    // showScreen('idle-screen'); // 初期画面は game.html 側で表示済み
    // showMessage は startGame で上書きされる

    console.log("gameManager initialized.");
    // DB初期化は game.html の DOMContentLoaded で行うため、ここでは不要
  }

  // --- 公開メソッド ---
  return {
    init: init,
    startGame: startGame,
    resetGame: resetGame,
    // 他の内部関数は公開しない
  };
})();

// 注意: game.html の DOMContentLoaded で initDB() を呼び出し、
// その後 loadAllCardDataFromDB() でデータを取得してから
// gameManager.init() と gameManager.startGame(loadedData) を呼び出す必要があります。
// (game.html の <script> 内で実装済みのはず)