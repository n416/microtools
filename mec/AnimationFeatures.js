import * as THREE from 'three';
import { JointTransformCommand } from './CommandEdit.js';
import * as SceneIO from './SceneIo.js';

const DEFAULT_ANIMATION_NAME = 'アニメーション1';

/**
 * app.animations が未初期化(または空)の場合、デフォルトの1本構成で初期化する。
 * 旧形式（animationsフィールドが無い保存データ）を読み込んだ場合にもここを通る。
 * @param {*} app MechaCreatorApp インスタンス
 * @returns {Array<{name: string, frames: Array}>}
 */
export function ensureAnimations(app) {
  if (!Array.isArray(app.animations) || app.animations.length === 0) {
    app.animations = [{ name: DEFAULT_ANIMATION_NAME, frames: [] }];
  }
  return app.animations;
}

function getMovableChildren(appContext) {
  return [...appContext.mechaGroup.children, ...appContext.jointGroup.children];
}

function getCurrentAnimation(appContext) {
  const animations = ensureAnimations(appContext.app);
  return animations[0];
}

/**
 * 現在のシーン状態から、JSONシリアライズ可能なプレーンなポーズスナップショットを作る。
 * IkFeatures.js の initialStates と同じ対象（mechaGroup + jointGroup の全子）を、
 * position/quaternion を配列化して保持する。
 */
export function createPoseSnapshot(appContext) {
  return getMovableChildren(appContext).map((obj) => ({
    uuid: obj.uuid,
    position: obj.position.toArray(),
    quaternion: obj.quaternion.toArray(),
  }));
}

/**
 * 現在のポーズを、現在のアニメーションの新しいコマ(フレーム)として追加する。
 */
export function addFrame(appContext) {
  const animation = getCurrentAnimation(appContext);
  const pose = createPoseSnapshot(appContext);
  animation.frames.push(pose);

  SceneIO.autoSaveScene(appContext);
  document.dispatchEvent(new CustomEvent('animations-changed'));
  appContext.log(`コマ${animation.frames.length}を追加しました。`);

  return animation.frames.length - 1;
}

/**
 * 指定インデックスのコマを、現在のアニメーションから削除する。
 */
export function deleteFrame(appContext, frameIndex) {
  const animation = getCurrentAnimation(appContext);
  if (frameIndex < 0 || frameIndex >= animation.frames.length) return;

  animation.frames.splice(frameIndex, 1);

  SceneIO.autoSaveScene(appContext);
  document.dispatchEvent(new CustomEvent('animations-changed'));
  appContext.log(`コマ${frameIndex + 1}を削除しました。`);
}

/**
 * 現在のアニメーションの名前を変更する。
 */
export function renameCurrentAnimation(appContext, newName) {
  const animation = getCurrentAnimation(appContext);
  const trimmed = (newName || '').trim();
  animation.name = trimmed || DEFAULT_ANIMATION_NAME;

  SceneIO.autoSaveScene(appContext);
  document.dispatchEvent(new CustomEvent('animations-changed'));
}

/**
 * 指定コマのポーズをシーンへ復元する。
 * JointTransformCommand を使い history.execute() 経由で適用するため、undo/redo が効く。
 * シーン編集で対象パーツが既に存在しない(uuidが見つからない)場合はそのエントリだけスキップし、
 * 処理全体はクラッシュせず継続する。
 */
export function restoreFrame(appContext, frameIndex) {
  const animation = getCurrentAnimation(appContext);
  const pose = animation.frames[frameIndex];
  if (!pose) return;

  const { mechaGroup, jointGroup, history } = appContext;
  const findObject = (uuid) => mechaGroup.getObjectByProperty('uuid', uuid) || jointGroup.getObjectByProperty('uuid', uuid);

  const initialStates = [];
  const finalStates = [];

  pose.forEach((entry) => {
    const obj = findObject(entry.uuid);
    if (!obj) return; // シーン編集で消えたパーツはスキップして続行する

    initialStates.push({
      object: obj,
      position: obj.position.clone(),
      quaternion: obj.quaternion.clone(),
    });
    finalStates.push({
      object: obj,
      position: new THREE.Vector3().fromArray(entry.position),
      quaternion: new THREE.Quaternion().fromArray(entry.quaternion),
    });
  });

  if (initialStates.length === 0) {
    appContext.log('復元対象のパーツが見つかりませんでした。');
    return;
  }

  const hasChanged = initialStates.some((initial, index) => {
    const final = finalStates[index];
    return !initial.position.equals(final.position) || !initial.quaternion.equals(final.quaternion);
  });

  if (!hasChanged) {
    appContext.log(`コマ${frameIndex + 1}を復元しました（変化なし）。`);
    return;
  }

  const command = new JointTransformCommand(initialStates, finalStates);
  command.message = `コマ${frameIndex + 1}のポーズを復元`;
  history.execute(command); // execute() 内で autoSaveScene も呼ばれる
}

/**
 * app が保持しているアニメーション配列を取得する（未初期化ならデフォルトを作って返す）。
 */
export function getAnimations(appContext) {
  return ensureAnimations(appContext.app);
}
