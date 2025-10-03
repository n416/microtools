import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialKnowledgeLibrary = [
  {
    id: "phase-001",
    name: "商談フェーズ",
    subPhases: [
      { 
        id: "subphase-001a", 
        name: "初期接触・ヒアリング", 
        knowledges: [
          {
            id: 'k-001',
            text: '顧客要望ヒアリングと車種選定',
            details: '顧客の利用用途、予算、希望装備などを詳しくヒアリングし、最適な車種を提案します。パンフレットやデモカーを活用して、顧客のイメージを具体化させることが重要です。',
            type: 'task',
            options: [],
          }
        ] 
      },
      { 
        id: "subphase-001b", 
        name: "提案・プラン選択", 
        knowledges: [
          {
            id: 'k-002',
            text: '見積書作成とオプション確認',
            details: '選択された車種をベースに、追加オプション（ソーラーパネル、FFヒーター、ナビ等）を含めた正式な見積書を作成し、提示します。オプションのメリット・デメリットを丁寧に説明します。',
            type: 'task',
            options: [],
          },
          {
            id: 'k-003',
            text: '販売プランの選択',
            details: '顧客の希望に応じて、販売プランを選択してもらいます。即納可能な在庫車か、カスタムオーダーかによって後続のタスクが分岐します。',
            type: 'branch',
            options: [
              { id: 'opt-001', label: 'Aプラン（即時販売）'},
              { id: 'opt-002', label: 'Bプラン（カスタムオーダー）'},
            ],
          }
        ] 
      }
    ]
  },
  { 
    id: "phase-002", 
    name: "契約フェーズ", 
    subPhases: [],
    knowledges: [
      {
        id: 'k-004',
        text: '注文書作成と契約締結',
        details: '見積内容に合意後、注文書を作成します。契約内容（支払い条件、納期、保証など）を丁寧に説明し、署名・捺印をいただきます。',
        type: 'task',
        options: [],
      }
    ]
  },
  { 
    id: "phase-003", 
    name: "納車準備フェーズ", 
    subPhases: [],
    knowledges: [
      {
        id: 'k-005',
        text: '在庫確認と車両確保',
        details: '即時販売プランの場合、指定された車種の在庫を再確認し、顧客のために車両を確保（引き当て）します。',
        type: 'task',
        options: [],
      },
      {
        id: 'k-006',
        text: 'メーカーへの発注と納期確認',
        details: 'カスタムオーダープランの場合、確定した仕様でメーカーに車両を発注し、おおよその納期を確認して顧客と共有します。',
        type: 'task',
        options: [],
      },
      {
        id: 'k-007',
        text: '進捗の定期報告',
        details: '特にカスタムオーダーの場合、納車までの間、定期的に顧客へ生産状況や輸送状況を報告し、安心感を提供します。',
        type: 'task',
        options: [],
      }
    ]
  },
  {
    id: "phase-004",
    name: "納車フェーズ",
    subPhases: [],
    knowledges: [
      {
        id: 'k-008',
        text: '納車および操作説明',
        details: '顧客に来店いただき、車両の最終確認を行います。各種装備の詳しい操作方法を実演しながら説明し、キーをお渡しして納車完了となります。',
        type: 'task',
        options: [],
      }
    ]
  }
];


const loadState = () => {
  try {
    const serializedState = localStorage.getItem('knowledgeLibrary');
    if (serializedState === null) {
      return initialKnowledgeLibrary;
    }
    const parsed = JSON.parse(serializedState);
    return parsed.map(phase => ({
      ...phase,
      knowledges: phase.knowledges || [],
      subPhases: (phase.subPhases || []).map(sp => ({ ...sp, knowledges: sp.knowledges || [] })),
    }));
  } catch (err) {
    return initialKnowledgeLibrary;
  }
};

