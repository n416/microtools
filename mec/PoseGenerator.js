import * as THREE from 'three';
import * as AnimationFeatures from './AnimationFeatures.js';
import * as SceneIO from './SceneIo.js';
import { TANKFORMER } from './MechaGenerator.js';

// プリセット自動ポーズ生成。
// MechaGenerator.js の uuid命名規約 (p-*, j-*) を前提に、現在の立ちポーズ(基準ポーズ)から
// 歩き/待機/攻撃のコマ列を計算して、現在のアニメーションへ登録する。
// シーンのオブジェクトは一切動かさない (ポーズスナップショットの配列演算のみ)。

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

// 各部位サブツリー = 関節を支点に回したとき一緒に動くuuid群 (存在しないuuidは自動で無視)
const SUBTREES = {
  armL: ['p-shoulder-l', 'p-pad-l', 'p-uarm-l', 'j-elbow-l', 'p-farm-l', 'j-wrist-l', 'p-hand-l'],
  armR: ['p-shoulder-r', 'p-pad-r', 'p-uarm-r', 'j-elbow-r', 'p-farm-r', 'j-wrist-r', 'p-hand-r', 'j-grip', 'p-weapon', 'p-weapon-b', 'p-weapon-c', 'j-cannon', 'p-cannon', 'p-mantlet', 'p-muzzle'],
  forearmL: ['p-farm-l', 'j-wrist-l', 'p-hand-l'],
  forearmR: ['p-farm-r', 'j-wrist-r', 'p-hand-r', 'j-grip', 'p-weapon', 'p-weapon-b', 'p-weapon-c', 'j-cannon', 'p-cannon', 'p-mantlet', 'p-muzzle'],
  legL: ['p-thigh-l', 'j-knee-l', 'p-shin-l', 'j-ankle-l', 'p-foot-l', 'p-shoe-l-0', 'p-shoe-l-1', 'p-shoe-l-2', 'p-shoe-l-3'],
  legR: ['p-thigh-r', 'j-knee-r', 'p-shin-r', 'j-ankle-r', 'p-foot-r', 'p-shoe-r-0', 'p-shoe-r-1', 'p-shoe-r-2', 'p-shoe-r-3'],
  lowerLegL: ['p-shin-l', 'j-ankle-l', 'p-foot-l', 'p-shoe-l-0', 'p-shoe-l-1', 'p-shoe-l-2', 'p-shoe-l-3'],
  lowerLegR: ['p-shin-r', 'j-ankle-r', 'p-foot-r', 'p-shoe-r-0', 'p-shoe-r-1', 'p-shoe-r-2', 'p-shoe-r-3'],
  footL: ['p-foot-l'],
  footR: ['p-foot-r'],
  head: ['p-head', 'p-visor', 'p-antenna'],
  // 変形用: パック一式 (レールj-packは胸に残す) と羽根パネル単体、履帯ブロック単体。
  // j-cannon/p-cannon は戦車型(tankformer)の砲塔、thighSeg/shinSeg は戦車型の履帯セグメント配置用
  pack: ['p-pack', 'p-nozzle-l', 'p-nozzle-r', 'j-wing-l', 'p-wing-l', 'j-wing-r', 'p-wing-r'],
  wingL: ['p-wing-l'],
  wingR: ['p-wing-r'],
  treadLA: ['p-tread-l-a'],
  treadLB: ['p-tread-l-b'],
  treadRA: ['p-tread-r-a'],
  treadRB: ['p-tread-r-b'],
  cannon: ['p-cannon', 'p-mantlet', 'p-muzzle'],
  thighSegL: ['p-thigh-l'],
  thighSegR: ['p-thigh-r'],
  podL: ['p-tread-pod-l', 'p-podshoe-l-0', 'p-podshoe-l-1', 'p-podshoe-l-2', 'p-podshoe-l-3'],
  podR: ['p-tread-pod-r', 'p-podshoe-r-0', 'p-podshoe-r-1', 'p-podshoe-r-2', 'p-podshoe-r-3'],
  upperBody: [
    'p-abdomen', 'j-chest', 'p-chest', 'p-accent', 'p-glacis', 'p-plate-l', 'p-plate-r', 'p-hatch', 'j-neck', 'p-head', 'p-visor', 'p-antenna',
    'j-pack', 'p-pack', 'p-nozzle-l', 'p-nozzle-r', 'j-wing-l', 'p-wing-l', 'j-wing-r', 'p-wing-r', 'j-cannon', 'p-cannon', 'p-mantlet', 'p-muzzle',
    'j-tread-pod-l', 'p-tread-pod-l', 'j-tread-pod-r', 'p-tread-pod-r',
    'p-podshoe-l-0', 'p-podshoe-l-1', 'p-podshoe-l-2', 'p-podshoe-l-3',
    'p-podshoe-r-0', 'p-podshoe-r-1', 'p-podshoe-r-2', 'p-podshoe-r-3',
    'j-shoulder-l', 'p-shoulder-l', 'p-pad-l', 'p-uarm-l', 'j-elbow-l', 'p-farm-l', 'j-wrist-l', 'p-hand-l',
    'j-shoulder-r', 'p-shoulder-r', 'p-pad-r', 'p-uarm-r', 'j-elbow-r', 'p-farm-r', 'j-wrist-r', 'p-hand-r',
    'j-grip', 'p-weapon', 'p-weapon-b', 'p-weapon-c',
  ],
};

// ポーズ生成に最低限必要な関節。無ければ「生成機体ではない」と判断する
const REQUIRED_JOINTS = ['j-waist', 'j-shoulder-l', 'j-shoulder-r', 'j-hip-l', 'j-hip-r', 'j-knee-l', 'j-knee-r'];

