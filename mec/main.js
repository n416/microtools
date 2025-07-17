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
const logDisplay = document.getElementById('log-display');
let logMessages = [];

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
  top: {
    element: document.getElementById('view-top'),
    camera: new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000),
    background: new THREE.Color(0x1a1a1a),
  },
  perspective: {
    element: document.getElementById('view-perspective'),
    camera: new THREE.PerspectiveCamera(75, 1, 0.1, 1000),
    background: new THREE.Color(0x282c34),
  },
  side: {
    element: document.getElementById('view-side'),
    camera: new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000),
    background: new THREE.Color(0x1a1a1a),
  },
  front: {
    element: document.getElementById('view-front'),
    camera: new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000),
    background: new THREE.Color(0x1a1a1a),
  },
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

const orbitControls = new OrbitControls(
  viewports.perspective.camera,
  viewports.perspective.element
);
orbitControls.enableDamping = true;
orbitControls.panSpeed = 0.8;
orbitControls.rotateSpeed = 0.8;

const transformControls = new TransformControls(
  viewports.perspective.camera,
  renderer.domElement
);
scene.add(transformControls);
const wireframeMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true,
  transparent: true,
  opacity: 0.7,
});

// =================================================================
// ◆ 3. オブジェクト操作 / 保存・読込のロジック
// =================================================================
function deleteSelectedObject() {
  const objectToDelete = transformControls.object;
  if (!objectToDelete) {
    log('削除対象なし');
    return;
  }
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
    else if (mesh.geometry instanceof THREE.SphereGeometry)
      geometryType = 'Sphere';
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

// =================================================================
// ◆ 4. イベントリスナー
// =================================================================
document.getElementById('addCube').addEventListener('click', () => {
  mechaGroup.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff})
    )
  );
  log('立方体を追加');
  autoSaveScene();
});
document.getElementById('addSphere').addEventListener('click', () => {
  mechaGroup.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 32, 16),
      new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff})
    )
  );
  log('球体を追加');
  autoSaveScene();
});
document.getElementById('addCone').addEventListener('click', () => {
  mechaGroup.add(
    new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 1.5, 32),
      new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff})
    )
  );
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
document
  .getElementById('deleteObject')
  .addEventListener('click', deleteSelectedObject);

// マウス操作用の変数を定義
let pointerDownPosition = new THREE.Vector2();
let isDraggingIn2DView = false;
let dragStartPointer = new THREE.Vector2();
let dragStartObjectPosition = new THREE.Vector3();
let draggedViewportKey = null;

// マウスボタンを押したときの処理
window.addEventListener('pointerdown', (event) => {
  if (event.target.closest('#ui') || transformControls.dragging) {
    return;
  }
  pointerDownPosition.set(event.clientX, event.clientY);
  let clickedViewportKey = null;
  for (const key in viewports) {
    const view = viewports[key];
    const rect = view.element.getBoundingClientRect();
    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      clickedViewportKey = key;
      break;
    }
  }
  if (!clickedViewportKey) return;
  if (clickedViewportKey !== 'perspective' && transformControls.object) {
    isDraggingIn2DView = true;
    draggedViewportKey = clickedViewportKey;
    dragStartPointer.set(event.clientX, event.clientY);
    dragStartObjectPosition.copy(transformControls.object.position);
    orbitControls.enabled = false;
  }
});

