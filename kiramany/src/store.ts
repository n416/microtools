import { create } from 'zustand';
import { create2DParams, create3DParams } from './lib/math';
import type { Params2D, Params3D } from './lib/math';

type State = {
  mode: '2D' | '3D';
  factory2D: Params2D; factory3D: Params3D;
  layers2D: Params2D[]; layers3D: Params3D[];
  bgColor: string;
  isTransparent: boolean;
  selectedId: number | null;
  transformMode: 'translate' | 'rotate' | 'scale';

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

  generate: () => void; keep: () => void;
  
  toggle2D: (idx: number) => void; delete2D: (idx: number) => void;
  toggle3D: (idx: number) => void; delete3D: (idx: number) => void;

  moveLayer2D: (idx: number, direction: 'up' | 'down') => void;
  moveLayer3D: (idx: number, direction: 'up' | 'down') => void;
};

export const useStore = create<State>((set, get) => ({
  mode: '2D',
  factory2D: create2DParams(), factory3D: create3DParams(),
  layers2D: [], layers3D: [],
  bgColor: '#000000',
  isTransparent: false,
  selectedId: null,
  transformMode: 'translate',

  setMode: (mode) => set({ mode }),
  setBgColor: (color) => set({ bgColor: color }),
  setIsTransparent: (isTransparent) => set({ isTransparent }),
  selectLayer: (id) => set({ selectedId: id }),
  setTransformMode: (mode) => set({ transformMode: mode }),

  toggleLink: (id) => set((s) => ({
    layers3D: s.layers3D.map(l => l.id === id ? { ...l, linked: !l.linked } : l)
  })),

  updateLayer2D: (id, params) => set((s) => ({
    layers2D: s.layers2D.map(l => l.id === id ? { ...l, ...params } : l)
  })),

  updateLayer3D: (id, params) => set((s) => ({
    layers3D: s.layers3D.map(l => l.id === id ? { ...l, ...params } : l)
  })),

  update3DTransform: (id, newPos, newRot, newScale) => {
    const s = get();
    const target = s.layers3D.find(l => l.id === id);
    if (!target) return;

    const dPos = [newPos[0] - target.position[0], newPos[1] - target.position[1], newPos[2] - target.position[2]];
    const dRot = [newRot[0] - target.rotation[0], newRot[1] - target.rotation[1], newRot[2] - target.rotation[2]];
    
    set((state) => ({
      layers3D: state.layers3D.map((l) => {
        if (l.id === id) {
          return { ...l, position: newPos, rotation: newRot, scale: newScale };
        }
        if (target.linked && l.linked) {
          return {
            ...l,
            position: [l.position[0] + dPos[0], l.position[1] + dPos[1], l.position[2] + dPos[2]] as [number,number,number],
            rotation: [l.rotation[0] + dRot[0], l.rotation[1] + dRot[1], l.rotation[2] + dRot[2]] as [number,number,number],
          };
        }
        return l;
      }),
    }));
  },

  updateFactory2D: (params) => set((s) => ({ factory2D: { ...s.factory2D, ...params } })),
  updateFactory3D: (params) => set((s) => ({ factory3D: { ...s.factory3D, ...params } })),

  generate: () => set((state) => {
    if (state.mode === '2D') return { factory2D: create2DParams() };
    return { factory3D: create3DParams() };
  }),

  keep: () => set((state) => {
    if (state.mode === '2D') {
      return { 
        layers2D: [...state.layers2D, { ...state.factory2D }],
      };
    } else {
      return { 
        layers3D: [...state.layers3D, { 
          ...state.factory3D, 
          id: Date.now(),
          position: [0,0,0],
          rotation: [0,0,0],
          linked: false,
          // 初期化時にtransmission等はFactoryの値を維持
        }],
      };
    }
  }),

  toggle2D: (i) => set((s) => {
    const l = [...s.layers2D];
    l[i] = { ...l[i], visible: !l[i].visible };
    return { layers2D: l };
  }),
  delete2D: (i) => set((s) => { 
    const l = [...s.layers2D]; 
    const isSelected = s.selectedId === l[i].id;
    l.splice(i, 1); 
    return { layers2D: l, selectedId: isSelected ? null : s.selectedId }; 
  }),

  toggle3D: (i) => set((s) => {
    const l = [...s.layers3D];
    l[i] = { ...l[i], visible: !l[i].visible };
    return { layers3D: l };
  }),
  delete3D: (i) => set((s) => { 
    const l = [...s.layers3D]; 
    const isSelected = s.selectedId === l[i].id;
    l.splice(i, 1); 
    return { layers3D: l, selectedId: isSelected ? null : s.selectedId }; 
  }),

  moveLayer2D: (i, dir) => set((s) => {
    const l = [...s.layers2D];
    if (dir === 'up' && i < l.length - 1) {
      [l[i], l[i + 1]] = [l[i + 1], l[i]];
    } else if (dir === 'down' && i > 0) {
      [l[i], l[i - 1]] = [l[i - 1], l[i]];
    }
    return { layers2D: l };
  }),
  moveLayer3D: (i, dir) => set((s) => {
    const l = [...s.layers3D];
    if (dir === 'up' && i < l.length - 1) {
      [l[i], l[i + 1]] = [l[i + 1], l[i]];
    } else if (dir === 'down' && i > 0) {
      [l[i], l[i - 1]] = [l[i - 1], l[i]];
    }
    return { layers3D: l };
  }),
}));