function clonePose(pose) {
  return pose.map((e) => ({ uuid: e.uuid, position: [...e.position], quaternion: [...e.quaternion] }));
}

/** pose内で、任意の点pivotを支点に、subtreeKey('all'=全体)のuuid群をaxis周りにangle回転する */
function rotateAtPoint(pose, pivot, axis, angle, subtreeKey) {
  if (!angle) return;
  const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const targets = subtreeKey === 'all' ? null : new Set(SUBTREES[subtreeKey]);

  pose.forEach((e) => {
    if (targets && !targets.has(e.uuid)) return;
    const p = new THREE.Vector3().fromArray(e.position).sub(pivot).applyQuaternion(q).add(pivot);
    e.position = p.toArray();
    const eq = new THREE.Quaternion().fromArray(e.quaternion).premultiply(q);
    e.quaternion = eq.toArray();
  });
}

/** pose内で、pivotJointUuidの位置を支点に、subtreeKeyのuuid群をaxis周りにangle回転する */
function rotate(pose, pivotJointUuid, axis, angle, subtreeKey) {
  if (!angle) return;
  const pivotEntry = pose.find((e) => e.uuid === pivotJointUuid);
  if (!pivotEntry) return;
  rotateAtPoint(pose, new THREE.Vector3().fromArray(pivotEntry.position), axis, angle, subtreeKey);
}

/** pose全体(または指定サブツリー)を平行移動する */
function translate(pose, [dx, dy, dz], subtreeKey = 'all') {
  const targets = subtreeKey === 'all' ? null : new Set(SUBTREES[subtreeKey]);
  pose.forEach((e) => {
    if (targets && !targets.has(e.uuid)) return;
    e.position = [e.position[0] + dx, e.position[1] + dy, e.position[2] + dz];
  });
}

/** poseの指定uuidの位置をVector3で返す (無ければ原点) */
function posOf(pose, uuid) {
  const e = pose.find((p) => p.uuid === uuid);
  return e ? new THREE.Vector3().fromArray(e.position) : new THREE.Vector3();
}

// 前方 = +Z。X軸回転の向きの覚え方:
//   支点より「下」にあるもの(手足)は FWD*a (a>0) で前方(+Z)へ振れる。
//   支点より「上」にあるもの(上体・頭)は同じ FWD*a で「後方」へ倒れる。前傾は -FWD*a。
const FWD = -1;

function walkFrames(base) {
  const swing = 0.45; // 股関節の振り
  const armSwing = 0.5;
  const kneeBend = 0.55;

  const step = (legFwdIsLeft) => {
    const p = clonePose(base);
    const dir = legFwdIsLeft ? 1 : -1;
    rotate(p, 'j-hip-l', X, FWD * swing * dir, 'legL');
    rotate(p, 'j-hip-r', X, -FWD * swing * dir, 'legR');
    // 後ろ側の脚は膝を曲げて蹴り出しに、前側は軽く伸ばしたまま
    rotate(p, legFwdIsLeft ? 'j-knee-r' : 'j-knee-l', X, -FWD * kneeBend, legFwdIsLeft ? 'lowerLegR' : 'lowerLegL');
    // 腕は脚と逆位相
    rotate(p, 'j-shoulder-l', X, -FWD * armSwing * dir, 'armL');
    rotate(p, 'j-shoulder-r', X, FWD * armSwing * dir, 'armR');
    rotate(p, 'j-elbow-l', X, FWD * 0.25, 'forearmL');
    rotate(p, 'j-elbow-r', X, FWD * 0.25, 'forearmR');
    return p;
  };

  const passing = () => {
    const p = clonePose(base);
    rotate(p, 'j-knee-l', X, -FWD * 0.15, 'lowerLegL');
    rotate(p, 'j-knee-r', X, -FWD * 0.15, 'lowerLegR');
    rotate(p, 'j-elbow-l', X, FWD * 0.15, 'forearmL');
    rotate(p, 'j-elbow-r', X, FWD * 0.15, 'forearmR');
    return p;
  };

  return [step(true), passing(), step(false), passing()];
}

function idleFrames(base) {
  const f1 = clonePose(base);
  rotate(f1, 'j-elbow-l', X, FWD * 0.12, 'forearmL');
  rotate(f1, 'j-elbow-r', X, FWD * 0.12, 'forearmR');

  const f2 = clonePose(base);
  rotate(f2, 'j-waist', X, FWD * 0.05, 'upperBody'); // わずかな前傾 = 呼吸
  rotate(f2, 'j-shoulder-l', Z, -0.07, 'armL'); // 腕をわずかに開く
  rotate(f2, 'j-shoulder-r', Z, 0.07, 'armR');
  rotate(f2, 'j-elbow-l', X, FWD * 0.2, 'forearmL');
  rotate(f2, 'j-elbow-r', X, FWD * 0.2, 'forearmR');

  return [f1, f2];
}

