import { GeminiApiClient } from './geminiApiClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const addKnowledgeBtn = document.getElementById('add-knowledge-btn');
  const newKnowledgeText = document.getElementById('new-knowledge-text');
  const knowledgeList = document.getElementById('knowledge-list');
  const generateFlowBtn = document.getElementById('generate-flow-btn');
  const instructionInput = document.getElementById('instruction-input');
  const flowOutputList = document.getElementById('flow-output-list');
  const loadingSpinner = document.getElementById('loading-spinner');
  const addTaskBtn = document.getElementById('add-task-btn');
  const finalizeFlowBtn = document.getElementById('finalize-flow-btn');
  const settingsToggleBtn = document.getElementById('settings-toggle-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveApiKeyBtn = document.getElementById('save-api-key-btn');
  const checkModelsBtn = document.getElementById('check-models-btn');

  let knowledgeBase = JSON.parse(localStorage.getItem('knowledgeBase')) || [];

  const renderKnowledgeBase = () => {
    knowledgeList.innerHTML = '';
    knowledgeBase.forEach(item => {
      const li = document.createElement('li');
      li.className = 'knowledge-item';
      li.dataset.id = item.id;
      li.innerHTML = `<span class="id">${item.id}</span><span class="text">${item.text}</span><button class="delete-btn">🗑️</button>`;
      knowledgeList.appendChild(li);
    });
  };

  addKnowledgeBtn.addEventListener('click', () => {
    const text = newKnowledgeText.value.trim();
    if (text) {
      const newIdNumber = knowledgeBase.length > 0 ? Math.max(...knowledgeBase.map(item => parseInt(item.id.substring(1)))) + 1 : 1;
      const newKnowledge = { id: `K${String(newIdNumber).padStart(3, '0')}`, text: text };
      knowledgeBase.push(newKnowledge);
      localStorage.setItem('knowledgeBase', JSON.stringify(knowledgeBase));
      renderKnowledgeBase();
      newKnowledgeText.value = '';
    }
  });

  knowledgeList.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
      const idToDelete = e.target.parentElement.dataset.id;
      knowledgeBase = knowledgeBase.filter(item => item.id !== idToDelete);
      localStorage.setItem('knowledgeBase', JSON.stringify(knowledgeBase));
      renderKnowledgeBase();
    }
  });

  settingsToggleBtn.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));

  saveApiKeyBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      localStorage.setItem('geminiApiKey', apiKey);
      alert('APIキーを保存しました。');
      settingsPanel.classList.add('hidden');
    } else {
      alert('APIキーを入力してください。');
    }
  });

  checkModelsBtn.addEventListener('click', async () => {
    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey) {
      alert('APIキーが設定されていません。');
      return;
    }
    try {
      console.log("利用可能なモデルのリストを取得中...");
      const models = await GeminiApiClient.listAvailableModels(apiKey);
      console.clear();
      console.log("✅ モデルリストの取得に成功しました。");
      const supportedModels = models.filter(model => model.supportedGenerationMethods.includes("generateContent"));
      console.log("--- generateContentをサポートするモデル ---");
      supportedModels.forEach(model => console.log(`- ${model.name}`));
      console.log("--- 全モデル情報 ---");
      console.table(models);
      alert("コンソール（F12キーで表示）に利用可能なモデルのリストを出力しました。");
    } catch (error) {
      console.error(error);
      alert(`エラー: ${error.message}`);
    }
  });

  generateFlowBtn.addEventListener('click', async () => {
    const instruction = instructionInput.value.trim();
    if (!instruction || knowledgeBase.length === 0) {
      alert('「知識ベース」と「AIへの指示」の両方を入力してください。');
      return;
    }

    flowOutputList.innerHTML = '';
    loadingSpinner.classList.remove('hidden');
    addTaskBtn.classList.add('hidden');
    finalizeFlowBtn.classList.add('hidden');
    generateFlowBtn.disabled = true;

    try {
      const gemini = new GeminiApiClient(); // あなたの方法に倣い、ここでインスタンス化
      if (!gemini.isAvailable) {
        throw new Error('APIキーが未設定です。右上の「⚙️ 設定」から登録してください。');
      }

      const knowledgeText = knowledgeBase.map(k => `${k.id}: ${k.text}`).join('\n');
      const prompt = `あなたは優秀な業務コンサルタントです。以下の【知識リスト】を制約条件として厳守し、ユーザーからの【指示】に合致する業務フローを、論理的に矛盾のないステップ・バイ・ステップのリスト形式で提案してください。各ステップがどの知識に基づいているか、IDを明記してください。\n\n【知識リスト】\n${knowledgeText}\n\n【指示】\n${instruction}\n\n【出力形式】\n- (タスク内容1) (根拠: KXXX)\n- (タスク内容2) (根拠: KXXX)\n- (AIが補完したタスク内容)`;

      // ★★★ 修正箇所 ★★★
      // コンソールで確認した正しいモデル名に書き換えてください
      const modelName = 'gemini-pro-latest';
      const resultText = await gemini.generateContent(prompt, modelName);

      const tasks = resultText.split('\n').filter(line => line.trim().startsWith('-')).map(line => {
        const match = line.match(/- (.+?) \(根拠: (K\d+)\)/);
        return match ? { text: match[1].trim(), refId: match[2].trim() } : { text: line.replace('-', '').trim(), refId: 'AI' };
      });

      renderFlow(tasks);
    } catch (error) {
      console.error('API呼び出し中にエラーが発生しました:', error);
      flowOutputList.innerHTML = `<li style="color: red; background-color: #ffebee; padding: 10px; border-radius: 4px;">エラー: ${error.message}</li>`;
    } finally {
      loadingSpinner.classList.add('hidden');
      addTaskBtn.classList.remove('hidden');
      finalizeFlowBtn.classList.remove('hidden');
      generateFlowBtn.disabled = false;
    }
  });

  const renderFlow = (tasks) => {
    flowOutputList.innerHTML = '';
    tasks.forEach(task => addFlowTask(task.text, task.refId));
  };

  const addFlowTask = (text = '', refId = '手動') => {
    const li = document.createElement('li');
    li.className = 'flow-task';
    li.innerHTML = `<span class="ref-id">${refId}</span><input type="text" value="${text}" placeholder="タスク内容を入力"><button class="delete-btn">🗑️</button>`;
    flowOutputList.appendChild(li);
  };

  addTaskBtn.addEventListener('click', () => addFlowTask());

  flowOutputList.addEventListener('click', e => {
    if (e.target.classList.contains('delete-btn')) {
      e.target.parentElement.remove();
    }
  });

  finalizeFlowBtn.addEventListener('click', () => {
    const tasks = Array.from(flowOutputList.querySelectorAll('.flow-task')).map(li => ({
      text: li.querySelector('input[type="text"]').value,
      refId: li.querySelector('.ref-id').textContent
    }));
    if (tasks.length === 0) {
      alert('確定するフローがありません。');
      return;
    }
    console.log("--- 確定されたフロー ---", tasks);
    alert('フローが確定されました。（コンソールに出力）');
  });

  // 初期化処理
  const savedApiKey = localStorage.getItem('geminiApiKey');
  if (savedApiKey) apiKeyInput.value = savedApiKey;
  renderKnowledgeBase();
});