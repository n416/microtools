import { create } from 'zustand';
import { create2DParams, create3DParams, mutate2D, mutate3D } from './lib/math';
import type { Params2D, Params3D } from './lib/math';
import { saveToDB, loadFromDB, decodeState } from './lib/storage';

type State = {
  mode: '2D' | '3D';
  factory2D: Params2D; factory3D: Params3D;
  layers2D: Params2D[]; layers3D: Params3D[];
  bgColor: string;
  isTransparent: boolean;
  selectedId: number | null;
  transformMode: 'translate' | 'rotate' | 'scale';
  isLoading: boolean;

  initialize: () => Promise<void>;
  loadFromShare: (data: any) => void;

  setMode: (mode: '2D' | '3D') => void;
  setBgColor: (color: string) => void;
  setIsTransparent: (isTransparent: boolean) => void;
  selectLayer: (id: number | null) => void;
  setTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  
  toggleLink: (id: number) => void;
  updateLayer2D: (id: number, params: Partial<Params2D>) => void;
  updateLayer3D: (id: number, params: Partial<Params3D>) => void;
  update3DTransform: (id: number, pos: [number,number,number], rot: [number,number,number], scale: number) => void;

  updateFactory2D: (params: Partial<Params2D>) => void;
  updateFactory3D: (params: Partial<Params3D>) => void;

  generate: () => void;
  mutate: () => void;
  keep: () => void;
  
  toggle2D: (idx: number) => void; delete2D: (idx: number) => void;
  toggle3D: (idx: number) => void; delete3D: (idx: number) => void;
  moveLayer2D: (idx: number, direction: 'up' | 'down') => void;
  moveLayer3D: (idx: number, direction: 'up' | 'down') => void;
};

// 変更を検知してDBに保存するヘルパー
const persist = (state: State) => {
  saveToDB({
    layers2D: state.layers2D,
    layers3D: state.layers3D,
    bgColor: state.bgColor,
  });
};

