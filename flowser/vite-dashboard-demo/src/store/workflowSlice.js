import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

const initialWorkflowLibrary = [
  {
    id: 'wf001', name: '【標準】新車販売フロー', description: '新車のキャンピングカーを販売する際の標準的な業務フローです。',
    tasks: [
      { id: 1, text: '顧客要望ヒアリングと車種選定', refId: 'AI', completed: false, memo: '', details: '顧客の利用用途、予算、希望装備などを詳しくヒアリングし、最適な車種を提案します。パンフレットやデモカーを活用します。', documents: [{ name: '車種カタログ.pdf', url: '#', checked: false }] },
      { id: 2, text: '見積書作成とオプション確認', refId: 'K001', completed: false, memo: '', details: '選択された車種をベースに、追加オプション（ソーラーパネル、FFヒーター、ナビ等）を含めた正式な見積書を作成し、提示します。' },
      {
        id: 3, text: '販売プランの選択', refId: 'AI', completed: false,
        memo: '顧客はBプランに興味を示しているが、予算の都合で迷っている様子。Aプランの利点も改めて説明する必要があるかもしれない。',
        details: '顧客の希望に応じて、販売プランを選択してください。',
        type: 'nested_branch', selectedOption: null,
        options: {
          'plan_A': {
            label: 'Aプラン（即時販売）',
            tasks: [
              { id: 3.1, text: '在庫確認と車両確保', refId: 'K003', completed: false, memo: '', details: '指定された車種の在庫を確認し、顧客のために車両を確保します。' },
              { id: 3.2, text: '最終見積もりの提示', refId: 'K001', completed: false, memo: '', details: 'プランに基づいた最終的な見積書を作成し、顧客に提示します。' },
            ]
          },
          'plan_B': {
            label: 'Bプラン（カスタムオーダー）',
            tasks: [
              { id: 3.3, text: 'カスタム内容の全体ヒアリング', refId: 'AI', completed: false, memo: '', details: '内外装、追加装備など、まずは全体的なカスタムのご要望をヒアリングします。' },
              {
                id: 3.4, text: '内装カスタムの方向性', refId: 'AI', completed: false, memo: '',
                details: '内装のカスタムについて、方向性を選択してください。', type: 'nested_branch', selectedOption: null,
                options: {
                  'luxury': {
                    label: 'ラグジュアリー仕様',
                    tasks: [
                      { id: 3.41, text: 'レザーシートの選定', refId: 'AI', completed: false, memo: '', details: 'シートの素材やカラーサンプルをお見せし、レザーの種類を決定します。' },
                      { id: 3.42, text: '間接照明プランの提案', refId: 'AI', completed: false, memo: '', details: '車内の雰囲気を高める間接照明の設置場所や色について提案・決定します。' },
                    ]
                  },
                  'outdoor': {
                    label: 'アウトドア仕様',
                    tasks: [
                      { id: 3.43, text: '防水・防汚シートの選定', refId: 'AI', completed: false, memo: '', details: '汚れに強い素材のシートサンプルから、デザインと機能性を両立するものを選びます。' },
                      { id: 3.44, text: '大容量バッテリーとソーラーパネルの提案', refId: 'AI', completed: false, memo: '', details: '長期間の車中泊にも対応できる、強化バッテリーシステムとソーラー充電のプランを提案します。' },
                    ]
                  }
                }
              },
              { id: 3.5, text: 'メーカーへの発注と納期確認', refId: 'K003', completed: false, memo: '', details: '確定した仕様でメーカーに車両を発注し、おおよその納期を確認・共有します。' },
              { id: 3.6, text: '進捗の定期報告', refId: 'AI', completed: false, memo: '', details: '納車までの間、定期的に顧客へ生産状況を報告します。' },
            ]
          }
        }
      },
      { id: 4, text: '注文書作成と契約締結', refId: 'K002', completed: false, memo: '', details: '見積内容に合意後、注文書を作成します。契約内容を丁寧に説明し、署名・捺印をいただきます。', documents: [{ name: '売買契約書テンプレート.docx', url: '#', checked: false }] },
      { id: 5, text: '納車および操作説明', refId: 'AI', completed: false, memo: '', details: '顧客に来店いただき、車両の最終確認を行います。各種装備の詳しい操作方法を実演しながら説明し、キーをお渡しします。' },
    ]
  },
  {
    id: 'wf002', name: '【標準】中古車買取フロー', description: '顧客からキャンピングカーを買い取る際の標準的な業務フローです。',
    tasks: [
      { id: 1, text: '査定予約の受付と車両情報確認', refId: 'AI', completed: true, memo: '', details: '電話またはウェブサイトから査定予約を受け付けます。車種、年式、走行距離、装備などの基本情報を事前にヒアリングします。' },
      { id: 2, text: '実車査定と査定額の提示', refId: 'K004', completed: false, memo: '', details: '予約日に顧客に来店いただき、車両の状態（内外装、エンジン、電装系）を詳細にチェックします。市場価格と車両状態を基に、適正な査定額を算出・提示します。', documents: [{ name: '中古車査定チェックシート.xlsx', url: '#', checked: true }] },
      { id: 3, text: '必要書類の案内と準備依頼', refId: 'K005', completed: false, memo: '', details: '契約に必要な書類（車検証、自賠責保険証、印鑑証明書など）のリストをお渡しし、準備を依頼します。' },
      { id: 4, text: '買取契約の締結と車両引き取り', refId: 'K002', completed: false, memo: '', details: '書類が揃い次第、買取契約書に署名・捺印をいただきます。車両の引き取り日を調整し、車両をお預かりします。' },
      { id: 5, text: '名義変更手続きと入金処理', refId: 'K006', completed: false, memo: '', details: '引き取った車両の名義変更手続きを速やかに行い、指定の口座へ買取金額を振り込みます。' },
    ]
  },
  {
    id: 'wf003', name: '【緊急】重大クレーム対応フロー', description: '雨漏りやエンジン不動など、顧客満足度に大きく影響する重大なクレームに対応するためのフローです。',
    tasks: [
      { id: 1, text: '第一次受付と状況ヒアリング', refId: 'AI', completed: false, memo: '', details: '顧客からのクレーム連絡を最優先で受け付け、冷静に状況をヒアリングします。感情的にならず、事実確認に徹します。' },
      { id: 2, text: '車両の緊急引き取りまたは出張点検', refId: 'K007', completed: false, memo: '', details: '車両が自走不能な場合は積載車を手配します。自走可能な場合でも、迅速に車両をお預かりするか、サービスカーで現地へ向かいま す。' },
      { id: 3, text: '原因の徹底調査と特定', refId: 'K008', completed: false, memo: '', details: 'サービス部門が総出で不具合の原因を調査・特定します。必要であればメーカーにも問い合わせ、情報を収集します。', documents: [{ name: '故障探求マニュアル.pdf', url: '#', checked: false }] },
      { id: 4, text: '顧客への経過報告と対応策の提案', refId: 'AI', completed: false, memo: '', details: '調査状況を定期的に顧客へ報告し、不安を和らげます。原因が特定でき次第、修理内容、期間、費用（保証適用の有無）について正式に提案します。' },
      { id: 5, text: '修理・交換作業と最終テスト', refId: 'K003', completed: false, memo: '', details: '提案内容に合意後、修理・交換作業を実施します。作業完了後、複数回の走行テストや漏水テストを行い、不具合が完全に解消されたことを確認します。' },
      { id: 6, text: '納車および謝罪と再発防止策の説明', refId: 'AI', completed: false, memo: '', details: '車両を納車する際、改めて謝罪するとともに、今回の原因と実施した対策、今後の再発防止策について丁寧に説明します。' },
    ]
  },
];

