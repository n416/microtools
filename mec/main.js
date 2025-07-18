import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';

// =================================================================
// ◆ 1. 基本設定とシーンの準備
// =================================================================
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({antialias: true});
document.body.appendChild(renderer.domElement);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);
const mechaGroup = new THREE.Group();
scene.add(mechaGroup);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
scene.add(gridHelper);
/*
const axisColors = {x: 0xff0000, y: 0x00ff00, z: 0x0000ff};
['x', 'y', 'z'].forEach((axis) => {
  const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const material = new THREE.MeshBasicMaterial({color: axisColors[axis]});
  const cube = new THREE.Mesh(geometry, material);
  cube.position[axis] = 5;
  scene.add(cube);
});
*/
const logDisplay = document.getElementById('log-display');
let logMessages = [];
let selectedObjectHolder = null; // 選択中オブジェクトを保持する変数

// ▼▼▼【ステップ1】2Dビューのギズモモード管理と色の定義 ▼▼▼
let gizmoMode = 'scale'; // 'scale' または 'rotate'
const scaleGizmoColor = new THREE.Color(0xffff00); // 黄色
const rotateGizmoColor = new THREE.Color(0x00ffff); // シアン

const scaleGizmoGroup = new THREE.Group();
const gizmoHandles = [];

const gizmoLineMaterial = new THREE.LineBasicMaterial({
  color: 0xffff00,
  toneMapped: false,
  depthTest: false,
});
const gizmoHandleMaterial = new THREE.MeshBasicMaterial({
  color: 0xffff00,
  toneMapped: false,
  depthTest: false,
  side: THREE.DoubleSide,
});

const handleSize = 0.5;
const handlePositions = [
  {x: -0.5, y: 0.5, name: 'top-left'},
  {x: 0, y: 0.5, name: 'top-center'},
  {x: 0.5, y: 0.5, name: 'top-right'},
  {x: -0.5, y: 0, name: 'middle-left'},
  {x: 0.5, y: 0, name: 'middle-right'},
  {x: -0.5, y: -0.5, name: 'bottom-left'},
  {x: 0, y: -0.5, name: 'bottom-center'},
  {x: 0.5, y: -0.5, name: 'bottom-right'},
];
const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, 0.5, 0), new THREE.Vector3(0.5, 0.5, 0), new THREE.Vector3(0.5, -0.5, 0), new THREE.Vector3(-0.5, -0.5, 0), new THREE.Vector3(-0.5, 0.5, 0)]);
const gizmoFrame = new THREE.Line(lineGeometry, gizmoLineMaterial);
scaleGizmoGroup.add(gizmoFrame);
handlePositions.forEach((pos) => {
  const handleGeometry = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
  const handle = new THREE.Mesh(handleGeometry, gizmoHandleMaterial.clone());
  handle.position.set(pos.x, pos.y, 0);
  handle.name = pos.name;
  gizmoHandles.push(handle);
  scaleGizmoGroup.add(handle);
});
scene.add(scaleGizmoGroup);

// ▼▼▼【対称コピー機能用】▼▼▼
const symmetryPreviewGroup = new THREE.Group();
scene.add(symmetryPreviewGroup);
let isSymmetryCopyMode = false;
// ▲▲▲【対称コピー機能用】▲▲▲

// =================================================================
// ◆ 2. ログ機能および3面図モード用の設定
// =================================================================
function log(message) {
  const timestamp = new Date().toLocaleTimeString('ja-JP');
  logMessages.unshift(`[${timestamp}] ${message}`);
  if (logMessages.length > 4) logMessages.pop();
  logDisplay.innerHTML = logMessages.join('<br>');
  console.log(message);
}

