import { create } from 'zustand';
import { generateScene } from './lib/math';
import type { Params2D, Params3D } from './lib/math';
import { db } from './lib/db';

// Snapshot type for History
type SceneData = {
  paletteName: string;
  layers2D: Params2D[]; 
  layers3D: Params3D[];
  bgColor: string;
};

type State = {
  // Scene State
  paletteName: string;
  layers2D: Params2D[]; 
  layers3D: Params3D[];
  bgColor: string;

  // History State
  past: SceneData[];
  future: SceneData[];

  // Editor State
  isTransparent: boolean;
  selectedId: number | null;
  transformMode: 'translate' | 'rotate' | 'scale';
  isLoading: boolean; // Init flag

  // Actions
  initialize: () => Promise<void>;
  roll: () => void;
  undo: () => void;
  redo: () => void;
  
  loadFromShare: (data: any) => void;
  
  setBgColor: (color: string) => void;
  setIsTransparent: (isTransparent: boolean) => void;
  selectLayer: (id: number | null) => void;
  setTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  
  updateLayer2D: (id: number, params: Partial<Params2D>) => void;
  updateLayer3D: (id: number, params: Partial<Params3D>) => void;
  update3DTransform: (id: number, pos: [number,number,number], rot: [number,number,number], scale: number) => void;
  
  delete2D: (idx: number) => void;
  delete3D: (idx: number) => void;
};

// Helper: Extract current scene data
const getSnapshot = (state: State): SceneData => ({
  paletteName: state.paletteName,
  layers2D: state.layers2D,
  layers3D: state.layers3D,
  bgColor: state.bgColor,
});

// Helper: Save to DB side-effect
const persist = (data: SceneData) => {
  db.save(data);
};

export const useStore = create<State>((set, get) => ({
  // Initial empty state (will be populated by initialize)
  paletteName: '',
  layers2D: [],
  layers3D: [],
  bgColor: '#111',
  
  past: [],
  future: [],
  
  isTransparent: false,
  selectedId: null,
  transformMode: 'translate',
  isLoading: true,

  initialize: async () => {
    // 1. Check URL Params (Share)
    const params = new URLSearchParams(window.location.search);
    if (params.has('s')) {
      // Handled by App.tsx logic (via loadFromShare), just stop loading
      set({ isLoading: false });
      return;
    }

    // 2. Check IndexedDB
    const saved = await db.load();
    if (saved) {
      set({
        bgColor: saved.bgColor,
        layers2D: saved.layers2D,
        layers3D: saved.layers3D,
        paletteName: saved.paletteName,
        isLoading: false,
        past: [] // Clear history on reload
      });
      return;
    }

    // 3. New Roll
    const scene = generateScene();
    const data = {
        bgColor: scene.bgColor,
        layers2D: [scene.layer2D],
        layers3D: [scene.layer3D],
        paletteName: scene.paletteName,
    };
    set({ ...data, isLoading: false });
    persist(data);
  },

  roll: () => {
    const state = get();
    const current = getSnapshot(state);
    const scene = generateScene();
    
    const newState = {
        bgColor: scene.bgColor,
        layers2D: [scene.layer2D],
        layers3D: [scene.layer3D],
        paletteName: scene.paletteName,
    };

    set({
        ...newState,
        selectedId: null,
        past: [...state.past, current], // Push to history
        future: [] // Clear redo
    });
    persist(newState);
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;

    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, -1);
    const current = getSnapshot(state);

    set({
        ...previous,
        selectedId: null,
        past: newPast,
        future: [current, ...state.future]
    });
    persist(previous);
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;

    const next = state.future[0];
    const newFuture = state.future.slice(1);
    const current = getSnapshot(state);

    set({
        ...next,
        selectedId: null,
        past: [...state.past, current],
        future: newFuture
    });
    persist(next);
  },

  loadFromShare: (data) => {
    const state = get();
    // Save current before loading shared data (so user can Undo back to their work)
    if (state.layers3D.length > 0) {
        const current = getSnapshot(state);
        set(s => ({ past: [...s.past, current] }));
    }

    set({
      bgColor: data.bgColor,
      layers2D: data.layers2D || [],
      layers3D: data.layers3D || [],
      paletteName: data.paletteName || 'Shared',
      selectedId: null,
      future: []
    });
    // Don't persist shared data immediately? Maybe user wants to keep it? 
    // Let's persist it so if they reload they see the shared icon.
    persist({
      bgColor: data.bgColor,
      layers2D: data.layers2D || [],
      layers3D: data.layers3D || [],
      paletteName: data.paletteName || 'Shared'
    });
  },

  // --- Setters (with Auto-Save but NO Undo history for minor tweaks) ---
  // If you want Undo for every slider change, move logic to `set` wrapper.
  // For now, only Roll/Undo/Redo/Share modifies History stack.
  
  setBgColor: (color) => set(s => { 
      const n = { bgColor: color }; persist({...getSnapshot(s), ...n}); return n; 
  }),
  setIsTransparent: (isTransparent) => set({ isTransparent }), // No persist needed for UI toggle
  selectLayer: (id) => set({ selectedId: id }),
  setTransformMode: (mode) => set({ transformMode: mode }),

  updateLayer2D: (id, params) => set((s) => {
    const layers2D = s.layers2D.map(l => l.id === id ? { ...l, ...params } : l);
    persist({ ...getSnapshot(s), layers2D });
    return { layers2D };
  }),

  updateLayer3D: (id, params) => set((s) => {
    const layers3D = s.layers3D.map(l => l.id === id ? { ...l, ...params } : l);
    persist({ ...getSnapshot(s), layers3D });
    return { layers3D };
  }),

  update3DTransform: (id, newPos, newRot, newScale) => {
    set((state) => {
        const layers3D = state.layers3D.map((l) => {
            if (l.id === id) return { ...l, position: newPos, rotation: newRot, scale: newScale };
            return l;
        });
        // Debounce persist? For now direct save.
        persist({ ...getSnapshot(state), layers3D });
        return { layers3D };
    });
  },

  delete2D: (i) => set((s) => { 
    const l = [...s.layers2D]; l.splice(i, 1); 
    persist({ ...getSnapshot(s), layers2D: l });
    return { layers2D: l }; 
  }),
  delete3D: (i) => set((s) => { 
    const l = [...s.layers3D]; l.splice(i, 1); 
    persist({ ...getSnapshot(s), layers3D: l });
    return { layers3D: l }; 
  }),
}));