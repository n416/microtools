import { create } from 'zustand';
import { generateScene } from './lib/math';
import type { Params2D, Params3D } from './lib/math';

type State = {
  // Gacha State
  paletteName: string;
  layers2D: Params2D[]; 
  layers3D: Params3D[];
  bgColor: string;

  // Editor State
  isTransparent: boolean;
  selectedId: number | null;
  transformMode: 'translate' | 'rotate' | 'scale';

  // Actions
  roll: () => void;
  
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

// Initial Roll
const initialScene = generateScene();

export const useStore = create<State>((set) => ({
  paletteName: initialScene.paletteName,
  layers2D: [initialScene.layer2D],
  layers3D: [initialScene.layer3D],
  bgColor: initialScene.bgColor,
  
  isTransparent: false,
  selectedId: null,
  transformMode: 'translate',

  // --- The Core Action ---
  roll: () => {
    const scene = generateScene();
    set({
        bgColor: scene.bgColor,
        layers2D: [scene.layer2D],
        layers3D: [scene.layer3D],
        paletteName: scene.paletteName,
        selectedId: null,
    });
  },
  // -----------------------

  setBgColor: (color) => set({ bgColor: color }),
  setIsTransparent: (isTransparent) => set({ isTransparent }),
  selectLayer: (id) => set({ selectedId: id }),
  setTransformMode: (mode) => set({ transformMode: mode }),

  updateLayer2D: (id, params) => set((s) => ({
    layers2D: s.layers2D.map(l => l.id === id ? { ...l, ...params } : l)
  })),

  updateLayer3D: (id, params) => set((s) => ({
    layers3D: s.layers3D.map(l => l.id === id ? { ...l, ...params } : l)
  })),

  update3DTransform: (id, newPos, newRot, newScale) => {
    set((state) => ({
      layers3D: state.layers3D.map((l) => {
        if (l.id === id) {
          return { ...l, position: newPos, rotation: newRot, scale: newScale };
        }
        return l;
      }),
    }));
  },

  delete2D: (i) => set((s) => { 
    const l = [...s.layers2D]; l.splice(i, 1); return { layers2D: l }; 
  }),
  delete3D: (i) => set((s) => { 
    const l = [...s.layers3D]; l.splice(i, 1); return { layers3D: l }; 
  }),
}));