const viewports = {
  top: {element: document.getElementById('view-top'), camera: new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000), background: new THREE.Color(0x1a1a1a)},
  perspective: {element: document.getElementById('view-perspective'), camera: new THREE.PerspectiveCamera(75, 1, 0.1, 1000), background: new THREE.Color(0x282c34)},
  side: {element: document.getElementById('view-side'), camera: new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000), background: new THREE.Color(0x1a1a1a)},
  front: {element: document.getElementById('view-front'), camera: new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000), background: new THREE.Color(0x1a1a1a)},
};
viewports.perspective.camera.position.set(4, 3, 5);
viewports.perspective.camera.lookAt(0, 0, 0);
viewports.top.camera.position.set(0, 10, 0);
viewports.top.camera.lookAt(0, 0, 0);
viewports.top.camera.up.set(0, 0, -1);
viewports.front.camera.position.set(0, 0, 10);
viewports.front.camera.lookAt(0, 0, 0);
viewports.side.camera.position.set(10, 0, 0);
viewports.side.camera.lookAt(0, 0, 0);
viewports.side.camera.up.set(0, 1, 0);

const orbitControls = new OrbitControls(viewports.perspective.camera, viewports.perspective.element);
orbitControls.enableDamping = true;
const transformControls = new TransformControls(viewports.perspective.camera, renderer.domElement);
scene.add(transformControls);

// ▼▼▼【選択オブジェクト保持用】▼▼▼
transformControls.addEventListener('objectChange', () => {
  selectedObjectHolder = transformControls.object;
});
// ▲▲▲【選択オブジェクト保持用】▲▲▲

const wireframeMaterial = new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true, transparent: true, opacity: 0.7});

// =================================================================
// ◆ 3. オブジェクト操作 / 保存・読込のロジック
// =================================================================
function deleteSelectedObject() {
  const objectToDelete = transformControls.object;
  if (!objectToDelete) return log('削除対象なし');
  log(`${objectToDelete.geometry.type} を削除`);
  transformControls.detach();
  mechaGroup.remove(objectToDelete);
  objectToDelete.geometry.dispose();
  if (objectToDelete.material.dispose) objectToDelete.material.dispose();
  autoSaveScene();
}

function autoSaveScene() {
  const sceneData = {objects: []};
  mechaGroup.children.forEach((mesh) => {
    let geometryType = '';
    if (mesh.geometry instanceof THREE.BoxGeometry) geometryType = 'Box';
    else if (mesh.geometry instanceof THREE.SphereGeometry) geometryType = 'Sphere';
    else if (mesh.geometry instanceof THREE.ConeGeometry) geometryType = 'Cone';
    sceneData.objects.push({
      geometryType,
      position: mesh.position.toArray(),
      rotation: mesh.rotation.toArray().slice(0, 3),
      scale: mesh.scale.toArray(),
      color: mesh.material.color.getHex(),
    });
  });
  localStorage.setItem('mechaCreatorAutoSave', JSON.stringify(sceneData));
  log('自動保存完了');
}

function loadFromData(sceneData) {
  while (mechaGroup.children.length > 0) {
    const mesh = mechaGroup.children[0];
    mechaGroup.remove(mesh);
    mesh.geometry.dispose();
    if (mesh.material.dispose) mesh.material.dispose();
  }
  transformControls.detach();
  sceneData.objects.forEach((data) => {
    let geometry;
    switch (data.geometryType) {
      case 'Box':
        geometry = new THREE.BoxGeometry(1, 1, 1);
        break;
      case 'Sphere':
        geometry = new THREE.SphereGeometry(0.7, 32, 16);
        break;
      case 'Cone':
        geometry = new THREE.ConeGeometry(0.7, 1.5, 32);
        break;
      default:
        return;
    }
    const material = new THREE.MeshStandardMaterial({color: data.color});
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.fromArray(data.position);
    mesh.rotation.fromArray(data.rotation);
    mesh.scale.fromArray(data.scale);
    mechaGroup.add(mesh);
  });
  log('データ読込完了');
}

// ▼▼▼【ステップ2】ギズモの外観をモードに応じて更新する関数 ▼▼▼
function updateGizmoAppearance() {
  const color = gizmoMode === 'rotate' ? rotateGizmoColor : scaleGizmoColor;
  gizmoLineMaterial.color.copy(color);
  gizmoHandles.forEach((handle) => {
    // 中央のハンドルは回転操作に関係ないので、回転モードでは非表示にする
    if (handle.name.includes('center')) {
      handle.visible = gizmoMode === 'scale';
    }
    handle.material.color.copy(color);
  });
}

