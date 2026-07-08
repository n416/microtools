import * as THREE from 'three';
import * as AnimationFeatures from './AnimationFeatures.js';

// pixelpoc.html で検証済みのレンダリング設定をそのまま踏襲する。
// (INTEGRATION_PLAN.md 「PoCで得た技術的knob」参照)
const RENDER_SIZE = 512;
const BG_COLOR = 0xff00ff; // フラッドフィル背景除去の基準色 (pixelchar側の責務。ここでは背景色を敷くだけ)
const ANGLES = [0, Math.PI / 2, Math.PI, Math.PI * 1.5]; // 0°, 90°, 180°, 270°
const CAMERA_DIST = 10;

/**
 * ライブの appContext.mechaGroup の子メッシュをクローンして、書き出し専用の Group を作る。
 * シーンJSONからの再構築ではなくライブメッシュのクローンなので、CSG結果やOBJ由来のパーツも
 * そのまま書き出せる。
 *
 * 注意点:
 * - userData.isNonSelectable の子は除外する (SceneIo.js / InputHandler.js と同じ扱い)
 * - mesh.clone(false) はジオメトリ/マテリアルを参照共有し、子(発光用SpotLight等)は複製しない。
 *   ジオメトリは共有のため、このモジュールではdisposeしない。
 * - マテリアルは新規に MeshStandardMaterial を作る。color/emissive/emissiveIntensityは元から
 *   引き継ぎ、metalnessは pixelpoc.html と同じく Math.min(元値, 0.4) にクランプする。
 *
 * @returns {{group: THREE.Group, uuidMap: Map<string, THREE.Mesh>, materials: THREE.Material[], skipped: number}}
 */