function attackFrames(base) {
  // 溜め: 右腕を後ろへ引き、上体を右へひねる
  const windup = clonePose(base);
  rotate(windup, 'j-waist', Y, -0.3, 'upperBody');
  rotate(windup, 'j-shoulder-r', X, -FWD * 0.9, 'armR');
  rotate(windup, 'j-elbow-r', X, FWD * 0.9, 'forearmR');
  rotate(windup, 'j-shoulder-l', X, FWD * 0.3, 'armL');

  // 突き: 右腕を前方へ水平に伸ばし、上体を左へひねり、左脚を踏み込む
  const strike = clonePose(base);
  rotate(strike, 'j-waist', Y, 0.35, 'upperBody');
  rotate(strike, 'j-shoulder-r', X, FWD * 1.5, 'armR');
  rotate(strike, 'j-shoulder-l', X, -FWD * 0.4, 'armL');
  rotate(strike, 'j-elbow-l', X, FWD * 0.5, 'forearmL');
  rotate(strike, 'j-hip-l', X, FWD * 0.3, 'legL');
  rotate(strike, 'j-knee-r', X, -FWD * 0.3, 'lowerLegR');

  // 戻し: 突きの半分
  const recover = clonePose(base);
  rotate(recover, 'j-waist', Y, 0.15, 'upperBody');
  rotate(recover, 'j-shoulder-r', X, FWD * 0.7, 'armR');
  rotate(recover, 'j-elbow-r', X, FWD * 0.4, 'forearmR');

  return [windup, strike, recover];
}

function runFrames(base) {
  // 走り = 歩きより大振り + 前傾 + 両足が浮く滞空コマ
  const swing = 0.75;
  const armSwing = 0.85;

  const lean = (p) => rotateAtPoint(p, posOf(p, 'j-waist'), X, -FWD * 0.14, 'all'); // 前傾

  const step = (legFwdIsLeft) => {
    const p = clonePose(base);
    const dir = legFwdIsLeft ? 1 : -1;
    rotate(p, 'j-hip-l', X, FWD * swing * dir, 'legL');
    rotate(p, 'j-hip-r', X, -FWD * swing * dir, 'legR');
    rotate(p, legFwdIsLeft ? 'j-knee-r' : 'j-knee-l', X, -FWD * 0.95, legFwdIsLeft ? 'lowerLegR' : 'lowerLegL');
    rotate(p, legFwdIsLeft ? 'j-knee-l' : 'j-knee-r', X, -FWD * 0.2, legFwdIsLeft ? 'lowerLegL' : 'lowerLegR');
    rotate(p, 'j-shoulder-l', X, -FWD * armSwing * dir, 'armL');
    rotate(p, 'j-shoulder-r', X, FWD * armSwing * dir, 'armR');
    rotate(p, 'j-elbow-l', X, FWD * 0.9, 'forearmL');
    rotate(p, 'j-elbow-r', X, FWD * 0.9, 'forearmR');
    lean(p);
    return p;
  };

  const airborne = () => {
    const p = clonePose(base);
    rotate(p, 'j-hip-l', X, FWD * 0.25, 'legL');
    rotate(p, 'j-hip-r', X, -FWD * 0.25, 'legR');
    rotate(p, 'j-knee-l', X, -FWD * 0.6, 'lowerLegL');
    rotate(p, 'j-knee-r', X, -FWD * 0.6, 'lowerLegR');
    rotate(p, 'j-elbow-l', X, FWD * 0.9, 'forearmL');
    rotate(p, 'j-elbow-r', X, FWD * 0.9, 'forearmR');
    lean(p);
    translate(p, [0, 0.04, 0]); // 滞空
    return p;
  };

  return [step(true), airborne(), step(false), airborne()];
}

function jumpVFrames(base) {
  // その場ジャンプ4コマ (高さの移動はゲーム側で付ける前提で控えめに)
  const crouch = (armAngle) => {
    const p = clonePose(base);
    rotate(p, 'j-hip-l', X, FWD * 0.45, 'legL');
    rotate(p, 'j-hip-r', X, FWD * 0.45, 'legR');
    rotate(p, 'j-knee-l', X, -FWD * 0.85, 'lowerLegL');
    rotate(p, 'j-knee-r', X, -FWD * 0.85, 'lowerLegR');
    rotateAtPoint(p, posOf(p, 'j-waist'), X, -FWD * 0.2, 'upperBody'); // 前傾
    rotate(p, 'j-shoulder-l', X, armAngle, 'armL');
    rotate(p, 'j-shoulder-r', X, armAngle, 'armR');
    translate(p, [0, -0.05, 0]);
    return p;
  };

  const launch = () => {
    const p = clonePose(base);
    rotate(p, 'j-shoulder-l', X, FWD * 2.4, 'armL'); // 腕を振り上げ
    rotate(p, 'j-shoulder-r', X, FWD * 2.4, 'armR');
    rotate(p, 'j-hip-l', X, -FWD * 0.1, 'legL'); // 脚はわずかに後ろへ伸ばす
    rotate(p, 'j-hip-r', X, -FWD * 0.1, 'legR');
    translate(p, [0, 0.05, 0]);
    return p;
  };

  const tuck = () => {
    const p = clonePose(base);
    rotate(p, 'j-hip-l', X, FWD * 0.9, 'legL');
    rotate(p, 'j-hip-r', X, FWD * 0.9, 'legR');
    rotate(p, 'j-knee-l', X, -FWD * 1.2, 'lowerLegL');
    rotate(p, 'j-knee-r', X, -FWD * 1.2, 'lowerLegR');
    rotate(p, 'j-shoulder-l', X, FWD * 1.0, 'armL');
    rotate(p, 'j-shoulder-r', X, FWD * 1.0, 'armR');
    translate(p, [0, 0.1, 0]); // 空中
    return p;
  };

  return [crouch(-FWD * 0.5), launch(), tuck(), crouch(FWD * 0.4)];
}