function updateScaleGizmo(viewportKey) {
  const target = transformControls.object;
  if (!target || viewportKey === 'perspective') {
    scaleGizmoGroup.visible = false;
    return;
  }
  const box = new THREE.Box3().setFromObject(target);
  const size = box.getSize(new THREE.Vector3());
  if (size.x === 0) size.x = 0.001;
  if (size.y === 0) size.y = 0.001;
  if (size.z === 0) size.z = 0.001;
  scaleGizmoGroup.visible = true;
  scaleGizmoGroup.position.copy(target.position);
  scaleGizmoGroup.renderOrder = 999;
  const cam = viewports[viewportKey].camera;
  const dist = target.position.distanceTo(cam.position);
  const frustumSize = 10;
  const handleVisibleSize = Math.max(((frustumSize * handleSize) / dist) * 1.5, 0.15);
  switch (viewportKey) {
    case 'top':
      scaleGizmoGroup.scale.set(size.x, size.z, 1);
      scaleGizmoGroup.rotation.set(-Math.PI / 2, 0, 0);
      scaleGizmoGroup.position.z += 0.01;
      scaleGizmoGroup.children.forEach((child) => {
        if (child.isMesh) child.scale.set(Math.max(1 / size.x, 0.15), Math.max(1 / size.z, 0.15), 1).multiplyScalar(handleVisibleSize);
      });
      break;
    case 'front':
      scaleGizmoGroup.scale.set(size.x, size.y, 1);
      scaleGizmoGroup.rotation.set(0, 0, 0);
      scaleGizmoGroup.position.z += 0.01;
      scaleGizmoGroup.children.forEach((child) => {
        if (child.isMesh) child.scale.set(Math.max(1 / size.x, 0.15), Math.max(1 / size.y, 0.15), 1).multiplyScalar(handleVisibleSize);
      });
      break;
    case 'side':
      scaleGizmoGroup.scale.set(size.z, size.y, 1);
      scaleGizmoGroup.rotation.set(0, Math.PI / 2, 0);
      scaleGizmoGroup.position.x += 0.01;
      scaleGizmoGroup.children.forEach((child) => {
        if (child.isMesh) child.scale.set(Math.max(1 / size.z, 0.15), Math.max(1 / size.y, 0.15), 1).multiplyScalar(handleVisibleSize);
      });
      break;
  }
  scaleGizmoGroup.updateMatrixWorld(true);
}

// ▼▼▼【対称コピー機能用】▼▼▼
function startSymmetryCopyMode() {
  const target = transformControls.object;
  if (!target) {
    log('コピーするオブジェクトが選択されていません。');
    return;
  }
  selectedObjectHolder = target; // ★追加：モード開始時に選択オブジェクトを保持
  isSymmetryCopyMode = true;
  transformControls.detach(); // モード中はギズモを非表示にする
  log('対称コピーモード開始。コピー軸をクリックしてください。');

  // UIの表示切替
  document.getElementById('symmetryCopy').style.display = 'none';
  document.getElementById('cancelSymmetryCopy').style.display = 'inline-block';

  // プレビュー用マテリアル
  const previewMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff00, // 緑色
    transparent: true,
    opacity: 0.5,
    depthTest: false, // 他のオブジェクトに隠れても見えるように
  });

  const axes = ['x', 'y', 'z'];
  axes.forEach((axis) => {
    const preview = new THREE.Mesh(target.geometry, previewMaterial);
    preview.position.copy(target.position);
    preview.rotation.copy(target.rotation);
    preview.scale.copy(target.scale);

    // 軸に対して反転
    preview.position[axis] *= -1;
    preview.scale[axis] *= -1;

    preview.userData.mirrorAxis = axis; // どの軸のプレビューか保存
    symmetryPreviewGroup.add(preview);
  });
}

function performSymmetryCopy(previewObject) {
  const originalObject = selectedObjectHolder;
  if (!originalObject) return;

  const newObject = new THREE.Mesh(originalObject.geometry.clone(), originalObject.material.clone());

  // プレビューオブジェクトの位置やスケールをコピー
  newObject.position.copy(previewObject.position);
  newObject.rotation.copy(previewObject.rotation);
  newObject.scale.copy(previewObject.scale);

  mechaGroup.add(newObject);
  log(`${previewObject.userData.mirrorAxis.toUpperCase()}軸に対称コピーしました。`);
  autoSaveScene();

  cancelSymmetryCopyMode(); // 処理完了後、モードを抜ける
}