// マウスを移動したときの処理（ドラッグ中）
window.addEventListener('pointermove', (event) => {
  if (!isDraggingIn2DView || !transformControls.object) {
    return;
  }
  event.preventDefault();
  const view = viewports[draggedViewportKey];
  const rect = view.element.getBoundingClientRect();
  const aspect = rect.width / rect.height;
  const frustumSize = 10;
  const frustumHeight = frustumSize;
  const frustumWidth = frustumSize * aspect;
  const deltaX = event.clientX - dragStartPointer.x;
  const deltaY = event.clientY - dragStartPointer.y;
  const worldDeltaX = (deltaX / rect.width) * frustumWidth;
  const worldDeltaY = (deltaY / rect.height) * frustumHeight;
  const targetObject = transformControls.object;
  const newPosition = dragStartObjectPosition.clone();
  switch (draggedViewportKey) {
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
});

// マウスボタンを離したときの処理
window.addEventListener('pointerup', (event) => {
  // ドラッグ操作を終了
  if (isDraggingIn2DView) {
    isDraggingIn2DView = false;
    draggedViewportKey = null;
    orbitControls.enabled = true;
    if (transformControls.object) {
      autoSaveScene();
    }
  }

  // マウスの移動量が一定以下の場合のみ「クリック」と判定する
  const pointerUpPosition = new THREE.Vector2(event.clientX, event.clientY);
  if (pointerDownPosition.distanceTo(pointerUpPosition) > 5) {
    return; // ドラッグ操作だったので、選択処理は行わない
  }

  // UI要素やギズモ操作中は処理しない
  if (event.target.closest('#ui') || transformControls.dragging) return;

  // クリックされたビューポートを特定
  let clickedViewportKey = null;
  let clickedRect = null;
  for (const key in viewports) {
    const view = viewports[key];
    const rect = view.element.getBoundingClientRect();
    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      clickedViewportKey = key;
      clickedRect = rect;
      break;
    }
  }
  if (!clickedViewportKey) return;

  // Raycasterでオブジェクト選択/選択解除
  const clickedViewport = viewports[clickedViewportKey];
  pointer.x = ((event.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
  pointer.y = -((event.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, clickedViewport.camera);
  const intersects = raycaster.intersectObjects(mechaGroup.children, false);
  if (intersects.length > 0) {
    const object = intersects[0].object;
    transformControls.attach(object);
    log(`選択中: ${object.geometry.type}`);
  } else {
    transformControls.detach();
    log('待機中');
  }
});

window.addEventListener('keydown', (e) => {
  log(
    `キー押下: ${e.key}, Shift: ${e.shiftKey}, Ctrl: ${e.ctrlKey}, Alt: ${e.altKey}`
  );
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch (e.key.toLowerCase()) {
    case 't':
      transformControls.setMode('translate');
      log('モード -> 移動');
      break;
    case 'r':
      transformControls.setMode('rotate');
      log('モード -> 回転');
      break;
    case 's':
      transformControls.setMode('scale');
      log('モード -> 拡大縮小');
      break;
  }

  const selectedObject = transformControls.object;
  if (!selectedObject) return;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelectedObject();
    return;
  }

  const moveDistance = 0.1;
  const rotateAngle = THREE.MathUtils.degToRad(5);
  const scaleAmount = 0.05;
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
    if (operationDone) log('Ctrl+矢印 -> 回転');
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
    if (operationDone) log('Alt+矢印 -> 拡大縮小');
  } else {
    switch (e.key) {
      case 'ArrowUp':
        e.shiftKey
          ? (selectedObject.position.y += moveDistance)
          : (selectedObject.position.z -= moveDistance);
        operationDone = true;
        break;
      case 'ArrowDown':
        e.shiftKey
          ? (selectedObject.position.y -= moveDistance)
          : (selectedObject.position.z += moveDistance);
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
    if (operationDone) log('矢印 -> 移動');
  }

  if (operationDone) {
    autoSaveScene();
  }
});

window.addEventListener('resize', () => {
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
});

// ★★★ ここからが変更箇所です ★★★
// ウィンドウリサイズ時の処理を関数にまとめる
function onWindowResize() {
  console.log('？');
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

// リサイズイベントに登録
window.addEventListener('resize', onWindowResize);
// ★★★ ここまでが変更箇所です ★★★

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
  renderer.setSize(window.innerWidth, window.innerHeight);
  for (const key in viewports) {
    const view = viewports[key];
    const rect = view.element.getBoundingClientRect();
    if (
      rect.bottom < 0 ||
      rect.top > renderer.domElement.clientHeight ||
      rect.right < 0 ||
      rect.left > renderer.domElement.clientWidth
    )
      continue;
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;
    const left = rect.left;
    const bottom = renderer.domElement.clientHeight - rect.bottom;
    renderer.setViewport(left, bottom, width, height);
    renderer.setScissor(left, bottom, width, height);
    renderer.setScissorTest(true);
    renderer.setClearColor(view.background);
    if (view.camera.isOrthographicCamera) {
      // 3面図の描画処理

      // 1. まず、オブジェクトを非表示にしてグリッドだけを描画します
      mechaGroup.visible = false;
      renderer.render(scene, view.camera);
      mechaGroup.visible = true;

      // 2. 次に、グリッドを非表示にして、オブジェクトだけをワイヤーフレームで重ねて描画します
      const originalAutoClear = renderer.autoClear;
      renderer.autoClear = false; // 前回の描画を消さずに重ねる設定
      gridHelper.visible = false;
      scene.overrideMaterial = wireframeMaterial;

      renderer.render(scene, view.camera);

      // 3. 全ての設定を元に戻します
      renderer.autoClear = originalAutoClear;
      gridHelper.visible = true;
      scene.overrideMaterial = null;
    } else {
      // Perspectiveビューはこれまで通り通常描画します
      renderer.render(scene, view.camera);
    }
  }
  orbitControls.update();
  requestAnimationFrame(animate);
}

// =================================================================
// ◆ 6. 初期化
// =================================================================
animate();
onWindowResize();
log('初期化完了');