const createInitialCustomerData = () => {
  const wf1 = JSON.parse(JSON.stringify(initialWorkflowLibrary.find(w => w.id === 'wf001')));
  wf1.instanceId = uuidv4();
  wf1.templateId = 'wf001';
  const wf3 = JSON.parse(JSON.stringify(initialWorkflowLibrary.find(w => w.id === 'wf003')));
  wf3.instanceId = uuidv4();
  wf3.templateId = 'wf003';
  return [
    { id: 1, name: '山田 太郎', company: '株式会社A', status: 'critical', assignedWorkflows: [wf3] },
    { id: 2, name: '田中 次郎', company: '株式会社B', status: 'progress', assignedWorkflows: [wf1] },
    { id: 3, name: '鈴木 三郎', company: '株式会社C', status: 'success', assignedWorkflows: [] },
    { id: 4, name: '佐藤 四郎', company: '株式会社D', status: 'new', assignedWorkflows: [] },
  ];
};

// ▼▼▼ 修正: localStorageからデータを読み込むための関数 ▼▼▼
const loadStateFromLocalStorage = () => {
  try {
    const savedCustomerData = localStorage.getItem('customerData');
    const savedWorkflowLibrary = localStorage.getItem('workflowLibrary');
    const savedSelectedCustomerId = localStorage.getItem('selectedCustomerId');

    let customerData = createInitialCustomerData();
    if (savedCustomerData) {
      let parsedData = JSON.parse(savedCustomerData);
      customerData = parsedData.map(c => {
        if (c.assignedFlowIds && !c.assignedWorkflows) {
          const newWorkflows = c.assignedFlowIds.map(templateId => {
            const template = initialWorkflowLibrary.find(wf => wf.id === templateId);
            if (!template) return null;
            const instance = JSON.parse(JSON.stringify(template));
            instance.instanceId = uuidv4();
            instance.templateId = templateId;
            return instance;
          }).filter(Boolean);
          const newCustomer = { ...c, assignedWorkflows: newWorkflows };
          delete newCustomer.assignedFlowIds;
          delete newCustomer.assignedFlowId;
          return newCustomer;
        }
        if (!c.assignedWorkflows) {
          return { ...c, assignedWorkflows: [] };
        }
        return c;
      });
    }

    const workflowLibrary = savedWorkflowLibrary ? JSON.parse(savedWorkflowLibrary) : initialWorkflowLibrary;
    const selectedCustomerId = savedSelectedCustomerId ? JSON.parse(savedSelectedCustomerId) : 1;

    return {
      customerData,
      workflowLibrary,
      selectedCustomerId,
      selectedWorkflowId: null,
      selectedTaskId: null,
      isAiModalOpen: false,
      aiSuggestion: '',
      refiningTask: null,
      originalMemo: '',
      isApiCommunicating: false,
    };
  } catch (e) {
    console.error("Could not load state from localStorage", e);
    // エラー発生時はデフォルトの初期状態を返す
    return {
      customerData: createInitialCustomerData(),
      workflowLibrary: initialWorkflowLibrary,
      selectedCustomerId: 1,
      selectedWorkflowId: null,
      selectedTaskId: null,
      isAiModalOpen: false,
      aiSuggestion: '',
      refiningTask: null,
      originalMemo: '',
      isApiCommunicating: false,
    };
  }
};