function buildExportClones(appContext) {
  const group = new THREE.Group();
  const uuidMap = new Map(); // 元メッシュのuuid -> クローン (ポーズ適用に使う)
  const materials = [];
  let skipped = 0;

  appContext.mechaGroup.children.forEach((mesh) => {
    if (mesh.userData && mesh.userData.isNonSelectable) {
      skipped++;
      return;
    }
    if (!mesh.isMesh || !mesh.geometry) {
      skipped++;
      return;
    }

    const clone = mesh.clone(false); // recursive=false: 発光用SpotLight等の子は複製しない
    const srcMat = mesh.material;

    const newMat = new THREE.MeshStandardMaterial({
      color: srcMat && srcMat.color ? srcMat.color.clone() : 0xffffff,
      emissive: srcMat && srcMat.emissive ? srcMat.emissive.clone() : 0x000000,
      emissiveIntensity: srcMat ? (srcMat.emissiveIntensity ?? 1) : 1,
      // metalness=1 は環境マップ無しだと黒く潰れてパレットが死ぬため抑える (pixelpoc.html踏襲)
      metalness: Math.min(srcMat ? (srcMat.metalness ?? 0.5) : 0.5, 0.4),
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    clone.material = newMat;
    materials.push(newMat);

    uuidMap.set(mesh.uuid, clone);
    group.add(clone);
  });

  return { group, uuidMap, materials, skipped };
}

/**
 * ポーズスナップショット (createPoseSnapshot / animation.frames の要素) をクローン群に適用する。
 * jointGroup 由来のエントリは uuidMap に存在しないため自然に無視される
 * (パーツのtransformは絶対座標なので、ジョイントのワイヤーフレームを反映しなくても見た目に影響しない)。
 */
function applyPoseToClones(pose, uuidMap) {
  if (!pose) return;
  pose.forEach((entry) => {
    const clone = uuidMap.get(entry.uuid);
    if (!clone) return; // ジョイントエントリ、または既に削除されたパーツはスキップ
    clone.position.fromArray(entry.position);
    clone.quaternion.fromArray(entry.quaternion);
  });
}

/**
 * 書き出し対象のフレーム(ポーズ)配列を決める。
 * animations[0].frames が空なら、現在のポーズを1コマとして書き出す。
 */
function resolveFrames(appContext) {
  const animation = AnimationFeatures.getAnimations(appContext)[0];
  if (Array.isArray(animation.frames) && animation.frames.length > 0) {
    return { frames: animation.frames, animationName: animation.name };
  }
  return { frames: [AnimationFeatures.createPoseSnapshot(appContext)], animationName: animation.name };
}

/**
 * 全コマ×4方向のスプライトシートを1枚のcanvasとしてレンダリングする。
 * ライブシーン(appContext.mechaGroup / カメラ / レンダラー)の状態は一切変更しない。
 *
 * @returns {Promise<{canvas: HTMLCanvasElement, cols: number, rows: number, animationName: string}|null>}
 */
export async function renderSpriteSheet(appContext) {
  const { group, uuidMap, materials, skipped } = buildExportClones(appContext);

  if (group.children.length === 0) {
    appContext.log('スプライト書き出し: 書き出し対象のパーツがありません。');
    return null;
  }

  const { frames, animationName } = resolveFrames(appContext);
  appContext.log(`スプライト書き出し開始: ${frames.length}コマ × 4方向 (対象外${skipped}件をスキップ)`);

  // 書き出し専用のオフスクリーンシーン (pixelpoc.htmlのライティング設定を踏襲)
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_COLOR);
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(3, 10, 8); // ライトは固定、モデル(pivot)側を回す
  scene.add(keyLight);

  const pivot = new THREE.Group();
  scene.add(pivot);
  pivot.add(group);

  // 1) 各コマの非回転バウンディングボックスの和から、原点センタリングのオフセットを一度だけ決める。
  //    コマごとに再センタリングするとアニメがガタつくため、ここで固定する。
  const centerUnion = new THREE.Box3();
  frames.forEach((pose) => {
    applyPoseToClones(pose, uuidMap);
    group.updateMatrixWorld(true);
    centerUnion.union(new THREE.Box3().setFromObject(group));
  });
  const modelCenter = centerUnion.isEmpty() ? new THREE.Vector3() : centerUnion.getCenter(new THREE.Vector3());
  group.position.set(-modelCenter.x, -modelCenter.y, -modelCenter.z);

  // 2) 全コマ×4方向のバウンディングボックスの和から、オルソカメラの画角を一度だけ決める。
  const frameUnion = new THREE.Box3();
  frames.forEach((pose) => {
    applyPoseToClones(pose, uuidMap);
    ANGLES.forEach((angle) => {
      pivot.rotation.y = angle;
      pivot.updateMatrixWorld(true);
      frameUnion.union(new THREE.Box3().setFromObject(pivot));
    });
  });
  pivot.rotation.y = 0;

  const boxCenter = frameUnion.getCenter(new THREE.Vector3());
  const boxSize = frameUnion.getSize(new THREE.Vector3());
  const half = Math.max(boxSize.x, boxSize.y, boxSize.z, 0.001) * 0.55;

  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 100);
  camera.position.set(boxCenter.x, boxCenter.y, boxCenter.z + CAMERA_DIST);
  camera.lookAt(boxCenter);

  // 3) 書き出し専用のWebGLRendererを都度生成する (ライブレンダラーには触らない)
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(RENDER_SIZE, RENDER_SIZE);

  const cols = frames.length;
  const rows = ANGLES.length;
  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = RENDER_SIZE * cols;
  sheetCanvas.height = RENDER_SIZE * rows;
  const ctx = sheetCanvas.getContext('2d');

  frames.forEach((pose, frameIndex) => {
    applyPoseToClones(pose, uuidMap);
    ANGLES.forEach((angle, angleIndex) => {
      pivot.rotation.y = angle;
      pivot.updateMatrixWorld(true);
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, frameIndex * RENDER_SIZE, angleIndex * RENDER_SIZE);
    });
  });

  // 後始末: 専用レンダラーと新規作成したマテリアルのみdisposeする。
  // クローンのジオメトリはライブメッシュと共有しているためdisposeしない。
  // dispose()だけではWebGLコンテキストが即時解放されず、書き出しを繰り返すと
  // ブラウザのコンテキスト上限に達するため、明示的にコンテキストを破棄する。
  renderer.dispose();
  renderer.forceContextLoss();
  materials.forEach((m) => m.dispose());

  appContext.log(`スプライト書き出し完了: ${cols}コマ × 4方向 (${sheetCanvas.width}x${sheetCanvas.height}px)`);

  return { canvas: sheetCanvas, cols, rows, animationName };
}

function sanitizeFileNamePart(name) {
  return (name || 'animation').replace(/[\\/:*?"<>|]/g, '_').trim() || 'animation';
}

/**
 * スプライトシートをレンダリングし、既存の保存ボタンと同じ流儀 (Blob + a.click()) でPNGとしてダウンロードする。
 */
export async function exportAndDownloadSpriteSheet(appContext) {
  const result = await renderSpriteSheet(appContext);
  if (!result) return;

  const { canvas, cols, rows, animationName } = result;

  await new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        appContext.log('スプライト書き出し失敗: PNGの生成に失敗しました。');
        resolve();
        return;
      }
      const safeName = sanitizeFileNamePart(animationName);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `sprite_${safeName}_${cols}x${rows}_${RENDER_SIZE}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      resolve();
    }, 'image/png');
  });
}