export const useStore = create<State>((set, get) => ({
  mode: '2D',
  factory2D: create2DParams(), factory3D: create3DParams(),
  layers2D: [], layers3D: [],
  bgColor: '#000000',
  isTransparent: false,
  selectedId: null,
  transformMode: 'translate',
  isLoading: true,

  initialize: async () => {
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get('s');

    if (shareData) {
       try {
         const data = await decodeState(shareData);
         set({ 
            layers2D: data.layers2D || [], 
            layers3D: data.layers3D || [], 
            bgColor: data.bgColor || '#000000',
            isLoading: false 
         });
         window.history.replaceState({}, '', window.location.pathname);
       } catch (e) {
         console.error("Failed to load share data", e);
         set({ isLoading: false });
       }
    } else {
       const data = await loadFromDB();
       if (data) {
         set({ 
            layers2D: data.layers2D || [], 
            layers3D: data.layers3D || [], 
            bgColor: data.bgColor || '#000000',
            isLoading: false 
         });
       } else {
         set({ isLoading: false });
       }
    }
  },

  loadFromShare: (data: any) => {
      set({
        layers2D: data.layers2D || [], 
        layers3D: data.layers3D || [], 
        bgColor: data.bgColor || '#000000',
      });
      persist(get());
  },

  setMode: (mode) => set({ mode }),
  setBgColor: (color) => { set({ bgColor: color }); persist(get()); },
  setIsTransparent: (isTransparent) => set({ isTransparent }),
  selectLayer: (id) => set({ selectedId: id }),
  setTransformMode: (mode) => set({ transformMode: mode }),

  toggleLink: (id) => {
    set((s) => ({
      layers3D: s.layers3D.map(l => l.id === id ? { ...l, linked: !l.linked } : l)
    }));
    persist(get());
  },

  updateLayer2D: (id, params) => {
      set((s) => ({
        layers2D: s.layers2D.map(l => l.id === id ? { ...l, ...params } : l)
      }));
      persist(get());
  },

  updateLayer3D: (id, params) => {
      set((s) => ({
        layers3D: s.layers3D.map(l => l.id === id ? { ...l, ...params } : l)
      }));
      persist(get());
  },

  update3DTransform: (id, newPos, newRot, newScale) => {
    const s = get();
    const target = s.layers3D.find(l => l.id === id);
    if (!target) return;
    const dPos = [newPos[0] - target.position[0], newPos[1] - target.position[1], newPos[2] - target.position[2]];
    const dRot = [newRot[0] - target.rotation[0], newRot[1] - target.rotation[1], newRot[2] - target.rotation[2]];
    set((state) => ({
      layers3D: state.layers3D.map((l) => {
        if (l.id === id) return { ...l, position: newPos, rotation: newRot, scale: newScale };
        if (target.linked && l.linked) return {
            ...l,
            position: [l.position[0] + dPos[0], l.position[1] + dPos[1], l.position[2] + dPos[2]] as [number,number,number],
            rotation: [l.rotation[0] + dRot[0], l.rotation[1] + dRot[1], l.rotation[2] + dRot[2]] as [number,number,number],
          };
        return l;
      }),
    }));
    persist(get());
  },

  updateFactory2D: (params) => set((s) => ({ factory2D: { ...s.factory2D, ...params } })),
  updateFactory3D: (params) => set((s) => ({ factory3D: { ...s.factory3D, ...params } })),

  generate: () => set((state) => {
    if (state.mode === '2D') return { factory2D: create2DParams() };
    return { factory3D: create3DParams() };
  }),

  // ★修正: 選択中のレイヤーがある場合はそれを変異させる
  mutate: () => {
    const s = get();
    
    // 選択中のレイヤーがあるかチェック
    if (s.selectedId !== null) {
      // 2Dレイヤーから探す
      if (s.layers2D.some(l => l.id === s.selectedId)) {
        set({
          layers2D: s.layers2D.map(l => l.id === s.selectedId ? mutate2D(l) : l)
        });
        persist(get());
        return;
      }
      // 3Dレイヤーから探す
      if (s.layers3D.some(l => l.id === s.selectedId)) {
        set({
          layers3D: s.layers3D.map(l => l.id === s.selectedId ? mutate3D(l) : l)
        });
        persist(get());
        return;
      }
    }

    // 何も選択されていなければ、Factory（プレビュー）を変異させる
    if (s.mode === '2D') {
        set({ factory2D: mutate2D(s.factory2D) });
    } else {
        set({ factory3D: mutate3D(s.factory3D) });
    }
  },

  keep: () => {
    set((state) => {
      if (state.mode === '2D') {
        return { layers2D: [...state.layers2D, { ...state.factory2D }] };
      } else {
        return { layers3D: [...state.layers3D, { 
            ...state.factory3D, id: Date.now(), position: [0,0,0], rotation: [0,0,0], linked: false,
        }]};
      }
    });
    persist(get());
  },

  toggle2D: (i) => {
      set((s) => { const l = [...s.layers2D]; l[i].visible = !l[i].visible; return { layers2D: l }; });
      persist(get());
  },
  delete2D: (i) => {
      set((s) => { 
        const l = [...s.layers2D]; const isSel = s.selectedId === l[i].id; l.splice(i, 1); 
        return { layers2D: l, selectedId: isSel ? null : s.selectedId }; 
      });
      persist(get());
  },
  toggle3D: (i) => {
      set((s) => { const l = [...s.layers3D]; l[i].visible = !l[i].visible; return { layers3D: l }; });
      persist(get());
  },
  delete3D: (i) => {
      set((s) => { 
        const l = [...s.layers3D]; const isSel = s.selectedId === l[i].id; l.splice(i, 1); 
        return { layers3D: l, selectedId: isSel ? null : s.selectedId }; 
      });
      persist(get());
  },
  moveLayer2D: (i, dir) => {
      set((s) => {
        const l = [...s.layers2D];
        if (dir === 'up' && i < l.length - 1) [l[i], l[i + 1]] = [l[i + 1], l[i]];
        else if (dir === 'down' && i > 0) [l[i], l[i - 1]] = [l[i - 1], l[i]];
        return { layers2D: l };
      });
      persist(get());
  },
  moveLayer3D: (i, dir) => {
      set((s) => {
        const l = [...s.layers3D];
        if (dir === 'up' && i < l.length - 1) [l[i], l[i + 1]] = [l[i + 1], l[i]];
        else if (dir === 'down' && i > 0) [l[i], l[i - 1]] = [l[i - 1], l[i]];
        return { layers3D: l };
      });
      persist(get());
  },
}));