function jumpSideFrames(base) {
  // 機体の右(+X)への回避ジャンプ3コマ。左向きが欲しければpixelchar側の反転機能で
  const tilt = (p, angle) => rotateAtPoint(p, posOf(p, 'j-waist'), Z, angle, 'all');

  const crouchIn = clonePose(base);
  rotate(crouchIn, 'j-knee-l', X, -FWD * 0.6, 'lowerLegL');
  rotate(crouchIn, 'j-knee-r', X, -FWD * 0.6, 'lowerLegR');
  rotate(crouchIn, 'j-hip-l', X, FWD * 0.3, 'legL');
  rotate(crouchIn, 'j-hip-r', X, FWD * 0.3, 'legR');
  tilt(crouchIn, -0.12);
  translate(crouchIn, [-0.02, -0.04, 0]);

  const flight = clonePose(base);
  rotate(flight, 'j-hip-l', Z, -0.35, 'legL'); // 脚は進行方向と逆へ流す
  rotate(flight, 'j-hip-r', Z, -0.35, 'legR');
  rotate(flight, 'j-knee-l', X, -FWD * 0.7, 'lowerLegL');
  rotate(flight, 'j-knee-r', X, -FWD * 0.7, 'lowerLegR');
  rotate(flight, 'j-shoulder-l', Z, -0.7, 'armL'); // 腕を広げてバランス
  rotate(flight, 'j-shoulder-r', Z, -0.3, 'armR');
  tilt(flight, -0.55);
  translate(flight, [0.08, 0.08, 0]);

  const land = clonePose(base);
  rotate(land, 'j-knee-l', X, -FWD * 0.45, 'lowerLegL');
  rotate(land, 'j-knee-r', X, -FWD * 0.45, 'lowerLegR');
  rotate(land, 'j-hip-l', X, FWD * 0.2, 'legL');
  rotate(land, 'j-hip-r', X, FWD * 0.2, 'legR');
  tilt(land, -0.08);
  translate(land, [0.05, -0.03, 0]);

  return [crouchIn, flight, land];
}

function hitFrames(base) {
  // 被弾: のけぞり → 半分戻る
  const recoil = clonePose(base);
  rotateAtPoint(recoil, posOf(recoil, 'j-waist'), X, FWD * 0.35, 'upperBody'); // 後方へのけぞる
  rotate(recoil, 'j-shoulder-l', X, FWD * 0.6, 'armL');
  rotate(recoil, 'j-shoulder-r', X, FWD * 0.6, 'armR');
  rotate(recoil, 'j-elbow-l', X, FWD * 0.4, 'forearmL');
  rotate(recoil, 'j-elbow-r', X, FWD * 0.4, 'forearmR');
  rotate(recoil, 'j-hip-l', X, FWD * 0.25, 'legL'); // 片脚を前に踏ん張る
  rotate(recoil, 'j-knee-r', X, -FWD * 0.3, 'lowerLegR');
  translate(recoil, [0, -0.01, -0.03]); // わずかにノックバック

  const recover = clonePose(base);
  rotateAtPoint(recover, posOf(recover, 'j-waist'), X, FWD * 0.15, 'upperBody');
  rotate(recover, 'j-shoulder-l', X, FWD * 0.25, 'armL');
  rotate(recover, 'j-shoulder-r', X, FWD * 0.25, 'armR');
  translate(recover, [0, 0, -0.015]);

  return [recoil, recover];
}

function downFrames(base) {
  // やられ: よろけ → 後方へ倒れ込み → 仰向けで倒れる
  const stagger = clonePose(base);
  rotateAtPoint(stagger, posOf(stagger, 'j-waist'), X, FWD * 0.3, 'upperBody');
  rotate(stagger, 'j-knee-l', X, -FWD * 0.5, 'lowerLegL');
  rotate(stagger, 'j-knee-r', X, -FWD * 0.5, 'lowerLegR');
  rotate(stagger, 'j-shoulder-l', X, FWD * 0.7, 'armL');
  rotate(stagger, 'j-shoulder-r', X, FWD * 0.7, 'armR');
  translate(stagger, [0, -0.03, -0.02]);

  // 倒れる回転の支点 = かかとの少し後ろの接地点
  const heelPivot = (p) => {
    const foot = posOf(p, 'p-foot-l');
    return new THREE.Vector3(0, 0, foot.z - 0.12);
  };

  const falling = clonePose(base);
  rotate(falling, 'j-knee-l', X, -FWD * 0.6, 'lowerLegL');
  rotate(falling, 'j-knee-r', X, -FWD * 0.6, 'lowerLegR');
  rotate(falling, 'j-shoulder-l', X, FWD * 1.2, 'armL'); // 腕が宙を掻く
  rotate(falling, 'j-shoulder-r', X, FWD * 1.0, 'armR');
  rotateAtPoint(falling, heelPivot(falling), X, FWD * 0.55, 'all'); // 後方へ傾く

  const lying = clonePose(base);
  rotate(lying, 'j-shoulder-l', Z, -0.5, 'armL'); // 腕を投げ出す
  rotate(lying, 'j-shoulder-r', Z, 0.5, 'armR');
  rotate(lying, 'j-knee-l', X, -FWD * 0.35, 'lowerLegL');
  rotate(lying, 'j-knee-r', X, -FWD * 0.35, 'lowerLegR');
  rotateAtPoint(lying, heelPivot(lying), X, FWD * 1.45, 'all'); // ほぼ仰向け
  translate(lying, [0, 0.02, 0]); // 地面へのめり込みを軽減

  return [stagger, falling, lying];
}

