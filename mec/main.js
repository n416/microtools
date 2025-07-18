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
let selectedObjectHolder = null;

let gizmoMode = 'scale';
const scaleGizmoColor = new THREE.Color(0xffff00);
const rotateGizmoColor = new THREE.Color(0x00ffff);
const scaleGizmoGroup = new THREE.Group();
const gizmoHandles = [];
const gizmoLineMaterial = new THREE.LineBasicMaterial({color: 0xffff00, toneMapped: false, depthTest: false});
const gizmoHandleMaterial = new THREE.MeshBasicMaterial({color: 0xffff00, toneMapped: false, depthTest: false, side: THREE.DoubleSide});
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

const previewGroup = new THREE.Group();
scene.add(previewGroup);
let isMirrorCopyMode = false;

let clipboard = null;
let isPasteMode = false;
let lastPasteInfo = {objects: [], offset: new THREE.Vector3()};

let selectedObjects = [];
let multiSelectHelper = new THREE.Object3D();
scene.add(multiSelectHelper);
let selectionBoxes = new THREE.Group();
scene.add(selectionBoxes);
let isMultiSelectMode = false;

class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }
  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
    if (!(command instanceof AddObjectCommand && command.isPaste)) {
      lastPasteInfo = {objects: [], offset: new THREE.Vector3()};
    }
    log(command.message);
    autoSaveScene();
  }
  undo() {
    lastPasteInfo = {objects: [], offset: new THREE.Vector3()};
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
      selectedObjects = [];
      updateSelection();
      log(`Undo: ${command.message}`);
      autoSaveScene();
    } else {
      log('これ以上元に戻せません。');
    }
  }
  redo() {
    lastPasteInfo = {objects: [], offset: new THREE.Vector3()};
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);
      const newSelection = [];
      if (command instanceof MacroCommand) {
        command.commands.forEach((cmd) => {
          if (cmd.object) newSelection.push(cmd.object);
        });
      } else if (command.object) {
        newSelection.push(command.object);
      }
      selectedObjects = newSelection;
      if (command instanceof DeleteObjectCommand || (command instanceof MacroCommand && command.commands[0] instanceof DeleteObjectCommand)) {
        selectedObjects = [];
      }
      updateSelection();
      log(`Redo: ${command.message}`);
      autoSaveScene();
    } else {
      log('これ以上やり直せません。');
    }
  }
}
const history = new History();

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

transformControls.addEventListener('objectChange', () => {
  selectedObjectHolder = transformControls.object;
});

const wireframeMaterial = new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true, transparent: true, opacity: 0.7});

// =================================================================
// ◆ 3. オブジェクト操作 / 保存・読込のロジック
// =================================================================
function deleteSelectedObject() {
  if (selectedObjects.length === 0) return log('削除対象なし');
  const commands = selectedObjects.map((obj) => new DeleteObjectCommand(obj));
  history.execute(new MacroCommand(commands, `選択した ${selectedObjects.length} 個のオブジェクトを削除`));
  selectedObjects = [];
  updateSelection();
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
  history.undoStack = [];
  history.redoStack = [];
}

function updateGizmoAppearance() {
  const color = gizmoMode === 'rotate' ? rotateGizmoColor : scaleGizmoColor;
  gizmoLineMaterial.color.copy(color);
  gizmoHandles.forEach((handle) => {
    if (handle.name.includes('center')) {
      handle.visible = gizmoMode === 'scale';
    }
    handle.material.color.copy(color);
  });
}

