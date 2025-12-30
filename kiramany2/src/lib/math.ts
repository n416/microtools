// --- Utils ---
export const rand = (min: number, max: number) => Math.random() * (max - min) + min;
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// --- Constants & Presets ---

const PALETTES = [
  { name: 'Cyber', bg: '#050505', colors: ['#00ff9d', '#00d2ff', '#ff00ff', '#f0f'] },
  { name: 'Sunset', bg: '#2d1b2e', colors: ['#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7'] },
  { name: 'DeepSea', bg: '#001e1d', colors: ['#00b8a9', '#f8f3d4', '#f6416c', '#ffde7d'] },
  { name: 'Monochrome', bg: '#121212', colors: ['#ffffff', '#888888', '#444444', '#cccccc'] },
  { name: 'Vivid', bg: '#ffffff', colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'] },
  { name: 'Royal', bg: '#1a1a2e', colors: ['#e94560', '#16213e', '#0f3460', '#533483'] },
];

const SHAPE_PRESETS_3D = [
  { name: 'Gem', m1: 4, m2: 4, n1: 100, n2: 100, n3: 100 }, 
  { name: 'Star', m1: 5, m2: 5, n1: 0.5, n2: 1.7, n3: 1.7 }, 
  { name: 'Torus', m1: 2, m2: 2, n1: 0.5, n2: 0.5, n3: 0.5 },
  { name: 'Blob', m1: 0, m2: 0, n1: 1, n2: 1, n3: 1 },
  { name: 'Crystal', m1: 3, m2: 3, n1: 0.2, n2: 1, n3: 1 },
  { name: 'Flower', m1: 6, m2: 6, n1: 0.3, n2: 0.5, n3: 0.5 },
];

const SHAPE_PRESETS_2D = [
  { m: 4, n1: 100, n2: 100, n3: 100 }, // Square
  { m: 0, n1: 1, n2: 1, n3: 1 },       // Circle
  { m: 3, n1: 0.5, n2: 1.7, n3: 1.7 }, // Triangle Star
  { m: 6, n1: 0.3, n2: 0.5, n3: 0.5 }, // Flower
  { m: 5, n1: 20, n2: 10, n3: 10 },    // Pentagon
];

// --- Types ---
export type Params2D = {
  id: number;
  visible: boolean;
  m: number;
  n1: number;
  n2: number;
  n3: number;
  a: number;
  b: number;
  rotation: number;
  hue: number;
  sat: number;
  bri: number;
  isFilled: boolean;
  lineWidth: number;
  scale: number;
  colorHex?: string; // 2Dもパレット色を使うため追加
};

export type Params3D = {
  id: number;
  visible: boolean;
  m1: number;
  m2: number;
  n1: number;
  n2: number;
  n3: number;
  color: string;
  matType: 'wire' | 'metal' | 'glass' | 'clay' | 'toon' | 'normal';
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
  linked: boolean;
  transmission: number;
  meshResolution: number;
  wireOcclusion: boolean;
};

// --- Generators (Legacy support) ---
export const create2DParams = (): Params2D => ({
  id: Date.now(),
  visible: true,
  m: 4, n1: 1, n2: 1, n3: 1, a:1, b:1, rotation: 0, hue: 0, sat: 0, bri: 100, isFilled: false, lineWidth: 10, scale: 300
});

export const create3DParams = (): Params3D => ({
  id: Date.now(),
  visible: true,
  m1:0, m2:0, n1:1, n2:1, n3:1, color:'#fff', matType:'glass', scale:1, position:[0,0,0], rotation:[0,0,0], linked:false, transmission:0.9, meshResolution:64, wireOcclusion:false
});

export const getSuperformulaPoint = (phi: number, p: Params2D) => {
  const t1 = Math.abs(Math.cos((p.m * phi) / 4) / p.a);
  const t1_n2 = Math.pow(t1, p.n2);
  const t2 = Math.abs(Math.sin((p.m * phi) / 4) / p.b);
  const t2_n3 = Math.pow(t2, p.n3);
  
  let r = Math.pow(t1_n2 + t2_n3, -1 / p.n1);
  if (!isFinite(r)) r = 0;

  return {
    x: r * Math.cos(phi) * p.scale,
    y: r * Math.sin(phi) * p.scale,
  };
};

export const supershape = (theta: number, m: number, n1: number, n2: number, n3: number) => {
  const t1 = Math.abs((1 / 1) * Math.cos((m * theta) / 4));
  const t1_n2 = Math.pow(t1, n2);
  const t2 = Math.abs((1 / 1) * Math.sin((m * theta) / 4));
  const t2_n3 = Math.pow(t2, n3);
  return Math.pow(t1_n2 + t2_n3, -1 / n1);
};

// --- New Gacha Logic ---

export const generateScene = () => {
  const palette = pick(PALETTES);
  
  // Background Layer (2D)
  const shape2D = pick(SHAPE_PRESETS_2D);
  const color2D = pick(palette.colors);
  const layer2D: Params2D = {
    id: Date.now(),
    visible: true,
    m: shape2D.m,
    n1: shape2D.n1,
    n2: shape2D.n2,
    n3: shape2D.n3,
    a: 1, b: 1,
    rotation: rand(0, Math.PI),
    hue: 0, sat: 0, bri: 100, // Legacy HSL fields (ignored if colorHex used)
    colorHex: color2D,
    isFilled: Math.random() > 0.3,
    lineWidth: rand(2, 8),
    scale: rand(350, 480), // 画面いっぱいに
  };

  // Foreground Object (3D)
  const shape3D = pick(SHAPE_PRESETS_3D);
  const color3D = pick(palette.colors);
  
  // マテリアルも雰囲気で選ぶ
  let matType: Params3D['matType'] = 'glass';
  const dice = Math.random();
  if (dice < 0.2) matType = 'toon';
  else if (dice < 0.4) matType = 'clay';
  else if (dice < 0.6) matType = 'metal';
  else if (dice < 0.8) matType = 'wire';
  
  const layer3D: Params3D = {
    id: Date.now() + 1,
    visible: true,
    m1: shape3D.m1,
    m2: shape3D.m2,
    n1: shape3D.n1, 
    n2: shape3D.n2,
    n3: shape3D.n3,
    color: color3D,
    matType,
    scale: rand(0.9, 1.4),
    position: [0, 0, 0],
    rotation: [rand(0, Math.PI), rand(0, Math.PI), 0],
    linked: false,
    transmission: rand(0.8, 1.0),
    meshResolution: 128, // High Quality
    wireOcclusion: false,
  };

  return {
    bgColor: palette.bg,
    layer2D,
    layer3D,
    paletteName: palette.name
  };
};