function buildAimPose(base, settle) {
  // 右腕を前方水平に上げて武器を構える (武器は下向き生成なので腕と一緒に前を向く)
  const p = clonePose(base);
  rotate(p, 'j-waist', Y, -0.15, 'upperBody'); // 半身に構える
  rotateAtPoint(p, posOf(p, 'j-waist'), X, -FWD * 0.08, 'upperBody'); // わずかな前傾
  rotate(p, 'j-shoulder-r', X, FWD * (1.5 - settle * 0.06), 'armR');
  rotate(p, 'j-shoulder-l', X, FWD * 1.05, 'armL'); // 左腕は添え手ぎみに
  rotate(p, 'j-elbow-l', X, FWD * 0.85, 'forearmL');
  rotate(p, 'j-knee-l', X, -FWD * 0.15, 'lowerLegL');
  rotate(p, 'j-knee-r', X, -FWD * 0.15, 'lowerLegR');
  return p;
}

function aimFrames(base) {
  return [buildAimPose(base, 0), buildAimPose(base, 1)];
}

function shootFrames(base) {
  const aim = buildAimPose(base, 0);

  // 発砲: 反動で銃口が跳ね上がり、上体がわずかに後ろへ
  const recoil = buildAimPose(base, 0);
  rotate(recoil, 'j-shoulder-r', X, FWD * 0.22, 'armR'); // マズルジャンプ
  rotate(recoil, 'j-elbow-r', X, -FWD * 0.15, 'forearmR');
  rotateAtPoint(recoil, posOf(recoil, 'j-waist'), X, FWD * 0.1, 'upperBody'); // のけぞり
  translate(recoil, [0, 0, -0.015]);

  return [aim, recoil, buildAimPose(base, 1)];
}

function slashFrames(base) {
  // 振りかぶり: 右腕を頭上へ、上体を後ろへひねる
  const windup = clonePose(base);
  rotate(windup, 'j-waist', Y, -0.3, 'upperBody');
  rotateAtPoint(windup, posOf(windup, 'j-waist'), X, FWD * 0.15, 'upperBody');
  rotate(windup, 'j-shoulder-r', X, FWD * 2.7, 'armR'); // 頭上に振り上げ
  rotate(windup, 'j-elbow-r', X, FWD * 0.35, 'forearmR');
  rotate(windup, 'j-shoulder-l', X, FWD * 0.5, 'armL');

  // 振り下ろし: 腕を前下方へ、上体を前へ、左脚を踏み込む
  const strike = clonePose(base);
  rotate(strike, 'j-waist', Y, 0.35, 'upperBody');
  rotateAtPoint(strike, posOf(strike, 'j-waist'), X, -FWD * 0.35, 'upperBody');
  rotate(strike, 'j-shoulder-r', X, FWD * 0.55, 'armR');
  rotate(strike, 'j-shoulder-l', X, -FWD * 0.45, 'armL');
  rotate(strike, 'j-hip-l', X, FWD * 0.35, 'legL');
  rotate(strike, 'j-knee-r', X, -FWD * 0.4, 'lowerLegR');

  // 残心: 振り抜いた位置で止まる
  const follow = clonePose(base);
  rotate(follow, 'j-waist', Y, 0.45, 'upperBody');
  rotateAtPoint(follow, posOf(follow, 'j-waist'), X, -FWD * 0.2, 'upperBody');
  rotate(follow, 'j-shoulder-r', X, FWD * 0.3, 'armR');
  rotate(follow, 'j-elbow-r', X, FWD * 0.2, 'forearmR');
  rotate(follow, 'j-shoulder-l', X, -FWD * 0.3, 'armL');
  rotate(follow, 'j-hip-l', X, FWD * 0.25, 'legL');

  return [windup, strike, follow];
}

// --- 変形 (③): バックパックが主役。羽根はウィングレールで展開、パックはパックレールで昇降 ---

/** 羽根パネルを自身の中心で横倒しし、レール(±X)に沿って外側へスライドする。t=展開率0〜1 */
function deployWings(pose, t) {
  [['p-wing-l', 'j-wing-l', 'wingL', -1], ['p-wing-r', 'j-wing-r', 'wingR', 1]].forEach(([wing, rail, key, s]) => {
    const c = posOf(pose, wing);
    rotateAtPoint(pose, c, Z, -s * 1.45 * t, key); // 83°の横倒し = 後ろ上がりに反った翼
    const railX = Math.abs(posOf(pose, rail).x);
    const dx = Math.max(0, railX + 0.1 - Math.abs(c.x)) * t;
    translate(pose, [s * dx, 0, 0], key);
  });
}

/** 飛行の流線形: 脚を閉じ、爪先を伸ばし、腕を体側へ沿わせる。t=0〜1 */
function streamline(p, t) {
  const hip = posOf(p, 'j-hip-l');
  const close = Math.atan2(Math.abs(hip.x) * 0.85, Math.max(0.1, hip.y)) * t; // 足首同士が寄る角度
  rotate(p, 'j-hip-l', Z, close, 'legL');
  rotate(p, 'j-hip-r', Z, -close, 'legR');
  rotate(p, 'j-ankle-l', X, -FWD * 1.0 * t, 'footL'); // 爪先を伸ばす
  rotate(p, 'j-ankle-r', X, -FWD * 1.0 * t, 'footR');
  rotate(p, 'j-shoulder-l', Z, 0.22 * t, 'armL'); // 腕を体側に密着
  rotate(p, 'j-shoulder-r', Z, -0.22 * t, 'armR');
  rotate(p, 'j-shoulder-l', X, -FWD * 0.25 * t, 'armL'); // わずかに後ろへ流す
  rotate(p, 'j-shoulder-r', X, -FWD * 0.25 * t, 'armR');
}