const knowledgeSlice = createSlice({
  name: 'knowledge',
  initialState: {
    library: loadState(),
    selectedPhaseId: null,
    selectedSubPhaseId: null,
    selectedKnowledgeId: null,
    isAddingNewKnowledge: false,
  },
  reducers: {
    selectPhase: (state, action) => {
      state.selectedPhaseId = action.payload;
      state.selectedSubPhaseId = null;
      state.selectedKnowledgeId = null;
      state.isAddingNewKnowledge = false;
    },
    selectSubPhase: (state, action) => {
      const subPhaseId = action.payload;
      const parentPhase = state.library.find(p => p.subPhases.some(sp => sp.id === subPhaseId));
      if (parentPhase) {
        state.selectedPhaseId = parentPhase.id;
      }
      state.selectedSubPhaseId = subPhaseId;
      state.selectedKnowledgeId = null;
      state.isAddingNewKnowledge = false;
    },
    selectKnowledge: (state, action) => {
      state.selectedKnowledgeId = action.payload;
      state.isAddingNewKnowledge = false;
    },
    startAddingKnowledge: (state) => {
      state.selectedKnowledgeId = null;
      state.isAddingNewKnowledge = true;
    },
    finishEditing: (state) => {
      state.selectedKnowledgeId = null; 
      state.isAddingNewKnowledge = false;
    },
    addPhase: (state, action) => {
      state.library.push({
        id: `phase-${nanoid()}`,
        name: action.payload.name,
        knowledges: [],
        subPhases: []
      });
    },
    updatePhase: (state, action) => {
      const phase = state.library.find(p => p.id === action.payload.id);
      if (phase) {
        phase.name = action.payload.name;
      }
    },
    deletePhase: (state, action) => {
      state.library = state.library.filter(p => p.id !== action.payload);
      if (state.selectedPhaseId === action.payload) {
        state.selectedPhaseId = null;
        state.selectedSubPhaseId = null;
        state.selectedKnowledgeId = null;
      }
    },
    reorderPhases: (state, action) => {
      const { sourceIndex, destinationIndex } = action.payload;
      const [removed] = state.library.splice(sourceIndex, 1);
      state.library.splice(destinationIndex, 0, removed);
    },
    addSubPhase: (state, action) => {
      const phase = state.library.find(p => p.id === action.payload.phaseId);
      if (phase) {
        phase.subPhases.push({
          id: `subphase-${nanoid()}`,
          name: action.payload.name,
          knowledges: []
        });
      }
    },
    updateSubPhase: (state, action) => {
      const { phaseId, subPhaseId, name } = action.payload;
      const phase = state.library.find(p => p.id === phaseId);
      if (phase) {
        const subPhase = phase.subPhases.find(sp => sp.id === subPhaseId);
        if (subPhase) {
          subPhase.name = name;
        }
      }
    },
    deleteSubPhase: (state, action) => {
      const { phaseId, subPhaseId } = action.payload;
      const phase = state.library.find(p => p.id === phaseId);
      if (phase) {
        phase.subPhases = phase.subPhases.filter(sp => sp.id !== subPhaseId);
        if (state.selectedSubPhaseId === subPhaseId) {
          state.selectedSubPhaseId = null;
          state.selectedKnowledgeId = null;
        }
      }
    },
    reorderSubPhases: (state, action) => {
      const { phaseId, sourceIndex, destinationIndex } = action.payload;
      const phase = state.library.find(p => p.id === phaseId);
      if (phase) {
        const [removed] = phase.subPhases.splice(sourceIndex, 1);
        phase.subPhases.splice(destinationIndex, 0, removed);
      }
    },
    addKnowledge: (state, action) => {
      const { phaseId, subPhaseId, knowledge } = action.payload;
      const phase = state.library.find(p => p.id === phaseId);
      if (!phase) return;

      const target = subPhaseId
        ? phase.subPhases.find(sp => sp.id === subPhaseId)
        : phase;

      if (target) {
        if (!target.knowledges) {
          target.knowledges = [];
        }
        const newKnowledge = { ...knowledge, id: `knowledge-${nanoid()}` };
        target.knowledges.push(newKnowledge);
        state.selectedKnowledgeId = newKnowledge.id;
        state.isAddingNewKnowledge = false;
      }
    },
    updateKnowledge: (state, action) => {
      const { phaseId, subPhaseId, knowledge } = action.payload;
      let parent = state.library.find(p => p.id === phaseId);
      if (!parent) return;

      let targetList;
      if (subPhaseId) {
        const subPhase = parent.subPhases.find(sp => sp.id === subPhaseId);
        if (subPhase) {
          targetList = subPhase.knowledges;
        }
      } else {
        targetList = parent.knowledges;
      }

      if (targetList) {
        const index = targetList.findIndex(k => k.id === knowledge.id);
        if (index !== -1) {
          targetList[index] = knowledge;
        }
      }
    },
    deleteKnowledge: (state, action) => {
      const { phaseId, subPhaseId, knowledgeId } = action.payload;
      let parent = state.library.find(p => p.id === phaseId);
      if (!parent) return;

      let targetListOwner;
      if (subPhaseId) {
        targetListOwner = parent.subPhases.find(sp => sp.id === subPhaseId);
      } else {
        targetListOwner = parent;
      }
      
      if (targetListOwner && targetListOwner.knowledges) {
        targetListOwner.knowledges = targetListOwner.knowledges.filter(k => k.id !== knowledgeId);
        if (state.selectedKnowledgeId === knowledgeId) {
          state.selectedKnowledgeId = null;
        }
      }
    },
    moveKnowledge: (state, action) => {
      const { knowledgeId, source, target } = action.payload;
      let knowledgeToMove = null;

      const sourcePhase = state.library.find(p => p.id === source.phaseId);
      if (sourcePhase) {
        const sourceOwner = source.subPhaseId
          ? sourcePhase.subPhases.find(sp => sp.id === source.subPhaseId)
          : sourcePhase;
        
        if (sourceOwner && sourceOwner.knowledges) {
          const index = sourceOwner.knowledges.findIndex(k => k.id === knowledgeId);
          if (index > -1) {
            [knowledgeToMove] = sourceOwner.knowledges.splice(index, 1);
          }
        }
      }

      if (knowledgeToMove) {
        const targetPhase = state.library.find(p => p.id === target.phaseId);
        if (targetPhase) {
          const targetOwner = target.subPhaseId
            ? targetPhase.subPhases.find(sp => sp.id === target.subPhaseId)
            : targetPhase;
          
          if (targetOwner) {
            if (!targetOwner.knowledges) {
              targetOwner.knowledges = [];
            }
            targetOwner.knowledges.push(knowledgeToMove);
          }
        }
      }
    },
  }
});

export const {
  selectPhase, selectSubPhase, selectKnowledge,
  startAddingKnowledge, finishEditing,
  addPhase, updatePhase, deletePhase, reorderPhases,
  addSubPhase, updateSubPhase, deleteSubPhase, reorderSubPhases,
  addKnowledge, updateKnowledge, deleteKnowledge,
  moveKnowledge,
} = knowledgeSlice.actions;

export default knowledgeSlice.reducer;