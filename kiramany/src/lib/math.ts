// --- Utils ---
export const rand = (min: number, max: number) => Math.random() * (max - min) + min;
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

// ★ID生成用のヘルパー関数
export const generateId = () => {
  return Date.now() + Math.random(); 
};

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
  position: [number, number];
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
  matType: 'wire' | 'metal' | 'glass' | 'clay' | 'toon' | 'normal';
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
  linked: boolean;
  transmission: number;
  meshResolution: number;
  wireOcclusion: boolean;
};

// --- Core Math ---
const calculateRadius = (phi: number, m: number, n1: number, n2: number, n3: number, a: number = 1, b: number = 1) => {
  const t1 = Math.abs(Math.cos((m * phi) / 4) / a);
  const t2 = Math.abs(Math.sin((m * phi) / 4) / b);
  const val = Math.pow(t1, n2) + Math.pow(t2, n3);
  if (val === 0) return 0;
  return Math.pow(val, -1 / n1);
};

// --- Validators ---
const isValid2DParams = (p: Params2D): { valid: boolean; reason?: string } => {
  if (p.n1 < 0.2) return { valid: false, reason: "n1 too small" };
  if (p.n1 > 20) return { valid: false, reason: "n1 too big" };

  let maxR = 0;
  let minR = Infinity;
  const steps = 32;

  for (let i = 0; i < steps; i++) {
    const phi = (i / steps) * Math.PI * 2;
    const r = calculateRadius(phi, p.m, p.n1, p.n2, p.n3);
    if (!isFinite(r)) return { valid: false, reason: "Infinite" };
    if (r > maxR) maxR = r;
    if (r < minR) minR = r;
  }

  if (maxR < 0.1) return { valid: false, reason: "Too small" };
  if (maxR > 100) return { valid: false, reason: "Too big" }; 
  if (minR > 0 && maxR / minR > 30) return { valid: false, reason: "Too spikey" };

  return { valid: true };
};

// --- Generators ---
export const create2DParams = (): Params2D => {
  let attempt = 0;
  while (attempt < 20) {
    const params: Params2D = {
      id: generateId(), // ★修正
      visible: true,
      m: [2, 3, 4, 5, 6, 8, 10, 12, 16][randInt(0, 8)], 
      n1: rand(0.3, 8), n2: rand(0.5, 10), n3: rand(0.5, 10),
      a: 1, b: 1,
      rotation: rand(0, Math.PI * 2),
      position: [0, 0],
      hue: randInt(0, 360), sat: randInt(60, 100), bri: randInt(70, 100),
      isFilled: Math.random() > 0.5,
      lineWidth: rand(5, 30),
      scale: rand(300, 450),
    };
    if (isValid2DParams(params).valid) return params;
    attempt++;
  }
  return { id: generateId(), visible: true, m: 4, n1: 1, n2: 1, n3: 1, a: 1, b: 1, rotation: 0, position: [0,0], hue: 100, sat: 100, bri: 50, isFilled: false, lineWidth: 10, scale: 300 };
};

export const mutate2D = (base: Params2D): Params2D => {
  let attempt = 0;
  while (attempt < 10) {
    const drift = (v: number, range: number) => v + rand(-range, range);
    const newParams: Params2D = {
      ...base,
      m: Math.random() < 0.1 ? [2,3,4,5,6,8,10,12,16][randInt(0,8)] : base.m,
      n1: clamp(drift(base.n1, 1.0), 0.3, 15),
      n2: clamp(drift(base.n2, 1.0), 0.5, 15),
      n3: clamp(drift(base.n3, 1.0), 0.5, 15),
      rotation: drift(base.rotation, 0.5),
      hue: (base.hue + randInt(-20, 20) + 360) % 360,
      scale: clamp(drift(base.scale, 20), 100, 800),
      lineWidth: clamp(drift(base.lineWidth, 2), 1, 50),
    };
    if (isValid2DParams(newParams).valid) return newParams;
    attempt++;
  }
  return base;
};

export const create3DParams = (): Params3D => {
  const typeRand = Math.random();
  let matType: Params3D['matType'] = 'glass';
  if (typeRand < 0.15) matType = 'wire';
  else if (typeRand < 0.3) matType = 'metal';
  else if (typeRand < 0.45) matType = 'clay';
  else if (typeRand < 0.6) matType = 'toon';
  else if (typeRand < 0.7) matType = 'normal';

  return {
    id: generateId(), // ★修正
    visible: true,
    m1: randInt(0, 8), m2: randInt(0, 8),
    n1: rand(0.5, 5), n2: rand(0.5, 5), n3: rand(0.5, 5),
    color: `hsl(${randInt(0, 360)}, 100%, 50%)`,
    matType,
    scale: rand(0.8, 1.3),
    position: [0, 0, 0], rotation: [0, 0, 0], linked: false, transmission: rand(0.8, 1.0), meshResolution: 64, wireOcclusion: false,
  };
};

export const mutate3D = (base: Params3D): Params3D => {
    const drift = (v: number, range: number) => v + rand(-range, range);
    return {
        ...base,
        n1: clamp(drift(base.n1, 0.5), 0.3, 10),
        n2: clamp(drift(base.n2, 0.5), 0.3, 10),
        n3: clamp(drift(base.n3, 0.5), 0.3, 10),
        scale: clamp(drift(base.scale, 0.1), 0.5, 2.0),
    };
};

export const getSuperformulaPoint = (phi: number, p: Params2D) => {
  let r = calculateRadius(phi, p.m, p.n1, p.n2, p.n3, p.a, p.b);
  if (!isFinite(r)) r = 0;
  return { x: r * Math.cos(phi) * p.scale, y: r * Math.sin(phi) * p.scale };
};

export const supershape = (theta: number, m: number, n1: number, n2: number, n3: number) => {
  return calculateRadius(theta, m, n1, n2, n3);
};