function flightFrames(base) {
  // 展開: 羽根が開き始め、軽くかがんで身構える
  const prep = clonePose(base);
  deployWings(prep, 0.45);
  streamline(prep, 0.3);
  rotate(prep, 'j-hip-l', X, FWD * 0.15, 'legL');
  rotate(prep, 'j-hip-r', X, FWD * 0.15, 'legR');
  rotate(prep, 'j-knee-l', X, -FWD * 0.35, 'lowerLegL');
  rotate(prep, 'j-knee-r', X, -FWD * 0.35, 'lowerLegR');
  translate(prep, [0, -0.03, 0]);

  // 浮上: 45°前傾で浮き上がる
  const rise = clonePose(base);
  deployWings(rise, 0.85);
  streamline(rise, 0.7);
  rotate(rise, 'j-neck', X, FWD * 0.3, 'head'); // 顔は進行方向へ起こす
  rotateAtPoint(rise, posOf(rise, 'j-waist'), X, -FWD * 0.85, 'all'); // 前傾45°強
  translate(rise, [0, 0.16, 0]);

  // 巡航: 完全に水平 (うつ伏せ)。下向きノズルが後方噴射になる。2コマ目は上下の揺れ
  const cruise = (bob) => {
    const p = clonePose(base);
    deployWings(p, 1);
    streamline(p, 1);
    rotate(p, 'j-neck', X, FWD * 0.55, 'head');
    rotateAtPoint(p, posOf(p, 'j-waist'), X, -FWD * (Math.PI / 2), 'all');
    translate(p, [0, 0.26 + bob, 0]);
    return p;
  };

  return [prep, rise, cruise(0), cruise(0.045)];
}

