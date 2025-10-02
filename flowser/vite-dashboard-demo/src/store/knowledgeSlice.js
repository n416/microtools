import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialKnowledgeLibrary = [
  {
    id: "phase-001",
    name: "第一フェイズ",
    knowledges: [],
    subPhases: [
      { id: "subphase-001a", name: "初期接触", knowledges: [] },
      { id: "subphase-001b", name: "ヒアリング", knowledges: [] }
    ]
  },
  { id: "phase-002", name: "第二フェイズ", knowledges: [], subPhases: [] },
  { id: "phase-003", name: "第三フェイズ", knowledges: [], subPhases: [] }
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
      state.selectedKnowledgeId = null; // 【修正】選択も解除
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
        const newKnowledge = { ...knowledge, id: `knowledge-${nanoid()}` };
        target.knowledges.push(newKnowledge);
        // ▼▼▼ 【重要】追加した知識を選択状態にし、isAddingNewKnowledgeをfalseにする ▼▼▼
        state.selectedKnowledgeId = newKnowledge.id;
        state.isAddingNewKnowledge = false;
      }
    },
    updateKnowledge: (state, action) => {
      const { phaseId, subPhaseId, knowledge } = action.payload;
      const phase = state.library.find(p => p.id === phaseId);
      if (!phase) return;

      const target = subPhaseId
        ? phase.subPhases.find(sp => sp.id === subPhaseId)
        : phase;

      if (target && target.knowledges) {
        const index = target.knowledges.findIndex(k => k.id === knowledge.id);
        if (index !== -1) {
          target.knowledges[index] = knowledge;
        }
      }
    },
    deleteKnowledge: (state, action) => {
      const { phaseId, subPhaseId, knowledgeId } = action.payload;
      const phase = state.library.find(p => p.id === phaseId);
      if (!phase) return;

      const target = subPhaseId
        ? phase.subPhases.find(sp => sp.id === subPhaseId)
        : phase;

      if (target && target.knowledges) {
        target.knowledges = target.knowledges.filter(k => k.id !== knowledgeId);
        if (state.selectedKnowledgeId === knowledgeId) {
          state.selectedKnowledgeId = null;
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
} = knowledgeSlice.actions;

export default knowledgeSlice.reducer;