function updateScaleGizmo(viewportKey) {
  const target = selectedObjects.length === 1 ? selectedObjects[0] : null;
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

function startMirrorCopyMode() {
  if (selectedObjects.length === 0) {
    log('コピーするオブジェクトが選択されていません。');
    return;
  }
  isMirrorCopyMode = true;
  transformControls.detach();
  log('鏡面コピーモード開始。コピー軸をクリックしてください。');
  document.getElementById('mirrorCopy').style.display = 'none';
  document.getElementById('cancelMirrorCopy').style.display = 'inline-block';
  const previewMaterial = new THREE.MeshStandardMaterial({color: 0x00ff00, transparent: true, opacity: 0.5, depthTest: false});
  ['x', 'y', 'z'].forEach((axis) => {
    const axis_preview_group = new THREE.Group();
    axis_preview_group.userData.mirrorAxis = axis;
    selectedObjects.forEach((obj) => {
      const preview = new THREE.Mesh(obj.geometry, previewMaterial);
      preview.position.copy(obj.position);
      preview.scale.copy(obj.scale);
      preview.position[axis] *= -1;
      const reflectedRotation = obj.rotation.clone();
      if (axis === 'x') {
        reflectedRotation.y *= -1;
        reflectedRotation.z *= -1;
      } else if (axis === 'y') {
        reflectedRotation.x *= -1;
        reflectedRotation.z *= -1;
      } else if (axis === 'z') {
        reflectedRotation.x *= -1;
        reflectedRotation.y *= -1;
      }
      preview.rotation.copy(reflectedRotation);
      preview.scale[axis] *= -1;
      axis_preview_group.add(preview);
    });
    previewGroup.add(axis_preview_group);
  });
}

function performMirrorCopy(clickedPreview) {
  const axis = clickedPreview.parent.userData.mirrorAxis;
  const commands = [];
  const newSelection = [];
  clickedPreview.parent.children.forEach((preview, i) => {
    const newObject = new THREE.Mesh(preview.geometry, selectedObjects[i].material.clone());
    newObject.position.copy(preview.position);
    newObject.rotation.copy(preview.rotation);
    newObject.scale.copy(preview.scale);
    commands.push(new AddObjectCommand(newObject));
    newSelection.push(newObject);
  });
  history.execute(new MacroCommand(commands, `${axis.toUpperCase()}軸に鏡面コピー`));
  selectedObjects = newSelection;
  updateSelection();
  cancelMirrorCopyMode();
}

function cancelMirrorCopyMode() {
  if (!isMirrorCopyMode) return;
  isMirrorCopyMode = false;
  while (previewGroup.children.length > 0) {
    const group = previewGroup.children[0];
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    previewGroup.remove(group);
  }
  document.getElementById('mirrorCopy').style.display = 'inline-block';
  document.getElementById('cancelMirrorCopy').style.display = 'none';
  updateSelection();
  log('鏡面コピーモードをキャンセルしました。');
}

function startPastePreview() {
  if (selectedObjects.length === 0) {
    log('貼り付け先のオブジェクトを選択してください。');
    return;
  }
  if (!clipboard || clipboard.length === 0) {
    log('クリップボードが空です。');
    return;
  }
  isPasteMode = true;
  transformControls.detach();
  const targetBox = new THREE.Box3();
  selectedObjects.forEach((obj) => targetBox.expandByObject(obj));
  const targetSize = targetBox.getSize(new THREE.Vector3());
  const sourceBox = new THREE.Box3();
  const sourceGroup = new THREE.Group();
  clipboard.forEach((clip) => {
    const tempMesh = new THREE.Mesh(clip.geometry);
    tempMesh.scale.copy(clip.source.scale);
    tempMesh.position.copy(clip.source.position);
    sourceGroup.add(tempMesh);
  });
  sourceBox.setFromObject(sourceGroup);
  const sourceSize = sourceBox.getSize(new THREE.Vector3());
  const previewMaterial = new THREE.MeshStandardMaterial({color: 0x00ff00, transparent: true, opacity: 0.5, depthTest: false});
  const directions = [
    {axis: 'x', sign: 1},
    {axis: 'x', sign: -1},
    {axis: 'y', sign: 1},
    {axis: 'y', sign: -1},
    {axis: 'z', sign: 1},
    {axis: 'z', sign: -1},
  ];
  directions.forEach((dir) => {
    const offsetValue = targetSize[dir.axis] / 2 + sourceSize[dir.axis] / 2 + 0.2;
    const offset = new THREE.Vector3();
    offset[dir.axis] = offsetValue * dir.sign;
    const axis_preview_group = new THREE.Group();
    axis_preview_group.userData.offset = offset;
    clipboard.forEach((clip) => {
      const previewObject = new THREE.Mesh(clip.geometry, previewMaterial);
      previewObject.scale.copy(clip.source.scale);
      previewObject.rotation.copy(clip.source.rotation);
      previewObject.position.copy(clip.source.position).add(offset);
      axis_preview_group.add(previewObject);
    });
    previewGroup.add(axis_preview_group);
  });
  log('ペースト先のプレビューをクリックして位置を確定してください。');
}

function confirmPaste(clickedPreview) {
  const offset = clickedPreview.parent.userData.offset;
  const commands = [];
  const newPastedObjects = [];
  clipboard.forEach((clip) => {
    const newObject = new THREE.Mesh(clip.geometry, clip.material.clone());
    newObject.scale.copy(clip.source.scale);
    newObject.rotation.copy(clip.source.rotation);
    newObject.position.copy(clip.source.position).add(offset);
    commands.push(new AddObjectCommand(newObject, true));
    newPastedObjects.push(newObject);
  });
  history.execute(new MacroCommand(commands, `${newPastedObjects.length}個のオブジェクトをペースト`));
  lastPasteInfo = {objects: newPastedObjects, offset: offset};
  selectedObjects = newPastedObjects;
  updateSelection();
  cancelPasteMode();
}

function performDirectPaste() {
  const offset = lastPasteInfo.offset;
  const commands = [];
  const newPastedObjects = [];
  lastPasteInfo.objects.forEach((lastObj) => {
    const newObject = new THREE.Mesh(lastObj.geometry, lastObj.material.clone());
    newObject.scale.copy(lastObj.scale);
    newObject.rotation.copy(lastObj.rotation);
    newObject.position.copy(lastObj.position).add(offset);
    commands.push(new AddObjectCommand(newObject, true));
    newPastedObjects.push(newObject);
  });
  history.execute(new MacroCommand(commands, `${newPastedObjects.length}個のオブジェクトをペースト`));
  lastPasteInfo.objects = newPastedObjects;
  selectedObjects = newPastedObjects;
  updateSelection();
}

function cancelPasteMode() {
  isPasteMode = false;
  while (previewGroup.children.length > 0) {
    const group = previewGroup.children[0];
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    previewGroup.remove(group);
  }
  updateSelection();
}

function updateSelection() {
  // 既存の選択ボックスをクリア
  while (selectionBoxes.children.length > 0) {
    selectionBoxes.remove(selectionBoxes.children[0]);
  }
  transformControls.detach();

  if (selectedObjects.length === 1) {
    // 1つだけ選択されている場合
    transformControls.attach(selectedObjects[0]);
    // オブジェクトを囲む黄色の矩形を表示
    const helper = new THREE.BoxHelper(selectedObjects[0], 0xffff00);
    selectionBoxes.add(helper);
  } else if (selectedObjects.length > 1) {
    // 複数選択されている場合
    const box = new THREE.Box3();

    selectedObjects.forEach((obj) => {
      obj.updateWorldMatrix(true, false);
      box.expandByObject(obj);
    });

    if (!box.isEmpty()) {
      // ▼▼▼【ここから修正】Box3Helperの代わりに、ワイヤーフレームのMeshを生成 ▼▼▼
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      const boxGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      const boxMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00, // 緑色
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      });
      const groupHelperBox = new THREE.Mesh(boxGeometry, boxMaterial);
      groupHelperBox.position.copy(center);

      selectionBoxes.add(groupHelperBox);
      // ▲▲▲【ここまで修正】▲▲▲

      multiSelectHelper.position.copy(center);
      transformControls.attach(multiSelectHelper);
    }
  }
}