function cancelSymmetryCopyMode() {
  if (!isSymmetryCopyMode) return;

  isSymmetryCopyMode = false;
  // プレビューオブジェクトを全て削除
  while (symmetryPreviewGroup.children.length > 0) {
    symmetryPreviewGroup.remove(symmetryPreviewGroup.children[0]);
  }

  // UIを元に戻す
  document.getElementById('symmetryCopy').style.display = 'inline-block';
  document.getElementById('cancelSymmetryCopy').style.display = 'none';

  // 保持していたオブジェクトを再度アタッチ
  if (selectedObjectHolder) {
    transformControls.attach(selectedObjectHolder);
  }

  log('対称コピーモードをキャンセルしました。');
}
// ▲▲▲【対称コピー機能用】▲▲▲

// =================================================================
// ◆ 4. イベントリスナー
// =================================================================
document.getElementById('addCube').addEventListener('click', () => {
  mechaGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff})));
  log('立方体を追加');
  autoSaveScene();
});
document.getElementById('addSphere').addEventListener('click', () => {
  mechaGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 16), new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff})));
  log('球体を追加');
  autoSaveScene();
});
document.getElementById('addCone').addEventListener('click', () => {
  mechaGroup.add(new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.5, 32), new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff})));
  log('円錐を追加');
  autoSaveScene();
});
document.getElementById('save').addEventListener('click', () => {
  const dataString = localStorage.getItem('mechaCreatorAutoSave');
  if (!dataString) return log('保存データなし');
  const blob = new Blob([dataString], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mecha-data.json';
  a.click();
  URL.revokeObjectURL(a.href);
  log('データ保存');
});
const fileInput = document.getElementById('fileInput');
document.getElementById('load').addEventListener('click', () => {
  log('ファイル選択ダイアログ表示');
  fileInput.click();
});
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (re) => {
    try {
      loadFromData(JSON.parse(re.target.result));
      autoSaveScene();
    } catch (err) {
      log('ファイル読込失敗');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});
document.getElementById('deleteObject').addEventListener('click', deleteSelectedObject);

// ▼▼▼【対称コピー機能用】▼▼▼
document.getElementById('symmetryCopy').addEventListener('click', startSymmetryCopyMode);
document.getElementById('cancelSymmetryCopy').addEventListener('click', cancelSymmetryCopyMode);
// ▲▲▲【対称コピー機能用】▲▲▲

let pointerDownPosition = new THREE.Vector2();
let isDraggingIn2DView = false;
let isScalingIn2DView = false;
let isRotatingIn2DView = false; // 回転操作中フラグを追加
let dragStartPointer = new THREE.Vector2();
let dragStartObjectState = {
  position: new THREE.Vector3(),
  scale: new THREE.Vector3(),
  rotation: new THREE.Euler(), // 回転状態も保存
};
let draggedInfo = {viewportKey: null, handleName: null};

// ▼▼▼【ステップ4】`pointerdown`イベントを修正 ▼▼▼
window.addEventListener('pointerdown', (event) => {
  if (event.target.closest('#ui') || transformControls.dragging) return;
  pointerDownPosition.set(event.clientX, event.clientY);
  let clickedViewportKey = null;
  let clickedRect = null;
  for (const key in viewports) {
    const view = viewports[key];
    const rect = view.element.getBoundingClientRect();
    if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
      clickedViewportKey = key;
      clickedRect = rect;
      break;
    }
  }
  if (!clickedViewportKey || clickedViewportKey === 'perspective' || !transformControls.object) return;

  const clickedViewport = viewports[clickedViewportKey];
  pointer.x = ((event.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
  pointer.y = -((event.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;

  updateScaleGizmo(clickedViewportKey);
  scaleGizmoGroup.updateMatrixWorld(true);

  raycaster.setFromCamera(pointer, clickedViewport.camera);
  raycaster.near = 0;
  raycaster.far = 1000;

  mechaGroup.visible = false;
  const handleIntersects = raycaster.intersectObjects(gizmoHandles, true);
  mechaGroup.visible = true;

  updateGizmoAppearance(); // ハンドル色を現在のモードに合わせる

  let handleLabel = document.getElementById('handle-label');
  if (handleLabel) handleLabel.remove();

  if (handleIntersects.length > 0) {
    const hitHandle = handleIntersects[0].object;
    hitHandle.material.color.set(0xff0000);

    dragStartPointer.set(event.clientX, event.clientY);
    dragStartObjectState.position.copy(transformControls.object.position);
    dragStartObjectState.scale.copy(transformControls.object.scale);
    dragStartObjectState.rotation.copy(transformControls.object.rotation); // 回転も保存
    orbitControls.enabled = false;

    // 現在のギズモモードに応じて処理を分岐
    if (gizmoMode === 'scale') {
      isScalingIn2DView = true;
      log('拡縮モード開始');
    } else if (gizmoMode === 'rotate') {
      // 回転操作に関係ない中央ハンドルは無視
      if (hitHandle.name.includes('center')) return;
      isRotatingIn2DView = true;
      log('回転モード開始');
    }

    draggedInfo = {
      viewportKey: clickedViewportKey,
      handleName: hitHandle.name,
    };
  } else {
    const objectIntersects = raycaster.intersectObject(transformControls.object, true);
    if (objectIntersects.length > 0) {
      isDraggingIn2DView = true;
      draggedInfo.viewportKey = clickedViewportKey;
      dragStartPointer.set(event.clientX, event.clientY);
      dragStartObjectState.position.copy(transformControls.object.position);
      orbitControls.enabled = false;
      log('移動モード開始');
    }
  }
});

// ▼▼▼【ステップ5】`pointermove`イベントを修正 ▼▼▼
window.addEventListener('pointermove', (event) => {
  // 回転フラグもチェック対象に追加
  if (!isDraggingIn2DView && !isScalingIn2DView && !isRotatingIn2DView) return;
  event.preventDefault();

  const targetObject = transformControls.object;
  const view = viewports[draggedInfo.viewportKey];
  const rect = view.element.getBoundingClientRect();

  if (isDraggingIn2DView || isScalingIn2DView) {
    const aspect = rect.width / rect.height;
    const frustumSize = 10;
    const worldDeltaX = ((event.clientX - dragStartPointer.x) / rect.width) * frustumSize * aspect;
    const worldDeltaY = ((event.clientY - dragStartPointer.y) / rect.height) * frustumSize;

    if (isDraggingIn2DView) {
      const newPosition = dragStartObjectState.position.clone();
      switch (draggedInfo.viewportKey) {
        case 'top':
          newPosition.x += worldDeltaX;
          newPosition.z += worldDeltaY;
          break;
        case 'front':
          newPosition.x += worldDeltaX;
          newPosition.y -= worldDeltaY;
          break;
        case 'side':
          newPosition.z -= worldDeltaX;
          newPosition.y -= worldDeltaY;
          break;
      }
      targetObject.position.copy(newPosition);
    } else if (isScalingIn2DView) {
      const newPosition = dragStartObjectState.position.clone();
      const newScale = dragStartObjectState.scale.clone();
      const handleName = draggedInfo.handleName;
      let u_change = 0,
        v_change = 0;
      let axisU, axisV;
      switch (draggedInfo.viewportKey) {
        case 'top':
          u_change = worldDeltaX;
          v_change = worldDeltaY;
          axisU = 'x';
          axisV = 'z';
          break;
        case 'front':
          u_change = worldDeltaX;
          v_change = -worldDeltaY;
          axisU = 'x';
          axisV = 'y';
          break;
        case 'side':
          u_change = -worldDeltaX;
          v_change = -worldDeltaY;
          axisU = 'z';
          axisV = 'y';
          break;
      }
      const box = new THREE.Box3().setFromObject(targetObject);
      const size = box.getSize(new THREE.Vector3());
      const center = targetObject.position.clone();
      const pivot = center.clone();
      const halfSizeU = size[axisU] / 2;
      const halfSizeV = size[axisV] / 2;
      if (draggedInfo.viewportKey === 'side') {
        if (handleName.includes('left')) pivot[axisU] -= halfSizeU;
        else if (handleName.includes('right')) pivot[axisU] += halfSizeU;
      } else {
        if (handleName.includes('left')) pivot[axisU] += halfSizeU;
        else if (handleName.includes('right')) pivot[axisU] -= halfSizeU;
      }
      if (draggedInfo.viewportKey === 'top') {
        if (handleName.includes('top')) pivot[axisV] += halfSizeV;
        else if (handleName.includes('bottom')) pivot[axisV] -= halfSizeV;
      } else {
        if (handleName.includes('top')) pivot[axisV] -= halfSizeV;
        else if (handleName.includes('bottom')) pivot[axisV] += halfSizeV;
      }
      let u_multiplier = 0;
      if (draggedInfo.viewportKey === 'side') {
        u_multiplier = handleName.includes('left') ? 1 : handleName.includes('right') ? -1 : 0;
      } else {
        u_multiplier = handleName.includes('left') ? -1 : handleName.includes('right') ? 1 : 0;
      }
      let v_multiplier = 0;
      if (draggedInfo.viewportKey === 'top') {
        v_multiplier = handleName.includes('top') ? -1 : handleName.includes('bottom') ? 1 : 0;
      } else {
        v_multiplier = handleName.includes('top') ? 1 : handleName.includes('bottom') ? -1 : 0;
      }
      const scaleChangeU = u_change * u_multiplier;
      const scaleChangeV = v_change * v_multiplier;
      if (u_multiplier !== 0 && dragStartObjectState.scale[axisU] + scaleChangeU > 0.01) {
        newScale[axisU] = dragStartObjectState.scale[axisU] + scaleChangeU;
        newPosition[axisU] = pivot[axisU] + (newScale[axisU] / dragStartObjectState.scale[axisU]) * (dragStartObjectState.position[axisU] - pivot[axisU]);
      }
      if (v_multiplier !== 0 && dragStartObjectState.scale[axisV] + scaleChangeV > 0.01) {
        newScale[axisV] = dragStartObjectState.scale[axisV] + scaleChangeV;
        newPosition[axisV] = pivot[axisV] + (newScale[axisV] / dragStartObjectState.scale[axisV]) * (dragStartObjectState.position[axisV] - pivot[axisV]);
      }
      targetObject.scale.copy(newScale);
      targetObject.position.copy(newPosition);
    }
  } else if (isRotatingIn2DView) {
    // ▼▼▼ ここからが新しい回転処理 ▼▼▼
    const center3D = targetObject.position.clone();
    const centerProjected = center3D.project(view.camera);

    const centerX = (centerProjected.x * 0.5 + 0.5) * rect.width + rect.left;
    const centerY = (-centerProjected.y * 0.5 + 0.5) * rect.height + rect.top;
    const centerOnScreen = new THREE.Vector2(centerX, centerY);

    const startVec = new THREE.Vector2().subVectors(dragStartPointer, centerOnScreen);
    const currentVec = new THREE.Vector2(event.clientX, event.clientY).sub(centerOnScreen);

    const startAngle = Math.atan2(startVec.y, startVec.x);
    const currentAngle = Math.atan2(currentVec.y, currentVec.x);
    const deltaAngle = currentAngle - startAngle;

    const newRotation = dragStartObjectState.rotation.clone();

    // 各ビューに応じて正しい軸に回転を適用
    switch (draggedInfo.viewportKey) {
      case 'top':
        newRotation.y = dragStartObjectState.rotation.y + deltaAngle;
        break;
      case 'front':
        newRotation.z = dragStartObjectState.rotation.z + deltaAngle;
        break;
      case 'side':
        newRotation.x = dragStartObjectState.rotation.x + deltaAngle;
        break;
    }
    targetObject.rotation.copy(newRotation);
    // ▲▲▲ ここまでが新しい回転処理 ▲▲▲
  }
});

// ▼▼▼【ステップ6】`pointerup`イベントを修正 ▼▼▼
window.addEventListener('pointerup', (event) => {
  // ▼▼▼【対称コピー機能用】モード中の処理を最優先する ▼▼▼
  if (isSymmetryCopyMode) {
    let clickedViewportKey = null;
    let clickedRect = null;
    for (const key in viewports) {
      const rect = viewports[key].element.getBoundingClientRect();
      if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
        clickedViewportKey = key;
        clickedRect = rect;
        break;
      }
    }
    if (!clickedViewportKey) return;

    const clickedViewport = viewports[clickedViewportKey];
    pointer.x = ((event.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
    pointer.y = -((event.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, clickedViewport.camera);

    const intersects = raycaster.intersectObjects(symmetryPreviewGroup.children);
    if (intersects.length > 0) {
      // プレビューがクリックされたらコピーを実行
      performSymmetryCopy(intersects[0].object);
    } else {
      // それ以外ならキャンセル
      cancelSymmetryCopyMode();
    }
    return; // 通常のクリック処理は行わない
  }
  // ▲▲▲【対称コピー機能用】▲▲▲

  // 回転フラグもチェック対象に追加
  if (isDraggingIn2DView || isScalingIn2DView || isRotatingIn2DView) {
    if (transformControls.object) {
      autoSaveScene();
      // ログメッセージを現在の操作に応じて変更
      let mode = isScalingIn2DView ? '拡縮' : isRotatingIn2DView ? '回転' : '移動';
      log(`${mode}完了`);
    }
    isDraggingIn2DView = false;
    isScalingIn2DView = false;
    isRotatingIn2DView = false; // 回転フラグをリセット
    orbitControls.enabled = true;

    const handleLabel = document.getElementById('handle-label');
    if (handleLabel) handleLabel.remove();
    // ハンドル色をリセット
    updateGizmoAppearance();
    return;
  }

  const pointerUpPosition = new THREE.Vector2(event.clientX, event.clientY);
  if (pointerDownPosition.distanceTo(pointerUpPosition) > 5) return;
  if (event.target.closest('#ui') || transformControls.dragging) return;

  let clickedViewportKey = null,
    clickedRect = null;
  for (const key in viewports) {
    const rect = viewports[key].element.getBoundingClientRect();
    if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
      clickedViewportKey = key;
      clickedRect = rect;
      break;
    }
  }
  if (!clickedViewportKey) return;

  const clickedViewport = viewports[clickedViewportKey];
  pointer.x = ((event.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
  pointer.y = -((event.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, clickedViewport.camera);
  const intersects = raycaster.intersectObjects(mechaGroup.children, false);
  if (intersects.length > 0) {
    transformControls.attach(intersects[0].object);
    log(`選択中: ${intersects[0].object.geometry.type}`);
  } else {
    transformControls.detach();
    log('待機中');
  }
});

// ▼▼▼【ステップ3】`keydown`イベントを修正 ▼▼▼
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // ▼▼▼【対称コピー機能用】Escapeキーでキャンセル ▼▼▼
  if (isSymmetryCopyMode && e.key === 'Escape') {
    cancelSymmetryCopyMode();
    return;
  }
  // ▲▲▲【対称コピー機能用】▲▲▲

  // 2Dビューのギズモモード切替
  switch (e.key.toLowerCase()) {
    case 't':
      transformControls.setMode('translate');
      log('モード -> 移動 (3Dビュー)');
      break;
    case 'r':
      transformControls.setMode('rotate');
      gizmoMode = 'rotate'; // 2Dギズモモードも回転に
      updateGizmoAppearance();
      log('モード -> 回転 (3D/2Dビュー)');
      break;
    case 's':
      transformControls.setMode('scale');
      gizmoMode = 'scale'; // 2Dギズモモードも拡縮に
      updateGizmoAppearance();
      log('モード -> 拡縮 (3D/2Dビュー)');
      break;
  }

  const selectedObject = transformControls.object;
  if (!selectedObject) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelectedObject();
    return;
  }
  const moveDistance = 0.1,
    rotateAngle = THREE.MathUtils.degToRad(5),
    scaleAmount = 0.05;
  let operationDone = false;
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    switch (e.key) {
      case 'ArrowUp':
        selectedObject.rotation.x -= rotateAngle;
        operationDone = true;
        break;
      case 'ArrowDown':
        selectedObject.rotation.x += rotateAngle;
        operationDone = true;
        break;
      case 'ArrowLeft':
        selectedObject.rotation.y -= rotateAngle;
        operationDone = true;
        break;
      case 'ArrowRight':
        selectedObject.rotation.y += rotateAngle;
        operationDone = true;
        break;
    }
  } else if (e.altKey) {
    e.preventDefault();
    switch (e.key) {
      case 'ArrowUp':
        selectedObject.scale.addScalar(scaleAmount);
        operationDone = true;
        break;
      case 'ArrowDown':
        selectedObject.scale.addScalar(-scaleAmount);
        operationDone = true;
        break;
    }
  } else {
    switch (e.key) {
      case 'ArrowUp':
        e.shiftKey ? (selectedObject.position.y += moveDistance) : (selectedObject.position.z -= moveDistance);
        operationDone = true;
        break;
      case 'ArrowDown':
        e.shiftKey ? (selectedObject.position.y -= moveDistance) : (selectedObject.position.z += moveDistance);
        operationDone = true;
        break;
      case 'ArrowLeft':
        selectedObject.position.x -= moveDistance;
        operationDone = true;
        break;
      case 'ArrowRight':
        selectedObject.position.x += moveDistance;
        operationDone = true;
        break;
    }
  }
  if (operationDone) autoSaveScene();
});

function onWindowResize() {
  for (const key in viewports) {
    const view = viewports[key];
    const rect = view.element.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    if (view.camera.isPerspectiveCamera) {
      view.camera.aspect = aspect;
    } else {
      const frustumSize = 10;
      view.camera.left = (-frustumSize * aspect) / 2;
      view.camera.right = (frustumSize * aspect) / 2;
      view.camera.top = frustumSize / 2;
      view.camera.bottom = -frustumSize / 2;
    }
    view.camera.updateProjectionMatrix();
  }
}
window.addEventListener('resize', onWindowResize);

window.addEventListener('load', () => {
  const data = localStorage.getItem('mechaCreatorAutoSave');
  if (data) {
    try {
      loadFromData(JSON.parse(data));
    } catch (e) {
      console.error('自動保存データの復元に失敗', e);
    }
  }
});

// =================================================================
// ◆ 5. アニメーションループ
// =================================================================
function animate() {
  requestAnimationFrame(animate);
  orbitControls.update();
  for (const key in viewports) {
    const view = viewports[key];
    const rect = view.element.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > renderer.domElement.clientHeight || rect.right < 0 || rect.left > renderer.domElement.clientWidth) continue;
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;
    const left = rect.left;
    const bottom = renderer.domElement.clientHeight - rect.bottom;
    renderer.setViewport(left, bottom, width, height);
    renderer.setScissor(left, bottom, width, height);
    renderer.setScissorTest(true);
    renderer.setClearColor(view.background);
    if (view.camera.isOrthographicCamera) {
      updateScaleGizmo(key);
      scaleGizmoGroup.updateMatrixWorld(true);
      const originalAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clear();
      mechaGroup.visible = false;
      transformControls.visible = false;
      renderer.render(scene, view.camera);
      mechaGroup.visible = true;
      gridHelper.visible = false;
      scene.overrideMaterial = wireframeMaterial;
      renderer.render(scene, view.camera);
      scene.overrideMaterial = null;
      gridHelper.visible = true;
      if (transformControls.object) {
        // transformControls.visible = true;
        // renderer.render(transformControls, view.camera);
        renderer.render(scaleGizmoGroup, view.camera);
      }
      renderer.autoClear = originalAutoClear;
    } else {
      scaleGizmoGroup.visible = false;
      // 3Dギズモは、オブジェクトが選択されている場合にのみ表示する
      transformControls.visible = !!transformControls.object && !isSymmetryCopyMode; // 対称コピー中は非表示
      renderer.render(scene, view.camera);
    }
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// =================================================================
// ◆ 6. 初期化
// =================================================================
onWindowResize();
animate();
updateGizmoAppearance(); // 初期状態で色を正しく設定
log('初期化完了');
