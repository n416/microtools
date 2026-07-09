import * as THREE from 'three';

// パラメトリック人型機体ジェネレーター。
// シード値とスタイルプリセットから、SceneIo.loadFromData() がそのまま読める
// シーンデータ (objects + joints) を生成する。APIキー不要・完全オフライン。
//
// リグの構造 (uuid命名) は sample-mecha.json と同一規約:
//   パーツ: p-pelvis, p-abdomen, p-chest, p-head, p-thigh-l/r, ...
//   関節:   j-waist, j-chest, j-neck, j-shoulder-l/r, j-elbow-l/r, j-hip-l/r, j-knee-l/r, ...
// PoseGenerator.js はこの命名を前提に自動ポーズを計算する。

// 決定的な乱数 (同じシード → 同じ機体)
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const PRESETS = {
  standard: {
    label: '標準',
    bulk: [0.9, 1.15],
    shoulder: [0.9, 1.15],
    leg: [0.95, 1.1],
    head: [0.9, 1.1],
    torsoDepth: [0.9, 1.1],
    padChance: 0.45,
    packChance: 0.35,
    antennaChance: 0.35,
    weaponBias: { rifle: 0.4, blade: 0.3 }, // 残りは「なし」
  },
  heavy: {
    label: '重装',
    bulk: [1.3, 1.65],
    shoulder: [1.15, 1.45],
    leg: [0.85, 1.0],
    head: [0.85, 1.0],
    torsoDepth: [1.2, 1.45],
    padChance: 0.9,
    packChance: 0.75,
    antennaChance: 0.2,
    weaponBias: { rifle: 0.55, blade: 0.1 },
  },
  tankformer: {
    label: '戦車型', // トランスフォーマー式。generateTankFormer が専用処理する (以下の範囲は未使用)
  },
  slim: {
    label: '細身',
    bulk: [0.62, 0.8],
    shoulder: [0.8, 0.95],
    leg: [1.1, 1.28],
    head: [0.85, 1.0],
    torsoDepth: [0.75, 0.9],
    padChance: 0.2,
    packChance: 0.2,
    antennaChance: 0.6,
    weaponBias: { rifle: 0.25, blade: 0.5 },
  },
};

function pick(rand, range) {
  return range[0] + rand() * (range[1] - range[0]);
}

const HINGE = [0, 0, 1.5707963268]; // 円柱ジョイントのY軸をX軸(左右)へ倒す = 肘/膝/足首