class Command {
  constructor() {
    this.message = 'コマンド';
  }
  execute() {}
  undo() {}
}
class MacroCommand extends Command {
  constructor(commands, message) {
    super();
    this.commands = commands;
    this.message = message || '複数の操作';
  }
  execute() {
    this.commands.forEach((c) => c.execute());
  }
  undo() {
    this.commands
      .slice()
      .reverse()
      .forEach((c) => c.undo());
  }
}
class AddObjectCommand extends Command {
  constructor(object, isPaste = false) {
    super();
    this.object = object;
    this.isPaste = isPaste;
    this.message = isPaste ? `オブジェクトをペースト` : `${object.geometry.type.replace('Geometry', '')} を追加`;
  }
  execute() {
    mechaGroup.add(this.object);
  }
  undo() {
    mechaGroup.remove(this.object);
  }
}
class DeleteObjectCommand extends Command {
  constructor(object) {
    super();
    this.object = object;
    this.message = `${object.geometry.type.replace('Geometry', '')} を削除`;
  }
  execute() {
    mechaGroup.remove(this.object);
  }
  undo() {
    mechaGroup.add(this.object);
  }
}
class TransformCommand extends Command {
  constructor(object, oldTransform, newTransform) {
    super();
    this.object = object;
    this.oldTransform = oldTransform;
    this.newTransform = newTransform;
    this.message = 'オブジェクトを変形';
  }
  execute() {
    this.object.position.copy(this.newTransform.position);
    this.object.rotation.copy(this.newTransform.rotation);
    this.object.scale.copy(this.newTransform.scale);
  }
  undo() {
    this.object.position.copy(this.oldTransform.position);
    this.object.rotation.copy(this.oldTransform.rotation);
    this.object.scale.copy(this.oldTransform.scale);
  }
}
class MirrorCopyCommand extends Command {
  constructor(newObject, axis) {
    super();
    this.object = newObject;
    this.message = `${axis.toUpperCase()}軸に鏡面コピー`;
  }
  execute() {
    mechaGroup.add(this.object);
  }
  undo() {
    mechaGroup.remove(this.object);
  }
}