export const workflowSlice = createSlice({
  name: 'workflow',
  initialState: loadStateFromLocalStorage(), // 関数を呼び出して初期状態を設定
  reducers: {
    setSelectedCustomerId: (state, action) => {
      state.selectedCustomerId = action.payload;
    },
    setSelectedWorkflowId: (state, action) => {
      state.selectedWorkflowId = action.payload;
    },
    setSelectedTaskId: (state, action) => {
      state.selectedTaskId = action.payload;
    },
    assignWorkflowToCustomer: (state, action) => {
      const { customerId, workflowTemplateId } = action.payload;
      const template = state.workflowLibrary.find(wf => wf.id === workflowTemplateId);
      if (template) {
        const customer = state.customerData.find(c => c.id === customerId);
        if (customer) {
          const instance = JSON.parse(JSON.stringify(template));
          instance.instanceId = uuidv4();
          instance.templateId = workflowTemplateId;
          customer.assignedWorkflows.push(instance);
        }
      }
    },
    unassignWorkflowFromCustomer: (state, action) => {
      const { customerId, workflowInstanceId } = action.payload;
      const customer = state.customerData.find(c => c.id === customerId);
      if (customer) {
        customer.assignedWorkflows = customer.assignedWorkflows.filter(wf => wf.instanceId !== workflowInstanceId);
      }
    },
    updateTaskMemo: (state, action) => {
      const { customerId, workflowInstanceId, taskId, memo } = action.payload;
      const customer = state.customerData.find(c => c.id === customerId);
      if (customer) {
        const workflow = customer.assignedWorkflows.find(wf => wf.instanceId === workflowInstanceId);
        if (workflow) {
          const findTaskAndUpdate = (tasks) => {
            for (const task of tasks) {
              if (task.id === taskId) {
                task.memo = memo;
                return true;
              }
              if (task.type === 'nested_branch' && task.options) {
                for (const key in task.options) {
                  if (findTaskAndUpdate(task.options[key].tasks || [])) return true;
                }
              }
            }
            return false;
          };
          findTaskAndUpdate(workflow.tasks);
        }
      }
    },
    toggleTask: (state, action) => {
      const { customerId, workflowInstanceId, taskId } = action.payload;
      const customer = state.customerData.find(c => c.id === customerId);
      if (customer) {
        const workflow = customer.assignedWorkflows.find(wf => wf.instanceId === workflowInstanceId);
        if (workflow) {
          const findAndToggle = (tasks) => {
            for (const task of tasks) {
              if (task.id === taskId) {
                task.completed = !task.completed;
                return true;
              }
              if (task.type === 'nested_branch' && task.options) {
                for (const key in task.options) {
                  if (findAndToggle(task.options[key].tasks || [])) return true;
                }
              }
            }
            return false;
          };
          findAndToggle(workflow.tasks);
        }
      }
    },
    selectBranch: (state, action) => {
      const { customerId, workflowInstanceId, taskId, optionKey, shouldReset } = action.payload;
      const customer = state.customerData.find(c => c.id === customerId);
      if (customer) {
        const workflow = customer.assignedWorkflows.find(wf => wf.instanceId === workflowInstanceId);
        if (workflow) {
          const resetSubTasksRecursive = (tasks) => {
            for (const task of tasks) {
              task.completed = false;
              if (task.type === 'nested_branch') {
                task.selectedOption = null;
                for (const key in task.options) {
                  resetSubTasksRecursive(task.options[key].tasks || []);
                }
              }
            }
          };
          const findAndSelect = (tasks) => {
            for (const task of tasks) {
              if (task.id === taskId) {
                if (shouldReset && task.selectedOption) {
                  const previousOptionTasks = task.options[task.selectedOption]?.tasks || [];
                  resetSubTasksRecursive(previousOptionTasks);
                }
                task.selectedOption = optionKey;
                return true;
              }
              if (task.type === 'nested_branch' && task.options) {
                for (const key in task.options) {
                  if (findAndSelect(task.options[key].tasks || [])) return true;
                }
              }
            }
            return false;
          };
          findAndSelect(workflow.tasks);
        }
      }
    },
    toggleDocument: (state, action) => {
      const { customerId, workflowInstanceId, taskId, docName } = action.payload;
      const customer = state.customerData.find(c => c.id === customerId);
      if (customer) {
        const workflow = customer.assignedWorkflows.find(wf => wf.instanceId === workflowInstanceId);
        if (workflow) {
          const findAndToggle = (tasks) => {
            for (const task of tasks) {
              if (task.id === taskId && task.documents) {
                const doc = task.documents.find(d => d.name === docName);
                if (doc) {
                  doc.checked = !doc.checked;
                }
                return true;
              }
              if (task.type === 'nested_branch' && task.options) {
                for (const key in task.options) {
                  if (findAndToggle(task.options[key].tasks || [])) return true;
                }
              }
            }
            return false;
          };
          findAndToggle(workflow.tasks);
        }
      }
    },
    startAiRefinement: (state, action) => {
      const { task, customerId, workflowInstanceId, originalMemo, suggestion } = action.payload;
      state.refiningTask = { task, customerId, workflowInstanceId };
      state.originalMemo = originalMemo;
      state.aiSuggestion = suggestion;
      state.isAiModalOpen = true;
    },
    closeAiModal: (state) => {
      state.isAiModalOpen = false;
      state.aiSuggestion = '';
      state.refiningTask = null;
      state.originalMemo = '';
      state.isApiCommunicating = false;
    },
    updateAiSuggestion: (state, action) => {
      state.aiSuggestion = action.payload;
    },
    setApiCommunicating: (state, action) => {
      state.isApiCommunicating = action.payload;
    },
  },
});

export const {
  setSelectedCustomerId,
  setSelectedWorkflowId,
  setSelectedTaskId,
  assignWorkflowToCustomer,
  unassignWorkflowFromCustomer,
  updateTaskMemo,
  toggleTask,
  selectBranch,
  toggleDocument,
  startAiRefinement,
  closeAiModal,
  updateAiSuggestion,
  setApiCommunicating,
} = workflowSlice.actions;

export default workflowSlice.reducer;