function tankFrames(base) {
  // しゃがみ: 変形開始の予備動作
  const crouch = clonePose(base);
  rotate(crouch, 'j-hip-l', X, FWD * 0.5, 'legL');
  rotate(crouch, 'j-hip-r', X, FWD * 0.5, 'legR');
  rotate(crouch, 'j-knee-l', X, -FWD * 0.9, 'lowerLegL');
  rotate(crouch, 'j-knee-r', X, -FWD * 0.9, 'lowerLegR');
  rotateAtPoint(crouch, posOf(crouch, 'j-waist'), X, -FWD * 0.15, 'upperBody');
  rotate(crouch, 'j-shoulder-l', Z, 0.2, 'armL');
  rotate(crouch, 'j-shoulder-r', Z, -0.2, 'armR');
  translate(crouch, [0, -0.07, 0]);

  // 車体化: 脚を前に畳んで車体下部(履帯ブロック)に、上体を腰から大きく前へ倒して車体上部にする。
  // 上体の前倒しがシルエット変化の主役 — 直立のままだと「中腰」にしか見えない
  const LEAN = 0.8; // 上体の前倒し角。deployTurretの砲身水平化と連動する
  const foldBody = (p) => {
    rotate(p, 'j-hip-l', X, FWD * 1.35, 'legL'); // 腿を前へ畳む (膝が車体前部)
    rotate(p, 'j-hip-r', X, FWD * 1.35, 'legR');
    rotate(p, 'j-knee-l', X, -FWD * 2.5, 'lowerLegL'); // 脛を腿の下へ折り返す
    rotate(p, 'j-knee-r', X, -FWD * 2.5, 'lowerLegR');
    rotate(p, 'j-ankle-l', X, FWD * 1.0, 'footL'); // 足裏をほぼ接地向きに戻す
    rotate(p, 'j-ankle-r', X, FWD * 1.0, 'footR');
    // 腕: 肩では回さない — 上体の前傾(LEAN)がそのまま上腕を背面斜面に沿わせる
    // (前傾は後ろ向きのベクトルを持ち上げる「てこ」なので、肩で後ろへ畳むと腕が上を向いてしまう)
    rotate(p, 'j-shoulder-l', Z, 0.35, 'armL'); // 車体側面への密着だけ行う
    rotate(p, 'j-shoulder-r', Z, -0.35, 'armR');
    rotate(p, 'j-elbow-l', X, -FWD * 0.77, 'forearmL'); // 前腕は前傾と合算で水平後方 = 格納状態
    rotate(p, 'j-elbow-r', X, -FWD * 0.77, 'forearmR');
    rotateAtPoint(p, posOf(p, 'j-waist'), X, -FWD * LEAN, 'upperBody'); // 上体を前へ倒す
    rotate(p, 'j-neck', X, -FWD * 0.8, 'head'); // 頭を砲塔の陰に沈める
    // 脚は履帯より高めに畳んで浮かせる (接地は履帯ブロックの底面に任せる)。
    // ここは中心座標ベースの粗い計算 — 正確な食い込み防止は clampFramesToGround が行う
    const minY = Math.min(posOf(p, 'j-knee-l').y, posOf(p, 'j-ankle-l').y, posOf(p, 'p-foot-l').y);
    translate(p, [0, -(minY - 0.1), 0]);
  };

  // 履帯展開: 二枚重ねのサイドスカートを横倒し(長軸を前後へ)にして接地させ、
  // 外板を前・内板を後ろに並べて車体全長を覆う一本の履帯にする。
  // 箱の奥行き0.16(MechaGenerator側で固定)が横倒し後の高さになる
  const deployTreads = (p) => {
    [['l', -1], ['r', 1]].forEach(([side, s]) => {
      const a = `p-tread-${side}-a`;
      const b = `p-tread-${side}-b`;
      if (!p.some((e) => e.uuid === a) || !p.some((e) => e.uuid === b)) return; // 履帯なし機体(旧データ)はスキップ
      const S = side.toUpperCase();
      const targetX = s * ((Math.abs(posOf(p, a).x) + Math.abs(posOf(p, b).x)) / 2); // 二枚を同一面に揃える
      [[a, `tread${S}A`, 0.145], [b, `tread${S}B`, -0.145]].forEach(([uuid, key, dz]) => {
        const c = posOf(p, uuid);
        rotateAtPoint(p, c, X, Math.PI / 2, key);
        translate(p, [targetX - c.x, 0.082 - c.y, 0.12 + dz - c.z], key);
      });
    });
  };

  // 砲塔展開: パックをレール(前傾した上体の軸)に沿ってせり上げ、t=1で前傾ぶんも含めて倒し、
  // ノズル=砲身が世界座標の前方(+Z)水平を向くようにする。lean = 上体を倒した角度
  const deployTurret = (p, t, lean = LEAN) => {
    const headY = posOf(p, 'p-head').y;
    const packC = posOf(p, 'p-pack');
    const rise = Math.max(0, (headY + 0.12 - packC.y) / Math.cos(lean)) * t;
    translate(p, [0, Math.cos(lean) * rise, Math.sin(lean) * rise], 'pack');
    if (t >= 1) rotateAtPoint(p, posOf(p, 'p-pack'), X, -(Math.PI / 2 + lean), 'pack');
  };

  // 戦車型(tankformer): タンクの形状から逆算した専用の畳み方 (ロボセン式メガトロン参照)。
  // **骨盤ごと全身をうつ伏せに倒すのが肝** — 上体だけ倒すと骨盤が直立のまま残り、
  // どうやってもガンタンク型(車体から胴が生えた形)になってしまう。
  //   車体 = うつ伏せの胴体 (頭が車首、背中=甲板)
  //   後部履帯 = ふくらはぎ、前部履帯 = 背面ポッド (絶対座標で四隅へ配置)
  //   砲塔 = 右腕。前腕のフュージョンカノンごと甲板上へ畳まれ、主砲が前方を向く
  const lieDown = (p) => {
    // 全身をうつ伏せへ (+90°X: 頭が前方+Z、背中=ポッド面が上)
    rotateAtPoint(p, posOf(p, 'j-waist'), X, Math.PI / 2, 'all');
    // 車体スラブの高さと前後位置を決める (胸中心 = 履帯上面の少し上・車体中央やや前)
    const chest = posOf(p, 'p-chest');
    translate(p, [0, 0.30 - chest.y, 0.05 - chest.z]);
    rotate(p, 'j-neck', X, 0.35, 'head'); // 頭=車首を少し沈める
    rotate(p, 'j-shoulder-l', Z, 0.3, 'armL'); // 左腕は車体側面に沿わせたまま
    // 自中心でangle回転してから目標位置へ
    const place = (uuid, key, angle, tx, ty, tz) => {
      const c = posOf(p, uuid);
      if (angle) rotateAtPoint(p, c, X, angle, key);
      translate(p, [tx - c.x, ty - c.y, tz - c.z], key);
    };
    [['l', -1], ['r', 1]].forEach(([side, s]) => {
      const S = side === 'l' ? 'L' : 'R';
      // 太腿を股関節から真下へ畳む (後部履帯の間に隠れる)
      rotate(p, `j-hip-${side}`, X, -Math.PI / 2, `leg${S}`);
      // 足を脛の前面へ畳んでから、ふくらはぎを後部履帯へ (シュー面が接地する向き)
      rotate(p, `j-ankle-${side}`, X, -Math.PI / 2, `foot${S}`);
      place(`p-shin-${side}`, `lowerLeg${S}`, -Math.PI / 2, s * TANKFORMER.treadX, TANKFORMER.treadY, TANKFORMER.rearZ);
      // 背面ポッド → 前部履帯 (うつ伏せで+90°回っているので-180°でシュー面が接地へ)
      place(`p-tread-pod-${side}`, `pod${S}`, -Math.PI, s * TANKFORMER.treadX, TANKFORMER.treadY, TANKFORMER.frontZ);
    });
  };

  // 砲塔展開: 右腕を甲板上へ畳み、前腕のフュージョンカノンが車体中央で前方を向く
  const deployArmTurret = (p) => {
    rotate(p, 'j-shoulder-r', X, Math.PI / 2, 'armR'); // 上腕を甲板側へ立てる
    rotateAtPoint(p, posOf(p, 'p-farm-r'), X, Math.PI / 2, 'forearmR'); // 前腕+主砲を前方水平へ
    const cn = posOf(p, 'p-cannon');
    translate(p, [-cn.x, 0.44 - cn.y, 0.14 - cn.z], 'forearmR'); // 主砲を車体中央の甲板上へ
  };

  const isTankFormer = base.some((e) => e.uuid === 'p-cannon');

  if (isTankFormer) {
    // 寝そべり: 車体化と履帯接地が完了 (砲塔=右腕はまだ側面)
    const folded = clonePose(base);
    lieDown(folded);

    const turret = clonePose(base);
    lieDown(turret);
    deployArmTurret(turret);

    // 完成: 主砲関節で仰角をつける待機モーション
    const settle = clonePose(base);
    lieDown(settle);
    deployArmTurret(settle);
    rotate(settle, 'j-cannon', X, -0.1, 'cannon');
    translate(settle, [0, -0.008, 0]);

    return [crouch, folded, turret, settle];
  }

  // 折りたたみ: 車体化と履帯接地が完了し、パックがせり上がり始める (まだ縦向き)
  const folded = clonePose(base);
  foldBody(folded);
  deployTreads(folded);
  deployTurret(folded, 0.55);

  const turret = clonePose(base);
  foldBody(turret);
  deployTreads(turret);
  deployTurret(turret, 1);

  // 完成: 砲身をわずかに持ち上げ、車体が沈み込む待機モーション
  const settle = clonePose(base);
  foldBody(settle);
  deployTreads(settle);
  deployTurret(settle, 1);
  rotateAtPoint(settle, posOf(settle, 'p-pack'), X, -0.08, 'pack'); // 砲身仰角
  translate(settle, [0, -0.008, 0]);

  return [crouch, folded, turret, settle];
}