// =================================================================
// ◆ 4. イベントリスナー
// =================================================================
document.getElementById('addCube').addEventListener('click', () => {
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff}));
  history.execute(new AddObjectCommand(cube));
});
document.getElementById('addSphere').addEventListener('click', () => {
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 16), new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff}));
  history.execute(new AddObjectCommand(sphere));
});
document.getElementById('addCone').addEventListener('click', () => {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.5, 32), new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff}));
  history.execute(new AddObjectCommand(cone));
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
  fileInput.click();
});
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (re) => {
    try {
      loadFromData(JSON.parse(re.target.result));
    } catch (err) {
      log('ファイル読込失敗');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});
document.getElementById('deleteObject').addEventListener('click', deleteSelectedObject);
document.getElementById('mirrorCopy').addEventListener('click', startMirrorCopyMode);
document.getElementById('cancelMirrorCopy').addEventListener('click', cancelMirrorCopyMode);
const multiSelectButton = document.getElementById('multiSelect');
multiSelectButton.addEventListener('click', () => {
  isMultiSelectMode = !isMultiSelectMode;
  if (isMultiSelectMode) {
    multiSelectButton.style.backgroundColor = '#2ecc71';
    log('複数選択モード開始。SHIFTキーで選択を追加/解除できます。');
  } else {
    multiSelectButton.style.backgroundColor = '#f39c12';
    selectedObjects = [];
    updateSelection();
    log('複数選択モード終了。');
  }
});

let pointerDownPosition = new THREE.Vector2();
let isDraggingIn2DView = false;
let isScalingIn2DView = false;
let isRotatingIn2DView = false;
let dragStartPointer = new THREE.Vector2();
let dragStartObjectState = {position: new THREE.Vector3(), scale: new THREE.Vector3(), rotation: new THREE.Euler()};
let draggedInfo = {viewportKey: null, handleName: null};
let transformStartCache = null;
const worldTransforms = new Map();

transformControls.addEventListener('mouseDown', () => {
  orbitControls.enabled = false;
  if (selectedObjects.length > 1 && transformControls.object === multiSelectHelper) {
    transformStartCache = selectedObjects.map((obj) => ({
      position: obj.position.clone(),
      rotation: obj.rotation.clone(),
      scale: obj.scale.clone(),
    }));
    multiSelectHelper.rotation.set(0, 0, 0);
    multiSelectHelper.scale.set(1, 1, 1);
    selectedObjects.forEach((obj) => {
      worldTransforms.set(obj, {parent: obj.parent});
      multiSelectHelper.attach(obj);
    });
  } else if (selectedObjects.length === 1) {
    transformStartCache = [
      {
        position: selectedObjects[0].position.clone(),
        rotation: selectedObjects[0].rotation.clone(),
        scale: selectedObjects[0].scale.clone(),
      },
    ];
  }
});

