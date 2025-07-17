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

// ▼▼▼【変更】拡縮ギズモ用の設定（変更なし） ▼▼▼
const scaleGizmoGroup = new THREE.Group();
const gizmoHandles = [];

const gizmoLineMaterial = new THREE.LineBasicMaterial({
  color: 0xffff00,
  toneMapped: false,
  depthTest: false, // 奥のオブジェクトに隠れないようにする
  renderOrder: 999, // 描画順を最優先にする
});
const gizmoHandleMaterial = new THREE.MeshBasicMaterial({
  color: 0xffff00,
  toneMapped: false,
  depthTest: false, // 奥のオブジェクトに隠れないようにする
  renderOrder: 999, // 描画順を最優先にする
  side: THREE.DoubleSide
});
const handleSize = 0.3; // ハンドルの基本サイズを少し調整

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
const lineGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-0.5, 0.5, 0),
  new THREE.Vector3(0.5, 0.5, 0),
  new THREE.Vector3(0.5, -0.5, 0),
  new THREE.Vector3(-0.5, -0.5, 0),
  new THREE.Vector3(-0.5, 0.5, 0),
]);
const gizmoFrame = new THREE.Line(lineGeometry, gizmoLineMaterial);
scaleGizmoGroup.add(gizmoFrame);
handlePositions.forEach((pos) => {
   const handleGeometry = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
  const handle = new THREE.Mesh(handleGeometry, gizmoHandleMaterial);
  handle.position.set(pos.x, pos.y, 0);
  handle.name = pos.name;
  gizmoHandles.push(handle);
  scaleGizmoGroup.add(handle);
});
// ▲▲▲ 拡縮ギズモ用の設定 ▲▲▲

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

// main.js

// ▼▼▼【この関数全体を、以下の最終版に置き換えてください】▼▼▼
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

  const cam = viewports[viewportKey].camera;
  const dist = target.position.distanceTo(cam.position);
  const handleVisibleSize = dist * handleSize / 5;

  // ビューごとに、親のスケールと子のスケールを個別に、専用のロジックで設定する
  switch (viewportKey) {
    case 'top':
      scaleGizmoGroup.scale.set(size.x, size.z, 1);
      scaleGizmoGroup.rotation.set(Math.PI / 2, 0, 0);
      // Topビュー専用のハンドルスケール計算
      scaleGizmoGroup.children.forEach(child => {
        if (child.isMesh) {
          child.scale.set(1 / size.x, 1 / size.z, 1).multiplyScalar(handleVisibleSize);
        }
      });
      break;

    case 'front':
      scaleGizmoGroup.scale.set(size.x, size.y, 1);
      scaleGizmoGroup.rotation.set(0, 0, 0);
      // Frontビュー専用のハンドルスケール計算
      scaleGizmoGroup.children.forEach(child => {
        if (child.isMesh) {
          child.scale.set(1 / size.x, 1 / size.y, 1).multiplyScalar(handleVisibleSize);
        }
      });
      break;

    case 'side':
      scaleGizmoGroup.scale.set(size.z, size.y, 1);
      scaleGizmoGroup.rotation.set(0, Math.PI / 2, 0);
      // Sideビュー専用のハンドルスケール計算
      scaleGizmoGroup.children.forEach(child => {
        if (child.isMesh) {
          child.scale.set(1 / size.z, 1 / size.y, 1).multiplyScalar(handleVisibleSize);
        }
      });
      break;
  }
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

let pointerDownPosition = new THREE.Vector2();
let isDraggingIn2DView = false;
let isScalingIn2DView = false;
let dragStartPointer = new THREE.Vector2();
let dragStartObjectState = {
  position: new THREE.Vector3(),
  scale: new THREE.Vector3(),
};
let draggedInfo = {viewportKey: null, handleName: null};

// ▼▼▼【ここを置き換え】▼▼▼

