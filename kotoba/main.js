// main.js

document.addEventListener('DOMContentLoaded', () => {
  // --- シミュレーションの物理スケール定義 ---
  const SCALE = 0.1; // 1ユニット = 0.1メートル (10cm)

  // --- グローバル状態 ---
  let apiKey = '';
  let selectedModel = '';
  let personas = [];
  let worldState = {};
  let collectiveIntelligence = {}; // ★★★ 集合知の状態を追加 ★★★
  let eventLog = [];
  let worldview = '';

  // --- DOM要素 ---
  const apiKeyInput = document.getElementById('api-key-input');
  const saveApiKeyBtn = document.getElementById('save-api-key');
  const modelSelectEl = document.getElementById('model-select');
  const refreshModelsBtn = document.getElementById('refresh-models-btn');
  const worldviewInput = document.getElementById('worldview-input');
  const saveWorldviewBtn = document.getElementById('save-worldview-btn');
  const addPersonaBtn = document.getElementById('add-persona-btn');
  const proceedTimeBtn = document.getElementById('proceed-time-btn');
  const clearWorldBtn = document.getElementById('clear-world-btn');
  const personaListEl = document.getElementById('persona-list');
  const logsEl = document.getElementById('logs');
  const canvas = document.getElementById('world-canvas');
  const ctx = canvas.getContext('2d');
  const worldJsonDisplayEl = document.getElementById('world-json-display');
  const ciJsonDisplayEl = document.getElementById('ci-json-display'); // ★★★ 集合知表示用の要素を追加 ★★★
  const tabButtons = document.querySelectorAll('.tab-btn'); // ★★★ タブボタンを追加 ★★★
  const tabContents = document.querySelectorAll('.tab-content'); // ★★★ タブコンテンツを追加 ★★★
  const modal = document.getElementById('persona-modal');
  const savePersonaBtn = document.getElementById('save-persona-btn');
  const cancelPersonaBtn = document.getElementById('cancel-persona-btn');
  const personaNameInput = document.getElementById('persona-name');
  const personaPromptInput = document.getElementById('persona-prompt');
  const personaGoalsInput = document.getElementById('persona-goals');

  // --- 状態の保存・読み込み ---
  function saveState() {
    localStorage.setItem('ai-world-personas', JSON.stringify(personas));
    localStorage.setItem('ai-world-worldState', JSON.stringify(worldState));
    localStorage.setItem(
      'ai-world-collectiveIntelligence',
      JSON.stringify(collectiveIntelligence)
    ); // ★★★ 集合知を保存 ★★★
    localStorage.setItem('ai-world-eventLog', JSON.stringify(eventLog));
    localStorage.setItem('ai-world-worldview', worldview);
  }

  function loadState() {
    apiKey = localStorage.getItem('gemini-api-key') || '';
    selectedModel =
      localStorage.getItem('selected-model') || 'gemini-1.5-flash-latest';
    worldview =
      localStorage.getItem('ai-world-worldview') ||
      'ここは現代の日本の都市、新宿。高層ビルが立ち並び、多くの人々が行き交う。あなたがいるのは「株式会社如月」というIT企業のオフィス付近で、最寄り駅は新宿駅西口である。';

    const savedPersonas = localStorage.getItem('ai-world-personas');
    personas = (savedPersonas ? JSON.parse(savedPersonas) : []).map((p) => ({
      ...p,
      memory: p.memory || [],
    }));

    const savedWorldState = localStorage.getItem('ai-world-worldState');
    worldState = savedWorldState
      ? JSON.parse(savedWorldState)
      : {
          spaces: {
            shinjuku_outside: {
              type: 'outdoor',
              name: '新宿屋外',
              features: {
                entrance_kisaragi: {
                  type: 'portal',
                  name: '株式会社如月の正面玄関',
                  location: {x: 400, y: 300, z: 0},
                  target: {spaceId: 'kisaragi_corp_1F', x: 50, y: 50, z: 0},
                },
              },
            },
            kisaragi_corp_1F: {
              type: 'floor',
              name: '株式会社如月 1F',
              elevation: 0,
              features: {
                exit_kisaragi: {
                  type: 'portal',
                  name: '屋外への出口',
                  location: {x: 50, y: 50, z: 0},
                  target: {spaceId: 'shinjuku_outside', x: 400, y: 300, z: 0},
                },
              },
            },
          },
          objects: {},
        };

    // ★★★ 集合知を読み込み ★★★
    const savedCI = localStorage.getItem('ai-world-collectiveIntelligence');
    collectiveIntelligence = savedCI
      ? JSON.parse(savedCI)
      : {known_features: {}};

    const savedEventLog = localStorage.getItem('ai-world-eventLog');
    eventLog = savedEventLog ? JSON.parse(savedEventLog) : [];
  }

  // --- 初期化 ---
  function initialize() {
    loadState();
    apiKeyInput.value = apiKey;
    worldviewInput.value = worldview;
    canvas.width = document.getElementById('world-pane').clientWidth;
    canvas.height = document.getElementById('world-pane').clientHeight;
    updatePersonaList();
    drawWorld();
    updateStateDisplays(); // ★★★ 表示更新関数を統合 ★★★
    renderFullLog();
    loadAndPopulateModels();
    setupTabs(); // ★★★ タブのセットアップ関数を呼び出し ★★★
  }

  async function loadAndPopulateModels() {
    if (!apiKey) {
      modelSelectEl.innerHTML =
        '<option value="">APIキーを入力してください</option>';
      return;
    }
    modelSelectEl.disabled = true;
    modelSelectEl.innerHTML = '<option value="">モデルを読み込み中...</option>';
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message);
      }
      const data = await response.json();
      const supportedModels = data.models.filter((model) =>
        model.supportedGenerationMethods.includes('generateContent')
      );
      modelSelectEl.innerHTML = '';
      if (supportedModels.length === 0) {
        modelSelectEl.innerHTML =
          '<option value="">利用可能なモデルがありません</option>';
        return;
      }
      supportedModels.forEach((model) => {
        const modelId = model.name.replace('models/', '');
        const option = document.createElement('option');
        option.value = modelId;
        option.textContent = model.displayName || modelId;
        modelSelectEl.appendChild(option);
      });
      const savedModel = localStorage.getItem('selected-model');
      if (
        savedModel &&
        modelSelectEl.querySelector(`option[value="${savedModel}"]`)
      ) {
        modelSelectEl.value = savedModel;
      } else if (supportedModels.length > 0) {
        modelSelectEl.value = supportedModels[0].name.replace('models/', '');
      }
      selectedModel = modelSelectEl.value;
    } catch (error) {
      console.error('Failed to load models:', error);
      modelSelectEl.innerHTML = `<option value="">モデル取得失敗</option>`;
      addLogEntryToUI(
        'System',
        `モデルリストの取得に失敗しました: ${error.message}`,
        'action error'
      );
    } finally {
      modelSelectEl.disabled = false;
    }
  }

  async function callGemini(prompt) {
    if (!apiKey) throw new Error('APIキー未設定');
    if (!selectedModel) throw new Error('AIモデルが選択されていません');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
    const requestBody = {
      contents: [{parts: [{text: prompt}]}],
      safetySettings: [
        {category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE'},
        {category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE'},
        {category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE'},
        {category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE'},
      ],
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${errorData.error.message}`);
    }
    const data = await response.json();
    if (
      data.candidates &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0].text
    ) {
      return data.candidates[0].content.parts[0].text;
    } else {
      console.error('Unexpected API response structure:', data);
      throw new Error('予期せぬAPIレスポンス形式です。');
    }
  }

async function runPersonaTurn(persona) {
    const privateMemory = persona.memory.slice(-5).map(log => `[自分の過去の${log.type}] ${log.message}`).join('\n');
    const publicEvents = eventLog.slice(-5).map(log => `[${log.personaName}の行動] ${log.message}`).join('\n');
    
    const perceptionRadius = 30 / SCALE;
    const visibleFeatures = getVisibleFeatures(persona.location, perceptionRadius);

    const worldDescription = `
        [世界観の基本設定]
        ${worldview}
        
        [集合知（全エージェントの共有知識）]
        ${JSON.stringify(collectiveIntelligence.known_features, null, 2)}

        [現在のあなたの状態]
        { "id": "${persona.id}", "name": "${persona.name}", "location": ${JSON.stringify(persona.location)} }
        
        [あなたの視界（半径30m以内）にあるもの]
        ${JSON.stringify(visibleFeatures, null, 2)}

        [あなたの過去の記憶（プライベート）]
        ${privateMemory || "（なし）"}
        
        [最近の世界の出来事（全員が観測可能）]
        ${publicEvents || "（なし）"}
    `;
    
    // ★★★ 修正点：指示とアクションの例を更新 ★★★
    const prompt = `
        あなたはエージェントです。現在の状況に基づき、次の行動をJSONで出力してください。
        ---
        ${persona.prompt}
        [目的]
        ${persona.goals.map(g => `- ${g.description}`).join('\n')}
        
        [状況]
        ${worldDescription}
        ---
        [指示]
        1.  あなたの目的を達成するため、[集合知]や[視界]の情報を元に行動計画を立ててください。
        2.  目的地への移動には'MOVE'アクションを使用します。
        3.  新しい公共の設備やランドマークを発見した場合、'SHARE_DISCOVERY'アクションで集合知に登録してください。
        4.  もしあなたの視界や集合知に有益な情報がなく、次に行うべき行動が明確でない場合、あなたは[世界観の基本設定]に基づいて周囲の環境を**創造（想像）**し、'MODIFY_WORLD'アクションを使って世界に新しい情報を追加することができます。
        5.  出力はJSON形式のみとし、前後に\`\`\`jsonと\`\`\`を必ず付けてください。思考とアクションの両方を含めてください。

        [アクション形式の例]
        // 例1: 移動する場合
        \`\`\`json
        {
            "thought": "目的地へ移動する必要があるため、座標(x,y)へ向かう。",
            "action": {
                "type": "MOVE",
                "details": { "target": { "x": 123, "y": 456, "z": 0 } }
            }
        }
        \`\`\`

        // 例2: 発見を共有する場合
        \`\`\`json
        {
            "thought": "これは新しい店舗のようだ。他の皆にも知らせるべきだろう。",
            "action": {
                "type": "SHARE_DISCOVERY",
                "details": {
                    "feature": { "type": "shop", "name": "コンビニエンスストア", "location": { "x": 150, "y": 200, "z": 0, "spaceId": "shinjuku_outside" } }
                }
            }
        }
        \`\`\`
        
        // 例3: 周囲の環境を創造する場合
        \`\`\`json
        {
            "thought": "ここは新宿のオフィス街のはずだ。目の前には大きなガラス張りのエントランスを持つ高層ビルがあるだろう。",
            "action": {
                "type": "MODIFY_WORLD",
                "details": {
                    "content": "目の前に、大きなガラス張りのエントランスを持つ高層ビルがそびえ立っている。"
                }
            }
        }
        \`\`\`
    `;

    // ... (try-catchブロック内のAPI呼び出しとレスポンス処理は変更なし)
    let rawResponse = '';
    try {
        addLogEntryToUI(persona.name, "思考中...", 'thought');
        rawResponse = await callGemini(prompt);
        const jsonString = rawResponse.match(/```json\n([\s\S]*?)\n```/)?.[1];
        if (!jsonString) { throw new Error("応答からJSON(行動決定)が見つかりませんでした。"); }
        const decision = JSON.parse(jsonString);
        persona.memory.push({ type: 'thought', message: decision.thought, timestamp: new Date().toISOString() });
        addLogEntryToUI(persona.name, `思考プロセス: ${decision.thought}`, 'thought');
        executeAction(persona, decision.action);
    } catch (error) {
        console.error("An error occurred in runPersonaTurn:", error);
        addLogEntryToUI(persona.name, `エラー: ${error.message}`, 'action error');
        addLogEntryToUI(persona.name, `AIからの未処理の応答:\n${rawResponse}`, 'action error');
    }
}

  function getVisibleFeatures(location, radius) {
    const visible = {};
    const currentSpaceId = location.spaceId;
    const currentZ = location.z;

    const currentSpaceFeatures =
      worldState.spaces[currentSpaceId]?.features || {};

    for (const id in currentSpaceFeatures) {
      const feature = currentSpaceFeatures[id];
      if (feature.type === 'portal') {
        const dx = feature.location.x - location.x;
        const dy = feature.location.y - location.y;
        const distance = Math.sqrt(dx * dx + dy * dy) * SCALE;
        if (distance <= 30) {
          visible[id] = feature;
        }
        continue;
      }
      if (Math.abs(feature.location.z - currentZ) * SCALE > 2) continue;
      const dx = feature.location.x - location.x;
      const dy = feature.location.y - location.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= radius) {
        visible[id] = feature;
      }
    }
    return visible;
  }

  // ★★★ アクションの実行 ★★★
  function executeAction(persona, action) {
    const actionDetails = action.details || {};
    let actionMessage = ``;

    if (action.type === 'MOVE') {
      const targetLocation =
        action.details.target ||
        action.details.destination ||
        action.details.targetLocation;
      // 安全のためのチェック
      if (!targetLocation) {
        actionMessage = `[${action.type}] FAILED: 移動先の座標オブジェクトがAIの応答に含まれていません。`;
        addLogEntryToUI(persona.name, actionMessage, 'action error');
        return; // ここで処理を中断
      }
      const speed = 50;

      const currentSpace = worldState.spaces[persona.location.spaceId];
      let portalUsed = false;
      if (currentSpace && currentSpace.features) {
        for (const id in currentSpace.features) {
          const feature = currentSpace.features[id];
          if (feature.type === 'portal') {
            const dx = feature.location.x - persona.location.x;
            const dy = feature.location.y - persona.location.y;
            const distToPortal = Math.sqrt(dx * dx + dy * dy);
            if (distToPortal * SCALE < 1) {
              persona.location = {...feature.target};
              actionMessage = `ENTERED ${feature.target.spaceId} via ${feature.name}`;
              portalUsed = true;
              break;
            }
          }
        }
      }

      if (!portalUsed) {
        const dx = targetLocation.x - persona.location.x;
        const dy = targetLocation.y - persona.location.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < speed) {
          persona.location.x = targetLocation.x;
          persona.location.y = targetLocation.y;
          actionMessage = `ARRIVED at (${Math.round(
            persona.location.x * SCALE
          )}m, ${Math.round(persona.location.y * SCALE)}m)`;
        } else {
          persona.location.x += (dx / distance) * speed;
          persona.location.y += (dy / distance) * speed;
          actionMessage = `to (${Math.round(
            targetLocation.x * SCALE
          )}m, ${Math.round(targetLocation.y * SCALE)}m) in ${
            persona.location.spaceId
          }`;
        }
      }
      actionMessage = `to (${Math.round(
        persona.location.x * SCALE
      )}m, ${Math.round(persona.location.y * SCALE)}m) in ${
        persona.location.spaceId
      }`;
    } else if (action.type === 'MODIFY_WORLD') {
      const modification = actionDetails.content;
      const featureId = `feature_${Date.now()}`;
      const space = worldState.spaces[persona.location.spaceId];
      if (space) {
        if (!space.features) space.features = {};
        space.features[featureId] = {
          type: 'description',
          content: modification,
          location: {...persona.location},
          radius: 30 / SCALE,
          createdBy: persona.id,
        };
      }
      actionMessage = `[${action.type}] 「${modification}」`;
    } else if (action.type === 'SPEAK') {
      actionMessage = `[${action.type}] "${actionDetails.content}"`;
    }
    // ★★★ SHARE_DISCOVERYアクションの処理を追加 ★★★
    else if (action.type === 'SHARE_DISCOVERY') {
      const newFeature = action.details.feature;
      const featureId = `feature_${Date.now()}`;

      const isAlreadyKnown = Object.values(
        collectiveIntelligence.known_features
      ).some((f) => {
        if (f.location.spaceId !== newFeature.location.spaceId) return false;
        const dx = f.location.x - newFeature.location.x;
        const dy = f.location.y - newFeature.location.y;
        return (
          f.name === newFeature.name &&
          Math.sqrt(dx * dx + dy * dy) * SCALE < 10
        ); // 10m以内
      });

      if (!isAlreadyKnown) {
        collectiveIntelligence.known_features[featureId] = {
          ...newFeature,
          discoveredBy: persona.id,
          timestamp: new Date().toISOString(),
        };
        actionMessage = `[${action.type}] 新しい発見「${newFeature.name}」を集合知に共有しました。`;
        addLogEntryToUI(
          'System',
          `[集合知] ${persona.name}が「${newFeature.name}」を発見しました。`,
          'SYSTEM'
        );
      } else {
        actionMessage = `[${action.type}] 「${newFeature.name}」は既に知られている情報のため、共有をスキップしました。`;
      }
    }

    persona.memory.push({
      type: 'action',
      message: actionMessage,
      timestamp: new Date().toISOString(),
    });
    eventLog.push({
      personaName: persona.name,
      message: actionMessage,
      type: action.type,
      timestamp: new Date().toISOString(),
    });
    addLogEntryToUI(persona.name, actionMessage, action.type);

    saveState();
    updatePersonaList();
    drawWorld();
    updateStateDisplays(); // ★★★ 表示更新を呼び出し ★★★
  }

  // --- UI更新関数 ---
  function updatePersonaList() {
    personaListEl.innerHTML = '';
    personas.forEach((p) => {
      const item = document.createElement('div');
      item.className = 'persona-item';
      item.style.borderLeftColor = p.color;
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'persona-delete-btn';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.title = 'このペルソナを削除';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`「${p.name}」を削除しますか？`)) {
          personas = personas.filter((persona) => persona.id !== p.id);
          saveState();
          updatePersonaList();
          drawWorld();
        }
      });
      const nameEl = document.createElement('h3');
      nameEl.textContent = p.name;
      const locationEl = document.createElement('p');
      const loc = p.location;
      locationEl.textContent = `Location: (x:${Math.round(
        loc.x * SCALE
      )}, y:${Math.round(loc.y * SCALE)}, z:${loc.z}m) in ${loc.spaceId}`;
      item.appendChild(deleteBtn);
      item.appendChild(nameEl);
      item.appendChild(locationEl);
      personaListEl.appendChild(item);
    });
  }

  function drawWorld() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    personas.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.location.x, p.location.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(
        `${p.name} (z:${p.location.z})`,
        p.location.x + 8,
        p.location.y + 4
      );
    });
  }

  function addLogEntryToUI(personaName, message, type) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'persona-name';
    nameSpan.textContent = `${personaName}`;
    const msgContainer = document.createElement('div');
    const msgSpan = document.createElement('p');
    msgSpan.className = `action ${type}`;
    if (
      [
        'MOVE',
        'SPEAK',
        'MODIFY_WORLD',
        'SYSTEM',
        'THOUGHT',
        'SHARE_DISCOVERY',
      ].includes(type.toUpperCase())
    ) {
      const typeSpan = document.createElement('span');
      typeSpan.className = `action-type ${type.toUpperCase()}`;
      typeSpan.textContent = type.toUpperCase();
      msgSpan.appendChild(typeSpan);
    }
    msgSpan.append(message);
    entry.appendChild(nameSpan);
    entry.appendChild(msgSpan);
    logsEl.appendChild(entry);
    logsEl.scrollTop = logsEl.scrollHeight;
  }

  function renderFullLog() {
    logsEl.innerHTML = '';
    eventLog.forEach((log) => {
      addLogEntryToUI(log.personaName, log.message, log.type);
    });
  }

  // ★★★ JSON表示更新関数を統合 ★★★
  function updateStateDisplays() {
    worldJsonDisplayEl.textContent = JSON.stringify(worldState, null, 2);
    ciJsonDisplayEl.textContent = JSON.stringify(
      collectiveIntelligence,
      null,
      2
    );
  }

  // ★★★ タブ設定関数を追加 ★★★
  function setupTabs() {
    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        tabButtons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');

        tabContents.forEach((content) => content.classList.remove('active'));
        const activeContent = document.getElementById(
          button.dataset.tab + '-content'
        );
        if (activeContent) {
          activeContent.classList.add('active');
        }
      });
    });
  }

  // --- イベントリスナー ---
  saveApiKeyBtn.addEventListener('click', () => {
    apiKey = apiKeyInput.value;
    localStorage.setItem('gemini-api-key', apiKey);
    alert('APIキーを保存しました。');
    loadAndPopulateModels();
  });

  modelSelectEl.addEventListener('change', (event) => {
    selectedModel = event.target.value;
    localStorage.setItem('selected-model', selectedModel);
  });

  refreshModelsBtn.addEventListener('click', loadAndPopulateModels);

  saveWorldviewBtn.addEventListener('click', () => {
    worldview = worldviewInput.value;
    saveState();
    alert('世界観を保存しました。');
  });

  savePersonaBtn.addEventListener('click', () => {
    const name = personaNameInput.value.trim();
    const prompt = personaPromptInput.value.trim();
    const goalsText = personaGoalsInput.value.trim();
    if (!name || !prompt || !goalsText) {
      alert('すべての項目を入力してください。');
      return;
    }
    const goals = goalsText
      .split('\n')
      .map((line, index) => ({description: line.trim(), priority: index + 1}))
      .filter((g) => g.description);
    const newPersona = {
      id: 'persona_' + Date.now(),
      name: name,
      prompt: prompt,
      goals: goals,
      location: {
        x: Math.floor(Math.random() * canvas.width),
        y: Math.floor(Math.random() * canvas.height),
        z: 0,
        spaceId: 'shinjuku_outside',
      },
      color: `hsl(${Math.random() * 360}, 70%, 70%)`,
      memory: [],
    };
    personas.push(newPersona);
    saveState();
    updatePersonaList();
    drawWorld();
    modal.style.display = 'none';
  });

  proceedTimeBtn.addEventListener('click', async () => {
    addLogEntryToUI('System', '時間の進行を開始します...', 'SYSTEM');
    for (const p of personas) {
      await runPersonaTurn(p);
    }
    addLogEntryToUI('System', '全てのペルソナの行動が完了しました。', 'SYSTEM');
    saveState();
  });

  clearWorldBtn.addEventListener('click', () => {
    if (
      confirm(
        'ワールドの状態、集合知、公開ログをすべてリセットしますか？（ペルソナは削除されません）'
      )
    ) {
      worldState = {
        spaces: {
          shinjuku_outside: {type: 'outdoor', name: '新宿屋外', features: {}},
        },
        objects: {},
      };
      collectiveIntelligence = {known_features: {}}; // ★★★ 集合知もリセット ★★★
      eventLog = [];
      personas.forEach((p) => {
        p.location = {
          x: Math.floor(Math.random() * canvas.width),
          y: Math.floor(Math.random() * canvas.height),
          z: 0,
          spaceId: 'shinjuku_outside',
        };
        p.memory = [];
      });
      saveState();
      updateStateDisplays();
      renderFullLog();
      updatePersonaList();
      drawWorld();
      addLogEntryToUI('System', 'ワールドがリセットされました。', 'SYSTEM');
    }
  });

  addPersonaBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
  });
  cancelPersonaBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // --- 初期化呼び出し ---
  initialize();
});
