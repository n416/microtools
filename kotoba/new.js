// main.js

document.addEventListener('DOMContentLoaded', () => {
    // --- グローバル状態 ---
    let apiKey = '';
    let selectedModel = '';
    let personas = [];
    let worldState = {};
    let collectiveKnowledge = {};
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
    const knowledgeJsonDisplayEl = document.getElementById('knowledge-json-display');
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
        localStorage.setItem('ai-world-collectiveKnowledge', JSON.stringify(collectiveKnowledge));
        localStorage.setItem('ai-world-eventLog', JSON.stringify(eventLog));
        localStorage.setItem('ai-world-worldview', worldview);
    }

    function loadState() {
        apiKey = localStorage.getItem('gemini-api-key') || '';
        selectedModel = localStorage.getItem('selected-model') || 'gemini-1.5-flash-latest';
        worldview = localStorage.getItem('ai-world-worldview') || 'ここは現代の日本の都市、新宿。高層ビルが立ち並び、多くの人々が行き交う。あなたがいるのは「株式会社如月」というIT企業のオフィス付近で、最寄り駅は新宿駅西口である。';
        const savedPersonas = localStorage.getItem('ai-world-personas');
        personas = (savedPersonas ? JSON.parse(savedPersonas) : []).map(p => ({ ...p, memory: p.memory || [] }));
        const savedWorldState = localStorage.getItem('ai-world-worldState');
        worldState = savedWorldState ? JSON.parse(savedWorldState) : {
            spaces: {
                "shinjuku_outside": { type: "outdoor", name: "新宿屋外", features: {
                    "entrance_kisaragi": { type: "portal", name: "株式会社如月の正面玄関", location: { x: 400, y: 300, z: 0, spaceId: "shinjuku_outside" }, target: { x: 50, y: 50, z: 0, spaceId: "kisaragi_corp_1F" } }
                }},
                "kisaragi_corp_1F": { type: "floor", name: "株式会社如月 1F", elevation: 0, features: {
                    "exit_kisaragi": { type: "portal", name: "屋外への出口", location: { x: 50, y: 50, z: 0, spaceId: "kisaragi_corp_1F" }, target: { x: 400, y: 300, z: 0, spaceId: "shinjuku_outside" } }
                }}
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
        canvas.width = document.getElementById('world-pane').clientWidth;
        canvas.height = document.getElementById('world-pane').clientHeight;
        updatePersonaList();
        drawWorld();
        updateAllJsonDisplays();
        renderFullLog();
        loadAndPopulateModels();
    }
    
    // --- API & AIロジック ---
    async function loadAndPopulateModels() {
        if (!apiKey) { modelSelectEl.innerHTML = '<option value="">APIキーを入力してください</option>'; return; }
        modelSelectEl.disabled = true;
        modelSelectEl.innerHTML = '<option value="">モデルを読み込み中...</option>';
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error.message); }
            const data = await response.json();
            const supportedModels = data.models.filter(model => model.supportedGenerationMethods.includes('generateContent'));
            modelSelectEl.innerHTML = '';
            if (supportedModels.length === 0) { modelSelectEl.innerHTML = '<option value="">利用可能なモデルがありません</option>'; return; }
            supportedModels.forEach(model => {
                const modelId = model.name.replace('models/', '');
                const option = document.createElement('option');
                option.value = modelId;
                option.textContent = model.displayName || modelId;
                modelSelectEl.appendChild(option);
            });
            const savedModel = localStorage.getItem('selected-model');
            if (savedModel && modelSelectEl.querySelector(`option[value="${savedModel}"]`)) { modelSelectEl.value = savedModel; }
            else if (supportedModels.length > 0) { modelSelectEl.value = supportedModels[0].name.replace('models/', ''); }
            selectedModel = modelSelectEl.value;
        } catch (error) {
            console.error("Failed to load models:", error);
            modelSelectEl.innerHTML = `<option value="">モデル取得失敗</option>`;
            addLogEntryToUI('System', `モデルリストの取得に失敗しました: ${error.message}`, 'action error');
        } finally {
            modelSelectEl.disabled = false;
        }
    }
    async function callGemini(prompt) {
        if (!apiKey) throw new Error("APIキー未設定");
        if (!selectedModel) throw new Error("AIモデルが選択されていません");
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
        };
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(`API Error: ${errorData.error.message}`); }
        const data = await response.json();
        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) {
             return data.candidates[0].content.parts[0].text;
        } else { console.error("Unexpected API response structure:", data); throw new Error("予期せぬAPIレスポンス形式です。"); }
    }
    
    function getVisibleFeatures(location, radius) {
        const visible = {};
        const currentSpaceFeatures = worldState.spaces[location.spaceId]?.features || {};
        for (const id in currentSpaceFeatures) {
            const feature = currentSpaceFeatures[id];
            if (Math.abs(feature.location.z - location.z) * SCALE > 2 && feature.type !== 'portal') continue;
            const dx = feature.location.x - location.x;
            const dy = feature.location.y - location.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= radius) { visible[id] = feature; }
        }
        return visible;
    }

    async function runPersonaTurn(persona) {
        const privateMemory = persona.memory.slice(-5).map(log => `[自分の過去の${log.type}] ${log.message}`).join('\n');
        const publicEvents = eventLog.filter(log => log.type === 'EVENT').slice(-5).map(log => `[${log.personaName}の行動] ${log.message}`).join('\n');
        const perceptionRadius = 30 / SCALE;
        const visibleFeatures = getVisibleFeatures(persona.location, perceptionRadius);

        const worldDescription = `
            [世界観]: ${worldview}
            [あなたの状態]: { "id": "${persona.id}", "location": ${JSON.stringify(persona.location)} }
            [あなたの視界にある構造物]: ${JSON.stringify(visibleFeatures)}
            [集合知(全員が知っている事実)]: ${JSON.stringify(collectiveKnowledge)}
            [あなたの記憶]: ${privateMemory || "（なし）"}
            [最近の出来事]: ${publicEvents || "（なし）"}
        `;
        const prompt = `
            あなたはエージェントです。状況に基づき、次の行動をJSONで出力してください。
            ---
            [基本設定]: ${persona.prompt}
            [目的]: ${persona.goals.map(g => `- ${g.description}`).join('\n')}
            [状況]: ${worldDescription}
            ---
            [指示]
            - 行動は'MOVE', 'SPEAK', 'REPORT_FINDING'のいずれかです。
            - 'REPORT_FINDING'は、あなたが視界で新しく発見した事実を報告するアクションです。
            - 報告する際は、その情報が恒久的な「構造物」か、一時的/部分的な「発見」かを判断し、'importance'を'Major'か'Minor'で設定してください。
            - 出力はJSON形式のみとし、必ず\`\`\`jsonと\`\`\`で囲ってください。
            
            \`\`\`json
            {
                "thought": "（思考プロセス）",
                "action": { "type": "...", "details": { "target": {...}, "content": "...", "importance": "..." } }
            }
            \`\`\`
        `;

        try {
            addLogEntryToUI(persona.name, "思考中...", 'thought');
            const rawResponse = await callGemini(prompt);
            const jsonString = rawResponse.match(/```json\n([\s\S]*?)\n```/)?.[1];
            if (!jsonString) { throw new Error("応答からJSONが見つかりませんでした。"); }
            
            const decision = JSON.parse(jsonString);
            persona.memory.push({ type: 'thought', message: decision.thought, timestamp: new Date().toISOString() });
            addLogEntryToUI(persona.name, `思考: ${decision.thought}`, 'thought');
            
            // 行動は提案としてログに記録
            const action = decision.action;
            const actionMessage = `[${action.type}] ${action.details.content || ''}`;
            eventLog.push({ personaName: persona.name, action: action, type: 'PROPOSAL', timestamp: new Date().toISOString() });
            addLogEntryToUI(persona.name, `提案: ${actionMessage}`, 'action');
            
        } catch (error) {
            console.error("An error occurred in runPersonaTurn:", error);
            addLogEntryToUI(persona.name, `エラー: ${error.message}`, 'action error');
        }
    }

    function runBuilderAITurn() {
        addLogEntryToUI('BuilderAI', '世界の変更提案をレビュー中...', 'system');
        
        const proposals = eventLog.filter(log => log.type === 'PROPOSAL' && !log.processed);

        proposals.forEach(log => {
            const { personaName, action } = log;
            const { type, details } = action;
            const persona = personas.find(p => p.name === personaName);
            if (!persona) return;

            if (type === 'REPORT_FINDING') {
                const importance = details.importance;
                const content = details.content;
                const featureId = `feature_${Date.now()}`;

                if (importance === 'Major') {
                    const space = worldState.spaces[persona.location.spaceId];
                    if (space) {
                        if (!space.features) space.features = {};
                        space.features[featureId] = {
                            type: 'structure', name: content,
                            location: { ...persona.location }, discoveredBy: persona.name
                        };
                        addLogEntryToUI('BuilderAI', `承認: ${personaName}の報告「${content}」を構造物として世界に追加しました。`, 'system');
                    }
                } else {
                    const knowledgeId = `knowledge_${Date.now()}`;
                    collectiveKnowledge[knowledgeId] = {
                        type: 'observation', content: content,
                        location: { ...persona.location }, discoveredBy: persona.name
                    };
                    addLogEntryToUI('BuilderAI', `承認: ${personaName}の発見「${content}」を集合知に追加しました。`, 'system');
                }
            }
            log.processed = true;
        });
        
        updateAllJsonDisplays();
    }
    
    function executePhysicalActions() {
        addLogEntryToUI('System', '物理アクションを実行中...', 'system');
        const proposals = eventLog.filter(log => log.type === 'PROPOSAL' && !log.action.processed);

        proposals.forEach(log => {
            const { personaName, action } = log;
            const persona = personas.find(p => p.name === personaName);
            if (!persona) return;

            if (action.type === 'MOVE') {
                const targetLocation = action.details.target;
                const speed = 50; 
                let portalUsed = false;
                
                const currentSpace = worldState.spaces[persona.location.spaceId];
                if (currentSpace && currentSpace.features) {
                    for (const id in currentSpace.features) {
                        const feature = currentSpace.features[id];
                        if (feature.type === 'portal') {
                            const dx = feature.location.x - persona.location.x;
                            const dy = feature.location.y - persona.location.y;
                            const distToPortal = Math.sqrt(dx*dx + dy*dy) * SCALE;
                            if (distToPortal < 1 && targetLocation.x === feature.location.x && targetLocation.y === feature.location.y) {
                                const oldSpace = persona.location.spaceId;
                                persona.location = { ...feature.target };
                                const msg = `ポータル「${feature.name}」を通り、${oldSpace} から ${feature.target.spaceId} へ移動した`;
                                persona.memory.push({ type: 'action', message: msg, timestamp: new Date().toISOString() });
                                addLogEntryToUI(personaName, msg, 'MOVE');
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
                    } else {
                        persona.location.x += (dx / distance) * speed;
                        persona.location.y += (dy / distance) * speed;
                    }
                    const msg = `to (${Math.round(persona.location.x * SCALE)}m, ${Math.round(persona.location.y * SCALE)}m) in ${persona.location.spaceId}`;
                    persona.memory.push({ type: 'action', message: msg, timestamp: new Date().toISOString() });
                    addLogEntryToUI(personaName, msg, 'MOVE');
                }
            } else if (action.type === 'SPEAK') {
                const msg = `「${action.details.content}」`;
                persona.memory.push({ type: 'action', message: msg, timestamp: new Date().toISOString() });
                addLogEntryToUI(personaName, msg, 'SPEAK');
            }
            log.action.processed = true;
        });

        drawWorld();
        updatePersonaList();
    }

    // --- UI更新関数 ---
    function updateAllJsonDisplays() {
        worldJsonDisplayEl.textContent = JSON.stringify(worldState, null, 2);
        knowledgeJsonDisplayEl.textContent = JSON.stringify(collectiveKnowledge, null, 2);
    }
    // ... (他のUI更新関数は変更なし)
    function addLogEntryToUI(personaName, message, type) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'persona-name';
        nameSpan.textContent = `${personaName}`;
        const msgContainer = document.createElement('div');
        const msgSpan = document.createElement('p');
        msgSpan.className = `action ${type}`;
        if (['MOVE', 'SPEAK', 'REPORT_FINDING', 'SYSTEM', 'THOUGHT'].includes(type.toUpperCase())) {
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
        eventLog.forEach(log => { addLogEntryToUI(log.personaName, log.message, log.type); });
    }
    function updatePersonaList() {
        personaListEl.innerHTML = '';
        personas.forEach(p => {
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
                    personas = personas.filter(persona => persona.id !== p.id);
                    saveState();
                    updatePersonaList();
                    drawWorld();
                }
            });
            const nameEl = document.createElement('h3');
            nameEl.textContent = p.name;
            const locationEl = document.createElement('p');
            const loc = p.location;
            locationEl.textContent = `Location: (x:${Math.round(loc.x * SCALE)}, y:${Math.round(loc.y * SCALE)}, z:${loc.z}m) in ${loc.spaceId}`;
            item.appendChild(deleteBtn);
            item.appendChild(nameEl);
            item.appendChild(locationEl);
            personaListEl.appendChild(item);
        });
    }
    function drawWorld() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        personas.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.location.x, p.location.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText(`${p.name} (z:${p.location.z})`, p.location.x + 8, p.location.y + 4);
        });
    }
    
    // --- イベントリスナー ---
    proceedTimeBtn.addEventListener('click', async () => {
        addLogEntryToUI('System', '【ターン開始】各ペルソナが行動を提案します...', 'system');
        // 1. 全ペルソナが非同期で行動を決定（提案）
        const proposalPromises = personas.map(p => runPersonaTurn(p));
        await Promise.all(proposalPromises);

        // 2. 構築AIが提案をレビューし、世界を更新
        runBuilderAITurn();

        // 3. 物理的なアクションを実行
        executePhysicalActions();
        
        addLogEntryToUI('System', '【ターン終了】全ての処理が完了しました。', 'system');
        saveState();
    });

    clearWorldBtn.addEventListener('click', () => {
        if (confirm('ワールド、集合知、ログをすべてリセットしますか？')) {
            worldState = {
                spaces: { "shinjuku_outside": { type: "outdoor", name: "新宿屋外", features: {} } },
            };
            collectiveKnowledge = {};
            eventLog = [];
            personas.forEach(p => {
                p.location = { x: Math.floor(Math.random() * canvas.width), y: Math.floor(Math.random() * canvas.height), z: 0, spaceId: "shinjuku_outside" };
                p.memory = [];
            });
            saveState();
            updateAllJsonDisplays();
            renderFullLog();
            updatePersonaList();
            drawWorld();
            addLogEntryToUI('System', 'ワールドがリセットされました。', 'system');
        }
    });

    // ... (他のイベントリスナーは変更なし)
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
        if (!name || !prompt || !goalsText) { alert('すべての項目を入力してください。'); return; }
        const goals = goalsText.split('\n').map((line, index) => ({ description: line.trim(), priority: index + 1 })).filter(g => g.description);
        const newPersona = {
            id: 'persona_' + Date.now(),
            name: name,
            prompt: prompt,
            goals: goals,
            location: {
                x: Math.floor(Math.random() * canvas.width),
                y: Math.floor(Math.random() * canvas.height),
                z: 0,
                spaceId: "shinjuku_outside"
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
    addPersonaBtn.addEventListener('click', () => { modal.style.display = 'flex'; });
    cancelPersonaBtn.addEventListener('click', () => { modal.style.display = 'none'; });


    // --- 初期化呼び出し ---
    initialize();
});