/**
 * 全コマの「実ジオメトリの最下点」を計算し、0面より下に食い込んでいたらコマ全体を持ち上げる。
 * ポーズの中心座標だけではボックスの厚み半分が地面下に沈む(太い機体ほど深く沈む)ため、
 * mechaGroupの実メッシュのバウンディングボックス8隅をポーズの回転・スケールで変換して判定する。
 * 持ち上げのみ行う (ジャンプ・飛行の意図的な浮きは触らない)。
 */
function clampFramesToGround(appContext, frames) {
  const corners = new Map(); // uuid -> ローカルbbox8隅 (スケール適用済み)
  appContext.mechaGroup.children.forEach((m) => {
    if (!m.geometry) return;
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox;
    if (!b) return;
    const list = [];
    [b.min.x, b.max.x].forEach((x) => [b.min.y, b.max.y].forEach((y) => [b.min.z, b.max.z].forEach((z) => {
      list.push(new THREE.Vector3(x * m.scale.x, y * m.scale.y, z * m.scale.z));
    })));
    corners.set(m.uuid, list);
  });

  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  frames.forEach((frame) => {
    let minY = Infinity;
    frame.forEach((e) => {
      const list = corners.get(e.uuid);
      if (!list) return; // ジョイント等、描画されないものは無視
      q.fromArray(e.quaternion);
      list.forEach((c) => {
        const y = v.copy(c).applyQuaternion(q).y + e.position[1];
        if (y < minY) minY = y;
      });
    });
    if (Number.isFinite(minY) && minY < 0) translate(frame, [0, -minY + 0.002, 0]);
  });
}

export const POSE_PRESETS = {
  idle: { label: '待機', build: idleFrames },
  walk: { label: '歩き', build: walkFrames },
  run: { label: '走る', build: runFrames },
  jumpV: { label: '縦飛び', build: jumpVFrames },
  jumpSide: { label: '横飛び', build: jumpSideFrames },
  attack: { label: '攻撃', build: attackFrames },
  aim: { label: '構え', build: aimFrames },
  shoot: { label: '射撃', build: shootFrames },
  slash: { label: '斬撃', build: slashFrames },
  hit: { label: '被弾', build: hitFrames },
  down: { label: 'やられ', build: downFrames },
  flight: { label: '飛行形態', build: flightFrames, requires: ['j-pack', 'j-wing-l', 'j-wing-r'] },
  // タンクは人型リグ(j-pack=バックパック)か戦車型リグ(p-cannon=腕の主砲)のどちらかで変形できる
  tank: { label: 'タンク形態', build: tankFrames, requiresAny: [['j-pack'], ['p-cannon']] },
};

/**
 * 現在の立ちポーズを基準に、プリセットのコマ列を計算して現在のアニメーションへ登録する。
 * 成功時true。生成機体のリグ(j-waist等)が見つからない場合は何もせずfalse。
 */
export function applyPosePreset(appContext, presetId) {
  const preset = POSE_PRESETS[presetId];
  if (!preset) return false;

  // 基準は原則「機体生成時に保存した素の立ちポーズ」。コマ復元などでシーンの
  // ポーズが変わっていても、その上に二重掛けせず常に立ちポーズから計算する。
  // 保存が無い/機体が変わっている場合のみ現在のシーンポーズへフォールバック。
  let base = AnimationFeatures.createPoseSnapshot(appContext);
  const saved = appContext.app.basePose;
  if (Array.isArray(saved) && saved.length === base.length) {
    const currentUuids = new Set(base.map((e) => e.uuid));
    if (saved.every((e) => currentUuids.has(e.uuid))) {
      base = clonePose(saved);
    }
  }
  const uuids = new Set(base.map((e) => e.uuid));
  const missing = REQUIRED_JOINTS.filter((u) => !uuids.has(u));
  if (missing.length > 0) {
    appContext.log(`自動ポーズは生成機体専用です (関節が見つかりません: ${missing[0]} 他)`);
    return false;
  }
  const missingExtra = (preset.requires || []).filter((u) => !uuids.has(u));
  if (missingExtra.length > 0) {
    appContext.log(`「${preset.label}」はバックパック付きの機体専用です。機体を生成し直してください (${missingExtra[0]} が見つかりません)`);
    return false;
  }
  // requiresAny: いずれかのリグ一式が揃っていればよい
  if (preset.requiresAny && !preset.requiresAny.some((group) => group.every((u) => uuids.has(u)))) {
    appContext.log(`「${preset.label}」は変形用の部位を持つ機体専用です。機体を生成し直してください`);
    return false;
  }

  const animation = AnimationFeatures.getAnimations(appContext)[0];
  animation.frames = preset.build(base);
  clampFramesToGround(appContext, animation.frames);
  animation.name = preset.label;

  SceneIO.autoSaveScene(appContext);
  document.dispatchEvent(new CustomEvent('animations-changed'));
  appContext.log(`自動ポーズ「${preset.label}」を${animation.frames.length}コマ生成しました。`);
  return true;
}