/** objects/joints 配列へプリミティブを積むビルダー群 (人型/戦車型の両ジェネレーターで共用) */
function makeBuilders(objects, joints) {
  const mat = (color, opts = {}) => ({
    color,
    metalness: 0.3,
    emissive: opts.emissive ?? 0,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
  const box = (uuid, name, w, h, d, x, y, z, color, opts = {}) => {
    objects.push({
      uuid,
      name,
      geometryType: 'Box',
      geometryParameters: { width: w, height: h, depth: d },
      position: [x, y, z],
      rotation: opts.rotation || [0, 0, 0],
      scale: [1, 1, 1],
      material: mat(color, opts),
      userData: { isPinned: !!opts.pinned },
    });
  };
  const sphere = (uuid, name, r, x, y, z, color, opts = {}) => {
    objects.push({
      uuid,
      name,
      geometryType: 'Sphere',
      geometryParameters: { radius: r, widthSegments: 20, heightSegments: 12 },
      position: [x, y, z],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      material: mat(color, opts),
      userData: { isPinned: !!opts.pinned },
    });
  };
  const cylinder = (uuid, name, rTop, rBottom, h, x, y, z, color, opts = {}) => {
    objects.push({
      uuid,
      name,
      geometryType: 'Cylinder',
      geometryParameters: { radiusTop: rTop, radiusBottom: rBottom, height: h, radialSegments: 12 },
      position: [x, y, z],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      material: mat(color, opts),
      userData: { isPinned: false },
    });
  };
  const joint = (uuid, name, type, x, y, z, parentObject, childObjects, rotation = [0, 0, 0]) => {
    joints.push({
      uuid,
      name,
      type,
      position: [x, y, z],
      rotation,
      scale: [1, 1, 1],
      parentObject,
      childObjects,
    });
  };
  return { box, sphere, cylinder, joint };
}

function hsl(h, s, l) {
  // hは度数(0-360超過OK)。THREE.Colorのhexへ
  const c = new THREE.Color();
  c.setHSL(((h % 360) + 360) % 360 / 360, s, l);
  return c.getHex();
}

/** 機体全体の配色をシードから決める (5色: 主色/副色/暗色/差し色/バイザー) */
function buildColorScheme(rand) {
  const hue = rand() * 360;
  return {
    primary: hsl(hue, 0.45 + rand() * 0.2, 0.34 + rand() * 0.12),
    secondary: hsl(hue + (rand() - 0.5) * 40, 0.08 + rand() * 0.12, 0.52 + rand() * 0.14),
    dark: hsl(hue, 0.2 + rand() * 0.15, 0.16 + rand() * 0.08),
    accent: hsl(hue + 150 + rand() * 60, 0.55 + rand() * 0.2, 0.42 + rand() * 0.14),
    visor: hsl(hue + 150 + rand() * 60, 0.7, 0.55 + rand() * 0.15),
  };
}

export function generateMechaData({ seed = 1, preset = 'standard', weapon = 'auto' } = {}) {
  if (preset === 'tankformer') return generateTankFormer(seed); // 戦車型は専用ジェネレーター (weaponは主砲固定)
  const spec = PRESETS[preset] || PRESETS.standard;
  const rand = mulberry32(seed);

  const bulk = pick(rand, spec.bulk); // 手足・胴の太さ
  const shoulderScale = pick(rand, spec.shoulder); // 肩幅
  const legScale = pick(rand, spec.leg); // 脚の長さ
  const headScale = pick(rand, spec.head); // 頭の大きさ
  const torsoDepth = pick(rand, spec.torsoDepth); // 胴の奥行き
  const armScale = 0.9 + 0.2 * ((legScale - 0.85) / 0.45); // 脚に釣り合う腕の長さ
  const colors = buildColorScheme(rand);
  const headIsBox = rand() < 0.45;
  const hasPads = rand() < spec.padChance;
  const hasPack = rand() < spec.packChance;
  const hasAntenna = rand() < spec.antennaChance;
  // 武器の抽選は最後に行う (weapon指定の有無で同一シードの機体本体が変わらないように)
  let weaponType = weapon;
  if (weaponType === 'auto') {
    const roll = rand();
    weaponType = roll < spec.weaponBias.rifle ? 'rifle'
      : roll < spec.weaponBias.rifle + spec.weaponBias.blade ? 'blade'
      : 'none';
  }

  // --- 縦方向のスタック (地面y=0から積み上げ。sample-mecha.json と同じ組み立て) ---
  const footH = 0.08;
  const footCenter = footH / 2;
  const ankleY = footH + 0.01;
  const shinLen = 0.26 * legScale;
  const kneeY = ankleY + shinLen + 0.025;
  const shinCenter = (ankleY + kneeY) / 2;
  const thighLen = 0.28 * legScale;
  const hipY = kneeY + thighLen + 0.02;
  const thighCenter = (kneeY + hipY) / 2;
  const pelvisH = 0.12;
  const pelvisCenter = hipY + pelvisH / 2;
  const waistY = hipY + pelvisH + 0.005;
  const abdomenH = 0.1;
  const abdomenCenter = waistY + 0.005 + abdomenH / 2;
  const chestJointY = abdomenCenter + abdomenH / 2 + 0.005;
  const chestH = 0.2;
  const chestCenter = chestJointY + 0.005 + chestH / 2;
  const chestTop = chestCenter + chestH / 2;
  const neckY = chestTop + 0.015;
  const headR = 0.105 * headScale;
  const headCenter = neckY + 0.01 + headR;

  const chestW = 0.3 * shoulderScale * (0.85 + 0.3 * (bulk - 0.6));
  const chestD = 0.17 * torsoDepth;
  const shoulderY = chestJointY + chestH * 0.8;
  const shoulderX = chestW / 2 + 0.035;
  const uarmW = 0.075 * bulk;
  const armX = chestW / 2 + uarmW / 2 + 0.025;
  const uarmLen = 0.2 * armScale;
  const elbowY = shoulderY - uarmLen - 0.01;
  const uarmCenter = (shoulderY + elbowY) / 2;
  const farmLen = 0.2 * armScale;
  const wristY = elbowY - 0.02 - farmLen;
  const farmCenter = (elbowY + wristY) / 2;
  const handR = 0.05 * Math.sqrt(bulk);
  const handY = wristY - handR - 0.005;
  const legX = Math.max(0.09, chestW * 0.3);

  const objects = [];
  const joints = [];
  const { box, sphere, cylinder, joint } = makeBuilders(objects, joints);

  // --- 胴体 ---
  box('p-pelvis', '腰', 0.27 * shoulderScale * bulk, pelvisH, 0.16 * torsoDepth, 0, pelvisCenter, 0, colors.secondary, { pinned: true });
  box('p-abdomen', '腹', 0.21 * shoulderScale * bulk * 0.9, abdomenH, 0.14 * torsoDepth, 0, abdomenCenter, 0, colors.dark);
  box('p-chest', '胸', chestW, chestH, chestD, 0, chestCenter, 0, colors.primary);
  box('p-accent', '胸アクセント', chestW * 0.5, chestH * 0.4, 0.02, 0, chestCenter + chestH * 0.1, chestD / 2 + 0.005, colors.accent);
  // --- バックパック (変形③の主役: 飛行形態では羽根、タンク形態では砲塔になる) ---
  // 常時生成。hasPack は「大型パック」の抽選に流用する (乱数の消費順を変えず、同一シードの体型を保つ)
  const packW = chestW * (hasPack ? 0.8 : 0.62);
  const packH = chestH * (hasPack ? 0.95 : 0.78);
  const packD = (hasPack ? 0.115 : 0.085) * torsoDepth;
  const packZ = -(chestD / 2 + packD / 2 + 0.005);
  const wingH = 0.21; // 羽根パネル長。PoseGenerator はレール位置から展開量を計算するので固定でよい
  const wingZ = packZ - packD / 2 - 0.013;
  const nozzleLen = 0.09;
  const nozzleR = 0.028 * Math.sqrt(bulk);
  const nozzleY = chestCenter - packH / 2 - nozzleLen / 2 + 0.015;
  box('p-pack', 'バックパック', packW, packH, packD, 0, chestCenter, packZ, colors.dark);
  box('p-wing-l', '左ウィング', 0.05, wingH, 0.022, -packW * 0.27, chestCenter, wingZ, colors.primary);
  box('p-wing-r', '右ウィング', 0.05, wingH, 0.022, packW * 0.27, chestCenter, wingZ, colors.primary);
  // ノズルは下向き噴射。飛行形態(全身+90°X回転)で後方噴射に、砲塔(パック-90°X回転)で前方=砲身になる
  cylinder('p-nozzle-l', '左ノズル', nozzleR, nozzleR * 1.2, nozzleLen, -packW * 0.28, nozzleY, packZ, colors.secondary);
  cylinder('p-nozzle-r', '右ノズル', nozzleR, nozzleR * 1.2, nozzleLen, packW * 0.28, nozzleY, packZ, colors.secondary);

  // --- 頭 ---
  if (headIsBox) {
    box('p-head', '頭', headR * 1.8, headR * 1.7, headR * 1.8, 0, headCenter, 0, colors.secondary);
  } else {
    sphere('p-head', '頭', headR, 0, headCenter, 0, colors.secondary);
  }
  box('p-visor', 'バイザー', headR * 1.4, headR * 0.45, 0.03, 0, headCenter + headR * 0.05, headR * 0.82, colors.visor, {
    emissive: colors.visor,
    emissiveIntensity: 0.6,
  });
  if (hasAntenna) {
    box('p-antenna', 'アンテナ', 0.015, headR * 1.6, 0.015, headR * 0.7, headCenter + headR * 1.3, 0, colors.accent);
  }

  // --- 左右対称パーツ (s = -1:左, +1:右) ---
  [['l', -1], ['r', 1]].forEach(([side, s]) => {
    const sideName = side === 'l' ? '左' : '右';

    // 腕
    sphere(`p-shoulder-${side}`, `${sideName}肩`, 0.06 * Math.sqrt(bulk) * 1.4, s * shoulderX, shoulderY, 0, colors.secondary);
    if (hasPads) {
      box(`p-pad-${side}`, `${sideName}肩アーマー`, uarmW * 2.2, 0.09 * bulk, 0.12 * torsoDepth, s * (shoulderX + uarmW * 0.3), shoulderY + 0.05, 0, colors.primary);
    }
    box(`p-uarm-${side}`, `${sideName}上腕`, uarmW, uarmLen, uarmW * 1.1, s * armX, uarmCenter, 0, colors.secondary);
    box(`p-farm-${side}`, `${sideName}前腕`, uarmW * 0.85, farmLen, uarmW * 0.9, s * armX, farmCenter, 0, colors.dark);
    sphere(`p-hand-${side}`, `${sideName}手`, handR, s * armX, handY, 0, colors.dark);

    joint(`j-shoulder-${side}`, `${sideName}肩関節`, 'sphere', s * shoulderX, shoulderY, 0, 'p-chest',
      hasPads ? [`p-uarm-${side}`, `p-shoulder-${side}`, `p-pad-${side}`] : [`p-uarm-${side}`, `p-shoulder-${side}`]);
    joint(`j-elbow-${side}`, `${sideName}肘関節`, 'cylinder', s * armX, elbowY, 0, `p-uarm-${side}`, [`p-farm-${side}`], HINGE);
    joint(`j-wrist-${side}`, `${sideName}手首関節`, 'sphere', s * armX, wristY, 0, `p-farm-${side}`, [`p-hand-${side}`]);

    // 脚
    box(`p-thigh-${side}`, `${sideName}腿`, 0.105 * bulk, thighLen, 0.115 * bulk, s * legX, thighCenter, 0, colors.primary);
    box(`p-shin-${side}`, `${sideName}脛`, 0.085 * bulk, shinLen, 0.09 * bulk, s * legX, shinCenter, 0, colors.secondary);
    box(`p-foot-${side}`, `${sideName}足`, 0.1 * bulk, footH, 0.2 + 0.06 * (bulk - 1), s * legX, footCenter, 0.03, colors.dark);

    joint(`j-hip-${side}`, `${sideName}股関節`, 'sphere', s * legX, hipY, 0, 'p-pelvis', [`p-thigh-${side}`]);
    joint(`j-knee-${side}`, `${sideName}膝関節`, 'cylinder', s * legX, kneeY, 0, `p-thigh-${side}`, [`p-shin-${side}`], HINGE);
    joint(`j-ankle-${side}`, `${sideName}足首関節`, 'cylinder', s * legX, ankleY, 0, `p-shin-${side}`, [`p-foot-${side}`], HINGE);

    // 履帯ブロック (変形③): 人型では腰の二枚重ねサイドスカート。タンク形態で外板が前へ・
    // 内板が後ろへスライドして前後に連結し、車体全長を覆う一本の履帯になる。
    // 奥行き0.16は固定 — PoseGeneratorが接地高さ(0.16/2)と連結位置を前提に配置する
    const treadX = (0.27 * shoulderScale * bulk) / 2 + 0.045;
    const treadH = thighLen * 1.15;
    const treadY = hipY - treadH / 2 + 0.03;
    box(`p-tread-${side}-a`, `${sideName}履帯(外)`, 0.055, treadH, 0.16, s * (treadX + 0.058), treadY, 0.01, colors.dark);
    box(`p-tread-${side}-b`, `${sideName}履帯(内)`, 0.055, treadH, 0.16, s * treadX, treadY, 0.01, colors.dark);
    joint(`j-tread-${side}`, `${sideName}履帯レール`, 'slide', s * (treadX + 0.029), hipY, 0.01, 'p-pelvis',
      [`p-tread-${side}-a`, `p-tread-${side}-b`], [0, 0, 1.5707963268]);
  });

  // --- 武器 (右手に持たせる) ---
  // 下げた腕に沿って垂直(銃口/剣先が下)に生成する。構えポーズで腕を前方90°へ
  // 上げると、j-grip経由で腕サブツリーと一緒に回転して自然に前を向く。
  if (weaponType === 'rifle') {
    box('p-weapon', 'ライフル本体', 0.05, 0.24, 0.075, armX, handY - 0.02, 0.015, colors.dark);
    cylinder('p-weapon-b', '銃身', 0.016, 0.016, 0.2, armX, handY - 0.22, 0.015, colors.secondary);
    box('p-weapon-c', 'ストック', 0.04, 0.09, 0.06, armX, handY + 0.1, 0.015, colors.primary);
  } else if (weaponType === 'blade') {
    box('p-weapon', 'ブレード刀身', 0.016, 0.42, 0.06, armX, handY - 0.28, 0.015, colors.visor, {
      emissive: colors.visor,
      emissiveIntensity: 0.5,
    });
    box('p-weapon-b', '鍔', 0.055, 0.02, 0.09, armX, handY - 0.06, 0.015, colors.dark);
    box('p-weapon-c', '柄', 0.028, 0.08, 0.04, armX, handY + 0.05, 0.015, colors.accent);
  }
  if (weaponType !== 'none') {
    joint('j-grip', 'グリップ', 'sphere', armX, handY, 0, 'p-hand-r', ['p-weapon', 'p-weapon-b', 'p-weapon-c']);
  }

  // --- バックパックの関節 (スライドジョイント。IK/FKの軸 = ジョイントrotationをX軸に適用した向き) ---
  // パックは縦レールで胸に接続 → タンク形態でせり上がって砲塔になる
  joint('j-pack', 'パックレール', 'slide', 0, chestCenter + packH / 2, packZ, 'p-chest',
    ['p-pack', 'p-nozzle-l', 'p-nozzle-r'], [0, 0, 1.5707963268]);
  // 羽根は横レールでパックに接続 → 飛行形態で外側へ展開する
  joint('j-wing-l', '左ウィングレール', 'slide', -packW / 2, chestCenter, wingZ, 'p-pack', ['p-wing-l']);
  joint('j-wing-r', '右ウィングレール', 'slide', packW / 2, chestCenter, wingZ, 'p-pack', ['p-wing-r']);

  // --- 体幹の関節 ---
  joint('j-waist', '腰関節', 'sphere', 0, waistY, 0, 'p-pelvis', ['p-abdomen']);
  joint('j-chest', '胸関節', 'sphere', 0, chestJointY, 0, 'p-abdomen', ['p-chest', 'p-accent']);
  joint('j-neck', '首関節', 'sphere', 0, neckY, 0, 'p-chest', hasAntenna ? ['p-head', 'p-visor', 'p-antenna'] : ['p-head', 'p-visor']);

  return { objects, joints, objectCounter: 100 };
}

// ============================================================================
// 戦車型 (トランスフォーマー式): 戦車の形状から逆算した変形専用機体。
//
// 設計の起点はタンク形態 (参考: ロボセン式メガトロン)。タンクは四隅の履帯ポッドで接地する:
//   後部履帯 = ロボットの「ふくらはぎ」×2。脛を最初から履帯ポッド寸法(0.10×0.30×0.16)で
//   作っておき、タンク形態で足を畳んで横倒し・接地する。
//   前部履帯 = 背中の「履帯ポッド」×2 (バックパック)。ロボット時は背負っており、
//   タンク形態でポッドレール(スライド)から前方へ展開して接地する。
//   砲塔 = 背中中央のターレット+主砲 (ポッドの隙間に収まる)。主砲は専用の砲関節
//   j-cannon (ヒンジ) で俯仰できる。タンク形態でせり上がって前を向く。
//   太腿は車体下部へ水平格納、胸の斜め前面装甲(グレイシス)が前部傾斜装甲になる。
//
// 構造寸法は固定 (乱数は配色・頭形状・アンテナのみ)。これにより PoseGenerator 側が
// TANKFORMER 定数で履帯ポッドへの正確な配置を計算できる。リグのuuid規約は人型と共通なので
// 歩き/走る等の既存ポーズもそのまま効く。
// ============================================================================

/** タンク形態の配置定数 (PoseGeneratorが参照する)。履帯ポッドは 0.10幅×0.30長×0.16高 */
export const TANKFORMER = {
  treadX: 0.17, // 履帯ポッドの中心x (左右対称)
  treadY: 0.08, // 〃 中心y = ポッド高0.16の半分 (接地)
  frontZ: 0.20, // 前部履帯 (背面ポッド) の中心z
  rearZ: -0.20, // 後部履帯 (ふくらはぎ) の中心z
  thighY: 0.24, // 格納した太腿の中心y
  thighZ: -0.12, // 〃 中心z
};

function generateTankFormer(seed) {
  const rand = mulberry32(seed);
  const colors = buildColorScheme(rand);
  const headIsBox = rand() < 0.7;
  const hasAntenna = rand() < 0.5;

  const objects = [];
  const joints = [];
  const { box, sphere, cylinder, joint } = makeBuilders(objects, joints);

  // --- 脚 (ふくらはぎ = 履帯ポッド寸法) ---
  const legX = 0.115;
  const footH = 0.09;
  const ankleY = footH + 0.01;
  const shinLen = 0.30; // ふくらはぎ = 履帯ポッド (0.10×0.30×0.16)
  const kneeY = ankleY + shinLen + 0.01;
  const thighLen = 0.24;
  const hipY = kneeY + thighLen + 0.01;
  [['l', -1], ['r', 1]].forEach(([side, s]) => {
    const n = side === 'l' ? '左' : '右';
    const shinC = ankleY + 0.005 + shinLen / 2;
    box(`p-thigh-${side}`, `${n}腿`, 0.11, thighLen, 0.15, s * legX, kneeY + 0.005 + thighLen / 2, 0, colors.primary);
    box(`p-shin-${side}`, `${n}脛`, 0.10, shinLen, 0.16, s * legX, shinC, 0, colors.dark);
    box(`p-foot-${side}`, `${n}足`, 0.10, footH, 0.20, s * legX, footH / 2, 0.03, colors.secondary);
    // 履帯シュー: ふくらはぎ背面の横リブ。ロボットでは履帯模様、タンク形態(-90°X)でこの面が接地面になる
    const shoes = [];
    [-0.105, -0.035, 0.035, 0.105].forEach((dy, i) => {
      shoes.push(`p-shoe-${side}-${i}`);
      box(`p-shoe-${side}-${i}`, `${n}履帯シュー${i + 1}`, 0.112, 0.028, 0.016, s * legX, shinC + dy, -0.086, colors.secondary);
    });
    joint(`j-hip-${side}`, `${n}股関節`, 'sphere', s * legX, hipY, 0, 'p-pelvis', [`p-thigh-${side}`]);
    joint(`j-knee-${side}`, `${n}膝関節`, 'cylinder', s * legX, kneeY, 0, `p-thigh-${side}`, [`p-shin-${side}`, ...shoes], HINGE);
    joint(`j-ankle-${side}`, `${n}足首関節`, 'cylinder', s * legX, ankleY, 0, `p-shin-${side}`, [`p-foot-${side}`], HINGE);
  });

  // --- 胴 = 車体 ---
  const pelvisC = hipY + 0.065;
  box('p-pelvis', '腰', 0.30, 0.13, 0.20, 0, pelvisC, 0, colors.secondary, { pinned: true });
  const waistY = pelvisC + 0.07;
  const abdC = waistY + 0.05;
  box('p-abdomen', '腹', 0.24, 0.09, 0.16, 0, abdC, 0, colors.dark);
  const chestJY = abdC + 0.05;
  const chestW = 0.36;
  const chestH = 0.20;
  const chestD = 0.22;
  const chestC = chestJY + 0.005 + chestH / 2;
  box('p-chest', '胸', chestW, chestH, chestD, 0, chestC, 0, colors.primary);
  // 前面装甲(グレイシス): 上端が奥へ倒れた斜め板。タンク形態(前傾)で前部傾斜装甲になる
  box('p-glacis', '前面装甲', chestW * 0.85, 0.16, 0.03, 0, chestC + 0.02, chestD / 2 + 0.02, colors.secondary, { rotation: [-0.5, 0, 0] });
  // 側面装甲とハッチ: ロボットでは胸の装甲、タンク形態(うつ伏せ)で車体側面と甲板のディテールになる
  box('p-plate-l', '左側面装甲', 0.022, 0.16, 0.20, -(chestW / 2 + 0.011), chestC, 0, colors.secondary);
  box('p-plate-r', '右側面装甲', 0.022, 0.16, 0.20, chestW / 2 + 0.011, chestC, 0, colors.secondary);
  box('p-hatch', 'ハッチ', 0.10, 0.12, 0.028, 0, chestC + 0.02, -(chestD / 2 + 0.014), colors.dark);

  // --- 頭 ---
  const neckY = chestC + chestH / 2 + 0.015;
  const headR = 0.085;
  const headC = neckY + 0.01 + headR;
  if (headIsBox) {
    box('p-head', '頭', headR * 1.9, headR * 1.7, headR * 1.9, 0, headC, 0, colors.secondary);
  } else {
    sphere('p-head', '頭', headR, 0, headC, 0, colors.secondary);
  }
  box('p-visor', 'バイザー', headR * 1.5, headR * 0.5, 0.03, 0, headC + headR * 0.05, headR * 0.85, colors.visor, {
    emissive: colors.visor,
    emissiveIntensity: 0.6,
  });
  if (hasAntenna) {
    box('p-antenna', 'アンテナ', 0.015, 0.14, 0.015, headR * 0.8, headC + headR * 1.2, 0, colors.accent);
  }

  // --- 腕 (タンク形態では前傾した車体の背面斜面に格納される) ---
  const shoulderY = chestC + chestH * 0.32;
  const shoulderX = chestW / 2 + 0.04;
  const uarmW = 0.10;
  const armX = chestW / 2 + uarmW / 2 + 0.03;
  const uarmLen = 0.19;
  const elbowY = shoulderY - uarmLen - 0.01;
  const farmLen = 0.19;
  const wristY = elbowY - 0.02 - farmLen;
  const handR = 0.055;
  [['l', -1], ['r', 1]].forEach(([side, s]) => {
    const n = side === 'l' ? '左' : '右';
    sphere(`p-shoulder-${side}`, `${n}肩`, 0.075, s * shoulderX, shoulderY, 0, colors.secondary);
    box(`p-uarm-${side}`, `${n}上腕`, uarmW, uarmLen, 0.11, s * armX, (shoulderY + elbowY) / 2, 0, colors.secondary);
    box(`p-farm-${side}`, `${n}前腕`, 0.09, farmLen, 0.10, s * armX, (elbowY + wristY) / 2, 0, colors.dark);
    sphere(`p-hand-${side}`, `${n}手`, handR, s * armX, wristY - handR - 0.005, 0, colors.dark);
    joint(`j-shoulder-${side}`, `${n}肩関節`, 'sphere', s * shoulderX, shoulderY, 0, 'p-chest', [`p-uarm-${side}`, `p-shoulder-${side}`]);
    joint(`j-elbow-${side}`, `${n}肘関節`, 'cylinder', s * armX, elbowY, 0, `p-uarm-${side}`, [`p-farm-${side}`], HINGE);
    joint(`j-wrist-${side}`, `${n}手首関節`, 'sphere', s * armX, wristY, 0, `p-farm-${side}`, [`p-hand-${side}`]);
  });

  // --- 背面ユニット (バックパック) ---
  // 履帯ポッド×2: ロボット時は背負い、タンク形態でポッドレールから前方へ展開して前部履帯になる。
  // 外面(-Z)の履帯シューはロボットでは背中の履帯模様、タンク形態(-90°X側へ倒す)で接地面になる
  const podZ = -(chestD / 2 + 0.005 + 0.08); // ポッド厚0.16の半分
  const podTopY = chestC + chestH / 2 - 0.005;
  [['l', -1], ['r', 1]].forEach(([side, s]) => {
    const n = side === 'l' ? '左' : '右';
    const podC = podTopY - 0.15;
    box(`p-tread-pod-${side}`, `${n}履帯ポッド`, 0.10, 0.30, 0.16, s * 0.11, podC, podZ, colors.dark);
    const ridges = [];
    [-0.105, -0.035, 0.035, 0.105].forEach((dy, i) => {
      ridges.push(`p-podshoe-${side}-${i}`);
      box(`p-podshoe-${side}-${i}`, `${n}ポッドシュー${i + 1}`, 0.112, 0.028, 0.016, s * 0.11, podC + dy, podZ - 0.088, colors.secondary);
    });
    joint(`j-tread-pod-${side}`, `${n}ポッドレール`, 'slide', s * 0.11, podTopY, podZ, 'p-chest', [`p-tread-pod-${side}`, ...ridges], [0, 0, 1.5707963268]);
  });
  // --- 主砲 (フュージョンカノン式): 右前腕の外側に装備 ---
  // ロボットでは腕の武装、タンク形態では腕ごと甲板上へ畳まれて砲塔になる。
  // 防盾(マントレット)とマズルブレーキは主砲関節(j-cannon, 親=右前腕)と一緒に俯仰する
  const cannonX = armX + 0.075;
  const cannonLen = 0.34;
  const cannonR = 0.03;
  cylinder('p-cannon', '主砲', cannonR, cannonR * 1.15, cannonLen, cannonX, elbowY - cannonLen / 2 + 0.02, 0, colors.dark);
  box('p-mantlet', '防盾', 0.085, 0.08, 0.085, cannonX, elbowY - 0.02, 0, colors.dark);
  box('p-muzzle', 'マズルブレーキ', 0.055, 0.05, 0.055, cannonX, elbowY - cannonLen + 0.035, 0, colors.secondary);
  joint('j-cannon', '主砲関節', 'cylinder', cannonX, elbowY, 0, 'p-farm-r', ['p-cannon', 'p-mantlet', 'p-muzzle'], HINGE);

  // --- 体幹の関節 ---
  joint('j-waist', '腰関節', 'sphere', 0, waistY, 0, 'p-pelvis', ['p-abdomen']);
  joint('j-chest', '胸関節', 'sphere', 0, chestJY, 0, 'p-abdomen', ['p-chest', 'p-glacis', 'p-plate-l', 'p-plate-r', 'p-hatch']);
  joint('j-neck', '首関節', 'sphere', 0, neckY, 0, 'p-chest', hasAntenna ? ['p-head', 'p-visor', 'p-antenna'] : ['p-head', 'p-visor']);

  return { objects, joints, objectCounter: 100 };
}