transformControls.addEventListener('mouseUp', () => {
  orbitControls.enabled = true;
  if (!transformStartCache) return;
  if (selectedObjects.length > 1 && transformControls.object === multiSelectHelper) {
    const commands = [];
    selectedObjects.forEach((obj, i) => {
      worldTransforms.get(obj).parent.attach(obj);
      const oldT = transformStartCache[i];
      const newT = {position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone()};
      commands.push(new TransformCommand(obj, oldT, newT));
    });
    worldTransforms.clear();
    history.execute(new MacroCommand(commands, `選択した ${selectedObjects.length} 個のオブジェクトを変形`));
    updateSelection();
  } else if (selectedObjects.length === 1) {
    const oldT = transformStartCache[0];
    const obj = selectedObjects[0];
    const newT = {position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone()};
    if (!oldT.position.equals(newT.position) || !oldT.rotation.equals(newT.rotation) || !oldT.scale.equals(newT.scale)) {
      history.execute(new TransformCommand(obj, oldT, newT));
    }
  }
  transformStartCache = null;
});

window.addEventListener('pointerdown', (event) => {
  if (event.target.closest('#ui') || transformControls.dragging) return;
  pointerDownPosition.set(event.clientX, event.clientY);

  // 2Dビューでの直接ドラッグ処理（単一選択時のみ）
  if (selectedObjects.length === 1) {
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
    if (!clickedViewportKey || clickedViewportKey === 'perspective') return;

    const targetObject = selectedObjects[0];
    const clickedViewport = viewports[clickedViewportKey];
    pointer.x = ((event.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
    pointer.y = -((event.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, clickedViewport.camera);
    const objectIntersects = raycaster.intersectObject(targetObject, true);
    if (objectIntersects.length > 0) {
      isDraggingIn2DView = true;
      draggedInfo.viewportKey = clickedViewportKey;
      dragStartPointer.set(event.clientX, event.clientY);
      dragStartObjectState.position.copy(targetObject.position);
      orbitControls.enabled = false;
      transformStartCache = [{position: targetObject.position.clone(), rotation: targetObject.rotation.clone(), scale: targetObject.scale.clone()}];
    }
  }
});

window.addEventListener('pointermove', (event) => {
  if (!isDraggingIn2DView && !isScalingIn2DView && !isRotatingIn2DView) return;
  event.preventDefault();
  const targetObject = selectedObjects[0];
  if (!targetObject) return;
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
      // 2D Gizmo scaling logic (currently not used but kept for completeness)
    }
  } else if (isRotatingIn2DView) {
    // 2D Gizmo rotating logic (currently not used but kept for completeness)
  }
});

window.addEventListener('pointerup', (e) => {
  if (isMirrorCopyMode) {
    let clickedViewportKey = null,
      clickedRect = null;
    for (const key in viewports) {
      const rect = viewports[key].element.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        clickedViewportKey = key;
        clickedRect = rect;
        break;
      }
    }
    if (!clickedViewportKey) return;
    const clickedViewport = viewports[clickedViewportKey];
    pointer.x = ((e.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
    pointer.y = -((e.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, clickedViewport.camera);
    const intersects = raycaster.intersectObjects(previewGroup.children, true);
    if (intersects.length > 0) {
      performMirrorCopy(intersects[0].object);
    } else {
      cancelMirrorCopyMode();
    }
    return;
  }
  if (isPasteMode) {
    let clickedViewportKey = null,
      clickedRect = null;
    for (const key in viewports) {
      const rect = viewports[key].element.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        clickedViewportKey = key;
        clickedRect = rect;
        break;
      }
    }
    if (!clickedViewportKey) return;
    const clickedViewport = viewports[clickedViewportKey];
    pointer.x = ((e.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
    pointer.y = -((e.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, clickedViewport.camera);
    const intersects = raycaster.intersectObjects(previewGroup.children, true);
    if (intersects.length > 0) {
      confirmPaste(intersects[0].object);
    } else {
      cancelPasteMode();
    }
    return;
  }
  if (isDraggingIn2DView || isScalingIn2DView || isRotatingIn2DView) {
    if (selectedObjects.length === 1 && transformStartCache) {
      const oldT = transformStartCache[0];
      const obj = selectedObjects[0];
      const newT = {position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone()};
      history.execute(new TransformCommand(obj, oldT, newT));
    }
    isDraggingIn2DView = isScalingIn2DView = isRotatingIn2DView = false;
    orbitControls.enabled = true;
    updateGizmoAppearance();
    transformStartCache = null;
    return;
  }

  const pointerUpPosition = new THREE.Vector2(e.clientX, e.clientY);
  if (pointerDownPosition.distanceTo(pointerUpPosition) > 5 || e.target.closest('#ui') || transformControls.dragging) return;

  let clickedViewportKey = null,
    clickedRect = null;
  for (const key in viewports) {
    const rect = viewports[key].element.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      clickedViewportKey = key;
      clickedRect = rect;
      break;
    }
  }
  if (!clickedViewportKey) return;

  const clickedViewport = viewports[clickedViewportKey];
  pointer.x = ((e.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
  pointer.y = -((e.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, clickedViewport.camera);

  const intersects = raycaster.intersectObjects(mechaGroup.children, false);
  const clickedObject = intersects.length > 0 ? intersects[0].object : null;

  if (e.shiftKey || isMultiSelectMode) {
    if (clickedObject) {
      const index = selectedObjects.indexOf(clickedObject);
      if (index > -1) {
        selectedObjects.splice(index, 1);
      } else {
        selectedObjects.push(clickedObject);
      }
    }
  } else {
    selectedObjects = clickedObject ? [clickedObject] : [];
    if (isMultiSelectMode) {
      isMultiSelectMode = false;
      multiSelectButton.style.backgroundColor = '#f39c12';
    }
  }
  updateSelection();
  if (selectedObjects.length > 0) {
    log(`${selectedObjects.length}個のオブジェクトを選択中`);
  } else {
    log('待機中');
  }
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'z':
        e.preventDefault();
        e.shiftKey ? history.redo() : history.undo();
        return;
      case 'y':
        e.preventDefault();
        history.redo();
        return;
      case 'c':
        e.preventDefault();
        if (selectedObjects.length > 0) {
          clipboard = selectedObjects.map((obj) => ({
            geometry: obj.geometry,
            material: obj.material,
            source: {scale: obj.scale.clone(), rotation: obj.rotation.clone(), position: obj.position.clone()},
          }));
          log(`${selectedObjects.length}個のオブジェクトをコピーしました。`);
        } else {
          log('コピーするオブジェクトが選択されていません。');
        }
        return;
      case 'v':
        e.preventDefault();
        if (!clipboard) {
          log('クリップボードが空です。');
          return;
        }
        const lastSelectedIds = lastPasteInfo.objects.map((o) => o.uuid);
        const currentSelectedIds = selectedObjects.map((o) => o.uuid);
        const isSameSelection = lastSelectedIds.length === currentSelectedIds.length && lastSelectedIds.every((id) => currentSelectedIds.includes(id));
        if (isSameSelection && lastSelectedIds.length > 0) {
          performDirectPaste();
        } else {
          startPastePreview();
        }
        return;
    }
  }
  if (isMirrorCopyMode && e.key === 'Escape') {
    cancelMirrorCopyMode();
    return;
  }
  if (isPasteMode && e.key === 'Escape') {
    cancelPasteMode();
    return;
  }

  switch (e.key.toLowerCase()) {
    case 't':
      transformControls.setMode('translate');
      log('モード -> 移動 (3Dビュー)');
      break;
    case 'r':
      transformControls.setMode('rotate');
      gizmoMode = 'rotate';
      updateGizmoAppearance();
      log('モード -> 回転 (3D/2Dビュー)');
      break;
    case 's':
      transformControls.setMode('scale');
      gizmoMode = 'scale';
      updateGizmoAppearance();
      log('モード -> 拡縮 (3D/2Dビュー)');
      break;
  }

  if (selectedObjects.length === 0) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelectedObject();
    return;
  }

  const moveDistance = 0.1,
    rotateAngle = THREE.MathUtils.degToRad(5),
    scaleAmount = 0.05;
  const commands = [];
  selectedObjects.forEach((obj) => {
    const oldTransform = {position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone()};
    const newTransform = {position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone()};
    let operationDone = false;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      switch (e.key) {
        case 'ArrowUp':
          newTransform.rotation.x -= rotateAngle;
          operationDone = true;
          break;
        case 'ArrowDown':
          newTransform.rotation.x += rotateAngle;
          operationDone = true;
          break;
        case 'ArrowLeft':
          newTransform.rotation.y -= rotateAngle;
          operationDone = true;
          break;
        case 'ArrowRight':
          newTransform.rotation.y += rotateAngle;
          operationDone = true;
          break;
      }
    } else if (e.altKey) {
      e.preventDefault();
      switch (e.key) {
        case 'ArrowUp':
          newTransform.scale.addScalar(scaleAmount);
          operationDone = true;
          break;
        case 'ArrowDown':
          newTransform.scale.addScalar(-scaleAmount);
          operationDone = true;
          break;
      }
    } else {
      switch (e.key) {
        case 'ArrowUp':
          e.shiftKey ? (newTransform.position.y += moveDistance) : (newTransform.position.z -= moveDistance);
          operationDone = true;
          break;
        case 'ArrowDown':
          e.shiftKey ? (newTransform.position.y -= moveDistance) : (newTransform.position.z += moveDistance);
          operationDone = true;
          break;
        case 'ArrowLeft':
          newTransform.position.x -= moveDistance;
          operationDone = true;
          break;
        case 'ArrowRight':
          newTransform.position.x += moveDistance;
          operationDone = true;
          break;
      }
    }
    if (operationDone) {
      commands.push(new TransformCommand(obj, oldTransform, newTransform));
    }
  });

  if (commands.length > 0) {
    history.execute(new MacroCommand(commands, `選択した ${commands.length} 個のオブジェクトを変形`));
  }
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
  log('初期化完了');
});

// =================================================================
// ◆ 5. アニメーションループ
// =================================================================
function animate() {
  requestAnimationFrame(animate);
  orbitControls.update();

  selectionBoxes.children.forEach((box) => {
    if (box.isBoxHelper) {
      box.update();
    }
  });

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

      // ▼▼▼【ここから修正】▼▼▼
      // 1. 背景となるグリッドとライトを描画
      mechaGroup.visible = false;
      selectionBoxes.visible = false;
      transformControls.visible = false;
      scaleGizmoGroup.visible = false;
      renderer.render(scene, view.camera);

      // 2. オブジェクトをワイヤーフレームで描画
      mechaGroup.visible = true;
      gridHelper.visible = false; // グリッドが二重描画されないように隠す
      scene.overrideMaterial = wireframeMaterial;
      // ライトを有効にするため、mechaGroupではなくsceneを描画対象にする
      renderer.render(scene, view.camera);
      scene.overrideMaterial = null;
      gridHelper.visible = true; // グリッドを戻す

      // 3. 選択ハイライト（矩形）を描画
      selectionBoxes.visible = true;
      renderer.render(selectionBoxes, view.camera);

      // 4. 2Dギズモ（黄色いハンドル）を描画
      if (selectedObjects.length === 1) {
        scaleGizmoGroup.visible = true;
        renderer.render(scaleGizmoGroup, view.camera);
      }
      // ▲▲▲【ここまで修正】▲▲▲

      renderer.autoClear = originalAutoClear;
    } else {
      // Perspective View
      scaleGizmoGroup.visible = false;
      mechaGroup.visible = true;
      selectionBoxes.visible = true;
      transformControls.visible = !!transformControls.object && !isMirrorCopyMode && !isPasteMode;
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
updateGizmoAppearance();