window.addEventListener('pointerdown', (event) => {
  if (event.target.closest('#ui') || transformControls.dragging) return;
  pointerDownPosition.set(event.clientX, event.clientY);
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
  if (
    !clickedViewportKey ||
    clickedViewportKey === 'perspective' ||
    !transformControls.object
  )
    return;

  const clickedViewport = viewports[clickedViewportKey];
  pointer.x = ((event.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
  pointer.y = -((event.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, clickedViewport.camera);

  // 【修正】レイキャストの衝突を避けるため、オブジェクトを一時的に非表示にする
  mechaGroup.visible = false;
  scaleGizmoGroup.updateMatrixWorld(true);

  const handleIntersects = raycaster.intersectObjects(gizmoHandles);
  mechaGroup.visible = true; // すぐに表示を戻す

  if (handleIntersects.length > 0) {
    isScalingIn2DView = true;
    draggedInfo = {
      viewportKey: clickedViewportKey,
      handleName: handleIntersects[0].object.name,
    };
    dragStartPointer.set(event.clientX, event.clientY);
    dragStartObjectState.position.copy(transformControls.object.position);
    dragStartObjectState.scale.copy(transformControls.object.scale);
    orbitControls.enabled = false;
    log('拡縮モード開始');
  } else {
    // ハンドルに当たらなかった場合、オブジェクト本体との判定を行う
    // intersectObjectは単一オブジェクトとの判定で、より正確
    const objectIntersects = raycaster.intersectObject(
      transformControls.object
    );
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

// ▼▼▼【この関数全体を、以下の最終版に置き換えてください】▼▼▼
window.addEventListener('pointermove', (event) => {
    if (!isDraggingIn2DView && !isScalingIn2DView) return;
    event.preventDefault();

    const view = viewports[draggedInfo.viewportKey];
    const rect = view.element.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    const frustumSize = 10;
    const worldDeltaX = ((event.clientX - dragStartPointer.x) / rect.width) * frustumSize * aspect;
    const worldDeltaY = ((event.clientY - dragStartPointer.y) / rect.height) * frustumSize;

    const targetObject = transformControls.object;
    
    if (isDraggingIn2DView) {
        const newPosition = dragStartObjectState.position.clone();
        switch (draggedInfo.viewportKey) {
            case 'top':   newPosition.x += worldDeltaX; newPosition.z += worldDeltaY; break;
            case 'front': newPosition.x += worldDeltaX; newPosition.y -= worldDeltaY; break;
            case 'side':  newPosition.z -= worldDeltaX; newPosition.y -= worldDeltaY; break;
        }
        targetObject.position.copy(newPosition);
    } else if (isScalingIn2DView) {
        const newPosition = dragStartObjectState.position.clone();
        const newScale = dragStartObjectState.scale.clone();
        const handleName = draggedInfo.handleName;

        let u_change = 0, v_change = 0;
        let axisU, axisV;

        switch (draggedInfo.viewportKey) {
            case 'top':   u_change = worldDeltaX; v_change = worldDeltaY; axisU = 'x'; axisV = 'z'; break;
            case 'front': u_change = worldDeltaX; v_change = -worldDeltaY; axisU = 'x'; axisV = 'y'; break;
            case 'side':  u_change = -worldDeltaX; v_change = -worldDeltaY; axisU = 'z'; axisV = 'y'; break;
        }

        // 【ここからが新しい拡縮計算ロジック】
        // 右側ハンドルの処理
        if (handleName.includes('right')) {
            if (newScale[axisU] + u_change > 0.01) {
                newScale[axisU] += u_change;
                newPosition[axisU] += u_change / 2;
            }
        }
        // 左側ハンドルの処理
        if (handleName.includes('left')) {
            if (newScale[axisU] - u_change > 0.01) {
                newScale[axisU] -= u_change;
                newPosition[axisU] += u_change / 2;
            }
        }
        // 上側ハンドルの処理
        if (handleName.includes('top')) {
            if (newScale[axisV] + v_change > 0.01) {
                newScale[axisV] += v_change;
                newPosition[axisV] += v_change / 2;
            }
        }
        // 下側ハンドルの処理
        if (handleName.includes('bottom')) {
            if (newScale[axisV] - v_change > 0.01) {
                newScale[axisV] -= v_change;
                newPosition[axisV] += v_change / 2;
            }
        }
        
        targetObject.scale.copy(newScale);
        targetObject.position.copy(newPosition);
    }
});
window.addEventListener('pointerup', (event) => {
  if (isDraggingIn2DView || isScalingIn2DView) {
    if (transformControls.object) {
      autoSaveScene();
      log(isScalingIn2DView ? '拡縮完了' : '移動完了');
    }
    isDraggingIn2DView = false;
    isScalingIn2DView = false;
    orbitControls.enabled = true;
    return;
  }

  const pointerUpPosition = new THREE.Vector2(event.clientX, event.clientY);
  if (pointerDownPosition.distanceTo(pointerUpPosition) > 5) return;
  if (event.target.closest('#ui') || transformControls.dragging) return;

  let clickedViewportKey = null,
    clickedRect = null;
  for (const key in viewports) {
    const rect = viewports[key].element.getBoundingClientRect();
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

window.addEventListener('keydown', (e) => {
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

  // 最初にコントロール類を更新
  orbitControls.update();

  // 各ビューポートを描画
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
      // 3面図の場合、レイヤー分けして描画する
      updateScaleGizmo(key);
      scaleGizmoGroup.updateMatrixWorld(true);
      const originalAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clear();

      // 【1層目】グリッドを描画
      mechaGroup.visible = false;
      transformControls.visible = false;
      renderer.render(scene, view.camera);

      // ▼▼▼【修正箇所】▼▼▼
      // 【2層目】オブジェクトをワイヤーフレームで描画
      mechaGroup.visible = true;
      gridHelper.visible = false;
      scene.overrideMaterial = wireframeMaterial;
      // mechaGroupだけではなく、ライトを含むscene全体を描画する
      renderer.render(scene, view.camera);
      scene.overrideMaterial = null;
      // ▲▲▲【修正箇所】▲▲▲

      // 【3層目】ギズモ類を描画
      gridHelper.visible = true;
      if (transformControls.object) {
        transformControls.visible = true;
        renderer.render(transformControls, view.camera);
        renderer.render(scaleGizmoGroup, view.camera);
      }

      renderer.autoClear = originalAutoClear;
    } else {
      // Perspectiveビューは通常通りすべてを描画
      scaleGizmoGroup.visible = false;
      transformControls.visible = true;
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
log('初期化完了');
