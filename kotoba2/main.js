// main.js

document.addEventListener('DOMContentLoaded', () => {
    // --- シミュレーションの物理スケール定義 ---
    const SCALE = 0.1; // 1ユニット = 0.1メートル (10cm)
    const PERCEPTION_RADIUS_UNITS = 30 / SCALE; // 知覚範囲30mをユニットに変換

    // --- グローバル状態 ---
    let apiKey = '';
    let selectedModel = '';
    let worldview = '';
    let personas = [];
    let worldState = {};
    let collectiveKnowledge = {};
    let eventLog = [];
    let isSimulationRunning = false;

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
    const worldStateJsonDisplayEl = document.getElementById('world-state-json-display');
    const collectiveKnowledgeJsonDisplayEl = document.getElementById('collective-knowledge-json-display');
    const modal = document.getElementById('persona-modal');
    const savePersonaBtn = document.getElementById('save-persona-btn');
    const cancelPersonaBtn = document.getElementById('cancel-persona-btn');
    const personaNameInput = document.getElementById('persona-name');
    const personaPromptInput = document.getElementById('persona-prompt');
    const personaGoalsInput = document.getElementById('persona-goals');

    // --- 状態の永続化 ---
    function saveState() {
        localStorage.setItem('ai-world-personas', JSON.stringify(personas));
        localStorage.setItem('ai-world-worldState', JSON.stringify(worldState));
        localStorage.setItem('ai-world-collectiveKnowledge', JSON.stringify(collectiveKnowledge));
        localStorage.setItem('ai-world-eventLog', JSON.stringify(eventLog));
        localStorage.setItem('ai-world-worldview', worldview);
        localStorage.setItem('gemini-api-key', apiKey);
        localStorage.setItem('selected-model', selectedModel);
    }

    function loadState() {
        apiKey = localStorage.getItem('gemini-api-key') || '';
        selectedModel = localStorage.getItem('selected-model') || 'gemini-1.5-flash-latest';
        worldview = localStorage.getItem('ai-world-worldview') || 'ここは現代の日本の都市、新宿。高層ビルが立ち並び、多くの人々が行き交う。';

        const savedPersonas = localStorage.getItem('ai-world-personas');
        personas = savedPersonas ? JSON.parse(savedPersonas) : [];

        const savedWorldState = localStorage.getItem('ai-world-worldState');
        worldState = savedWorldState ? JSON.parse(savedWorldState) : {
            spaces: {
                shinjuku_station_west_exit: {
                    type: "outdoor",
                    name: "新宿駅西口",
                    features: {
                        kisaragi_corp_entrance: {
                            type: "portal",
                            name: "株式会社如月の正面玄関",
                            location: { x: 400, y: 300, z: 0 },
                            target: { spaceId: "kisaragi_corp_1f", x: 50, y: 50, z: 0 }
                        }
                    }
                },
                kisaragi_corp_1f: {
                    type: "indoor",
                    name: "株式会社如月 1Fロビー",
                    features: {
                        exit_to_shinjuku: {
                            type: "portal",
                            name: "屋外への出口",
                            location: { x: 50, y: 50, z: 0 },
                            target: { spaceId: "shinjuku_station_west_exit", x: 400, y: 300, z: 0 }
                        }
                    }
                }
            }
        };

        const savedKnowledge = localStorage.getItem('ai-world-collectiveKnowledge');
        collectiveKnowledge = savedKnowledge ? JSON.parse(savedKnowledge) : {};

        const savedEventLog = localStorage.getItem('ai-world-eventLog');
        eventLog = savedEventLog ? JSON.parse(savedEventLog) : [];
    }

    // --- 初期化 ---
    function initialize() {
        loadState();
        apiKeyInput.value = apiKey;
        worldviewInput.value = worldview;
        
        const worldPane = document.getElementById('world-pane');
        canvas.width = worldPane.clientWidth - 30; // padding
        canvas.height = worldPane.clientHeight - 60; // padding + h1

        updateAllUI();
        loadAndPopulateModels();
    }

    // --- UI更新 ---
    function updateAllUI() {
        updatePersonaList();
        drawWorld();
        updateAllJsonDisplays();
        renderFullLog();
    }
    
    function updatePersonaList() {
        personaListEl.innerHTML = '';
        personas.forEach(p => {
            const item = document.createElement('div');
            item.className = 'persona-item';
            item.style.borderLeftColor = p.color;
            item.innerHTML = `
                <h3>${p.name}</h3>
                <p>Location: ${p.location.spaceId} (x:${Math.round(p.location.x)}, y:${Math.round(p.location.y)}, z:${p.location.z})</p>
            `;
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'persona-delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'このペルソナを削除';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`「${p.name}」を削除しますか？`)) {
                    personas = personas.filter(persona => persona.id !== p.id);
                    saveState();
                    updateAllUI();
                }
            };
            item.appendChild(deleteBtn);
            personaListEl.appendChild(item);
        });
    }

    function drawWorld() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        personas.forEach(p => {
            // Draw perception radius
            ctx.beginPath();
            ctx.arc(p.location.x, p.location.y, PERCEPTION_RADIUS_UNITS, 0, Math.PI * 2);
            ctx.fillStyle = `${p.color}1A`; // semi-transparent
            ctx.fill();
            ctx.strokeStyle = `${p.color}80`;
            ctx.stroke();

            // Draw persona
            ctx.beginPath();
            ctx.arc(p.location.x, p.location.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
            
            // Draw name
            ctx.fillStyle = '#fff';
            ctx.fillText(`${p.name}`, p.location.x + 8, p.location.y + 4);
        });
    }

    function updateAllJsonDisplays() {
        worldStateJsonDisplayEl.textContent = JSON.stringify(worldState, null, 2);
        collectiveKnowledgeJsonDisplayEl.textContent = JSON.stringify(collectiveKnowledge, null, 2);
    }
    
    function renderFullLog() {
        logsEl.innerHTML = '';
        eventLog.forEach(log => addLogEntryToUI(log));
    }

    function addLogEntryToUI(log) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';

        let header = `<div class="log-header">`;
        if(log.personaName) {
            header += `<span class="persona-name">${log.personaName}</span>`;
        }
        header += `<span class="action-type ${log.type}">${log.type}</span></div>`;

        let message = `<div class="log-message">${log.message}</div>`;
        if (log.thought) {
            message += `<div class="log-message thought">${log.thought}</div>`;
        }

        entry.innerHTML = header + message;
        logsEl.appendChild(entry);
        logsEl.scrollTop = logsEl.scrollHeight;
    }

    // --- Gemini API ---
    async function loadAndPopulateModels() {
        if (!apiKey) {
            modelSelectEl.innerHTML = '<option value="">APIキーを入力してください</option>';
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
            const supportedModels = data.models.filter(model =>
                model.supportedGenerationMethods.includes('generateContent')
            );
            modelSelectEl.innerHTML = '';
            supportedModels.forEach(model => {
                const modelId = model.name.replace('models/', '');
                const option = document.createElement('option');
                option.value = modelId;
                option.textContent = model.displayName || modelId;
                modelSelectEl.appendChild(option);
            });
            modelSelectEl.value = selectedModel && modelSelectEl.querySelector(`option[value="${selectedModel}"]`) ? selectedModel : supportedModels[0]?.name.replace('models/', '');
            selectedModel = modelSelectEl.value;
        } catch (error) {
            modelSelectEl.innerHTML = `<option value="">モデル取得失敗</option>`;
            logSystemMessage(`モデルリストの取得に失敗: ${error.message}`, 'ERROR');
        } finally {
            modelSelectEl.disabled = false;
        }
    }

    async function callGemini(prompt) {
        if (!apiKey || !selectedModel) throw new Error('APIキーまたはモデルが未設定です');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${errorData.error.message}`);
        }
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('予期せぬAPIレスポンス形式です。');
        // Gemini API can sometimes still wrap the JSON in markdown, so we extract it.
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        return jsonMatch ? jsonMatch[1] : text;
    }
    
    // --- シミュレーションループ ---
    async function proceedTime() {
        if (isSimulationRunning) return;
        isSimulationRunning = true;
        proceedTimeBtn.disabled = true;
        proceedTimeBtn.textContent = 'シミュレーション実行中...';
        logSystemMessage('時間の進行を開始します...');

        let proposals = [];

        // --- 1. 提案フェーズ ---
        logSystemMessage('フェーズ1: 全ペルソナの行動提案を開始');
        const proposalPromises = personas.map(p => runPersonaTurn(p).then(proposal => ({ personaId: p.id, ...proposal })));
        const results = await Promise.allSettled(proposalPromises);
        
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                const proposal = result.value;
                const persona = personas.find(p => p.id === proposal.personaId);
                proposals.push(proposal);
                persona.memory.push({ type: 'thought', message: proposal.thought, timestamp: new Date().toISOString() });
                logSystemMessage(`[${persona.name}] が行動を提案: ${proposal.action.type}`, 'PROPOSAL', proposal.thought);
            } else {
                logSystemMessage(`ペルソナの行動提案中にエラー発生: ${result.reason}`, 'ERROR');
            }
        });

        // --- 2. 構築AIの調停フェーズ ---
        logSystemMessage('フェーズ2: 構築AIによるワールド更新を開始');
        runBuilderAITurn(proposals);

        // --- 3. 物理アクション実行フェーズ ---
        logSystemMessage('フェーズ3: 物理アクションの実行を開始');
        executePhysicalActions(proposals);

        logSystemMessage('全てのフェーズが完了しました。');
        isSimulationRunning = false;
        proceedTimeBtn.disabled = false;
        proceedTimeBtn.textContent = '時間を進める';
        saveState();
        updateAllUI();
    }

    // --- ペルソナの思考 ---
    function getVisibleFeatures(persona) {
        const visible = {};
        const currentSpace = worldState.spaces[persona.location.spaceId];
        if (!currentSpace?.features) return visible;

        for (const id in currentSpace.features) {
            const feature = currentSpace.features[id];
            const dx = feature.location.x - persona.location.x;
            const dy = feature.location.y - persona.location.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= PERCEPTION_RADIUS_UNITS) {
                visible[id] = feature;
            }
        }
        return visible;
    }

    async function runPersonaTurn(persona) {
        const prompt = `
            あなたは仮想世界の自律エージェントです。以下の情報に基づき、あなたの目的を達成するための次の行動を決定してください。
            
            [あなたのペルソナ]
            - ID: ${persona.id}
            - 名前: ${persona.name}
            - 基本設定: ${persona.prompt}
            - 目的リスト (優先度順): ${persona.goals.map(g => `\n  - ${g.description}`).join('')}

            [現在の状況]
            - 世界観: ${worldview}
            - 現在位置: ${JSON.stringify(persona.location)}
            - 知覚情報 (半径30m以内の物理的特徴): ${JSON.stringify(getVisibleFeatures(persona), null, 2)}
            - 集合知 (全エージェントで共有される事実): ${JSON.stringify(collectiveKnowledge, null, 2)}
            - あなた個人の記憶 (直近5件): ${JSON.stringify(persona.memory.slice(-5), null, 2)}
            - 最近の世界の出来事 (直近5件の公開ログ): ${JSON.stringify(eventLog.slice(-5), null, 2)}

            [厳格な指示]
            1. 思考 (thought) と行動 (action) を含むJSONオブジェクトを生成してください。
            2. 行動(action)のtypeは、必ず以下のいずれか1つを選択してください:
               - "MOVE": 仮想空間内を移動する。detailsに target: {x, y, z} を指定。
               - "SPEAK": 発言する。detailsに content: "発言内容" を指定。
               - "REPORT_FINDING": 新しい発見を報告する。detailsに finding: "発見内容", importance: "Major" | "Minor" を指定。
                   - "Major": 恒久的な世界の構造物（建物、道路など）に関する発見。worldStateに記録されるべきもの。
                   - "Minor": 一時的または些細な事実（落書き、特定のNPCの噂など）。collectiveKnowledgeに記録されるべきもの。
            3. 空間を移動したい場合、まず知覚情報にある'portal'タイプのfeatureに向かって"MOVE"してください。
            4. 応答は必ずJSON形式のみとし、前後に\`\`\`jsonと\`\`\`を付けないでください。

            [出力形式]
            {
              "thought": "（あなたの思考プロセスをここに記述）",
              "action": {
                "type": "（MOVE | SPEAK | REPORT_FINDING）",
                "details": {
                  /* （選択したtypeに応じた内容） */
                }
              }
            }
        `;

        try {
            const responseText = await callGemini(prompt);
            return JSON.parse(responseText);
        } catch (error) {
            logSystemMessage(`[${persona.name}] の思考中にエラー: ${error.message}`, 'ERROR');
            throw error; // Promise.allSettledでキャッチさせる
        }
    }
    
    // --- シミュレーション実行ロジック ---
    function runBuilderAITurn(proposals) {
        const findings = proposals.filter(p => p.action.type === 'REPORT_FINDING');
        if (findings.length === 0) return;

        let changesMade = false;
        findings.forEach(p => {
            const persona = personas.find(ps => ps.id === p.personaId);
            const { finding, importance } = p.action.details;
            const findingId = `finding_${Date.now()}`;
            
            if (importance === 'Major') {
                // ここでは簡略化のため、新しいfeatureとして追加
                const newFeature = {
                    type: "discovery",
                    name: finding,
                    location: { ...persona.location },
                    reportedBy: persona.id
                };
                if (!worldState.spaces[persona.location.spaceId].features) {
                    worldState.spaces[persona.location.spaceId].features = {};
                }
                worldState.spaces[persona.location.spaceId].features[findingId] = newFeature;
                logSystemMessage(`[${persona.name}] のMajorな発見「${finding}」をworldStateに記録しました`, 'BUILDER');
                changesMade = true;
            } else { // Minor
                collectiveKnowledge[findingId] = {
                    fact: finding,
                    location: { ...persona.location },
                    reportedBy: persona.id,
                    timestamp: new Date().toISOString()
                };
                logSystemMessage(`[${persona.name}] のMinorな発見「${finding}」をcollectiveKnowledgeに記録しました`, 'BUILDER');
                changesMade = true;
            }
        });
        if (changesMade) updateAllJsonDisplays();
    }

    function executePhysicalActions(proposals) {
        proposals.forEach(p => {
            const persona = personas.find(ps => ps.id === p.personaId);
            const { type, details } = p.action;

            if (type === 'MOVE') {
                const speed = 50; // units per turn
                const target = details.target;
                
                // Portal check
                const currentSpaceFeatures = worldState.spaces[persona.location.spaceId]?.features || {};
                let movedViaPortal = false;
                for(const id in currentSpaceFeatures) {
                    const feature = currentSpaceFeatures[id];
                    if (feature.type === 'portal') {
                        const distToPortal = Math.sqrt(Math.pow(feature.location.x - persona.location.x, 2) + Math.pow(feature.location.y - persona.location.y, 2));
                        if(distToPortal < 5) { // Close enough to portal
                            const oldSpace = persona.location.spaceId;
                            persona.location = { ...feature.target };
                            logSystemMessage(`[${persona.name}] MOVE: ポータル「${feature.name}」を通り、${oldSpace}から${feature.target.spaceId}へ移動`, 'MOVE');
                            movedViaPortal = true;
                            break;
                        }
                    }
                }
                
                if(!movedViaPortal && target) {
                    const dx = target.x - persona.location.x;
                    const dy = target.y - persona.location.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < speed) {
                        persona.location.x = target.x;
                        persona.location.y = target.y;
                        persona.location.z = target.z ?? persona.location.z;
                    } else {
                        persona.location.x += (dx / distance) * speed;
                        persona.location.y += (dy / distance) * speed;
                    }
                    logSystemMessage(`[${persona.name}] MOVE: (${Math.round(persona.location.x)}, ${Math.round(persona.location.y)})へ移動`, 'MOVE');
                }

            } else if (type === 'SPEAK') {
                logSystemMessage(`[${persona.name}] SPEAK: "${details.content}"`, 'SPEAK');
            }
            // REPORT_FINDINGはBuilderが処理したのでここでは何もしない
        });
    }

    function logSystemMessage(message, type = 'SYSTEM', thought = null) {
        const logEntry = {
            personaName: 'SYSTEM',
            type,
            message,
            thought,
            timestamp: new Date().toISOString(),
        };
        // ログの重複を避けるため、実際の行動ログはそれぞれのフェーズで記録する
        if (type.match(/SYSTEM|ERROR|BUILDER/)) {
            eventLog.push(logEntry);
            addLogEntryToUI(logEntry);
        } else {
             // 提案、行動ログは実処理で記録
            const finalLog = {
                personaName: message.match(/\[(.*?)\]/)[1], // [name]から名前を抽出
                type,
                message: message.replace(/\[.*?\]\s/, ''), // メッセージ部分だけ
                thought,
                timestamp: new Date().toISOString(),
            }
             eventLog.push(finalLog);
             addLogEntryToUI(finalLog);
        }
    }

    // --- イベントリスナー ---
    saveApiKeyBtn.addEventListener('click', () => {
        apiKey = apiKeyInput.value;
        localStorage.setItem('gemini-api-key', apiKey);
        alert('APIキーを保存しました。');
        loadAndPopulateModels();
    });

    modelSelectEl.addEventListener('change', () => {
        selectedModel = modelSelectEl.value;
        localStorage.setItem('selected-model', selectedModel);
    });

    refreshModelsBtn.addEventListener('click', loadAndPopulateModels);

    saveWorldviewBtn.addEventListener('click', () => {
        worldview = worldviewInput.value;
        saveState();
        alert('世界観を保存しました。');
    });

    addPersonaBtn.addEventListener('click', () => {
        personaNameInput.value = '';
        personaPromptInput.value = '';
        personaGoalsInput.value = '';
        modal.style.display = 'flex';
        personaNameInput.focus();
    });

    cancelPersonaBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    savePersonaBtn.addEventListener('click', () => {
        const name = personaNameInput.value.trim();
        const prompt = personaPromptInput.value.trim();
        const goalsText = personaGoalsInput.value.trim();
        if (!name || !prompt || !goalsText) {
            alert('全ての項目を入力してください。');
            return;
        }
        const goals = goalsText.split('\n').map((line, index) => ({
            description: line.trim(),
            priority: index + 1
        })).filter(g => g.description);

        const newPersona = {
            id: 'persona_' + Date.now(),
            name: name,
            prompt: prompt,
            goals: goals,
            location: {
                x: Math.floor(Math.random() * canvas.width),
                y: Math.floor(Math.random() * canvas.height),
                z: 0,
                spaceId: 'shinjuku_station_west_exit',
            },
            color: `hsl(${Math.random() * 360}, 90%, 70%)`,
            memory: [],
        };
        personas.push(newPersona);
        saveState();
        updateAllUI();
        modal.style.display = 'none';
    });

    proceedTimeBtn.addEventListener('click', proceedTime);

    clearWorldBtn.addEventListener('click', () => {
        if (confirm('ワールドの状態、集合知、ログを全てリセットしますか？（ペルソナは削除されません）')) {
            loadState(); // load defaults
            worldState = { spaces: { shinjuku_station_west_exit: { type: "outdoor", name: "新宿駅西口", features: {} } } };
            collectiveKnowledge = {};
            eventLog = [];
            personas.forEach(p => { p.memory = []; });
            saveState();
            updateAllUI();
            logSystemMessage('ワールドがリセットされました。');
        }
    });

    // --- 初期化呼び出し ---
    initialize();
});