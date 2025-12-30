// --- Utils ---
export const rand = (min: number, max: number) => Math.random() * (max - min) + min;
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

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
  // ★追加: 新しいマテリアルタイプ
  matType: 'wire' | 'metal' | 'glass' | 'clay' | 'toon' | 'normal';
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
  linked: boolean;
  transmission: number;
  meshResolution: number;
  wireOcclusion: boolean;
};

// --- Generators ---
export const create2DParams = (): Params2D => ({
  id: Date.now(),
  visible: true,
  m: [2, 3, 4, 5, 6, 8, 10, 12, 16][randInt(0, 8)], 
  n1: rand(0.5, 20),
  n2: rand(0.5, 20),
  n3: rand(0.5, 20),
  a: 1,
  b: 1,
  rotation: rand(0, Math.PI * 2),
  hue: randInt(0, 360),
  sat: randInt(60, 100),
  bri: randInt(70, 100),
  isFilled: Math.random() > 0.5,
  lineWidth: rand(5, 30),
  scale: rand(300, 450),
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

export const create3DParams = (): Params3D => {
  const hue = randInt(0, 360);
  const typeRand = Math.random();
  let matType: Params3D['matType'] = 'glass';
  
  // ランダム生成ロジックも更新（少し均等に散らす）
  if (typeRand < 0.15) matType = 'wire';
  else if (typeRand < 0.3) matType = 'metal';
  else if (typeRand < 0.45) matType = 'clay';
  else if (typeRand < 0.6) matType = 'toon';
  else if (typeRand < 0.7) matType = 'normal';
  // 残り30%はGlass

  return {
    id: Date.now(),
    visible: true,
    m1: randInt(0, 20),
    m2: randInt(0, 20),
    n1: rand(0.2, 10),
    n2: rand(0.2, 10),
    n3: rand(0.2, 10),
    color: `hsl(${hue}, 100%, 50%)`,
    matType,
    scale: rand(0.8, 1.3),
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    linked: false,
    transmission: rand(0.8, 1.0),
    meshResolution: 64,
    wireOcclusion: false,
  };
};

export const supershape = (theta: number, m: number, n1: number, n2: number, n3: number) => {
  const t1 = Math.abs((1 / 1) * Math.cos((m * theta) / 4));
  const t1_n2 = Math.pow(t1, n2);
  const t2 = Math.abs((1 / 1) * Math.sin((m * theta) / 4));
  const t2_n3 = Math.pow(t2, n3);
  return Math.pow(t1_n2 + t2_n3, -1 / n1);
};
