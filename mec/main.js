import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {Brush, Evaluator, ADDITION, INTERSECTION, SUBTRACTION} from 'three-bvh-csg';

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
let isPanning2D = false;
let panStart = {x: 0, y: 0};
let cameraStartPos = new THREE.Vector3();
let panningViewportKey = null;
let isPanModeActive = false;
let isSpacebarDown = false;
// ▼▼▼【掘削モード用の変数を追加】▼▼▼
let isSubtractMode = false;
let subtractTargets = [];
// ▼▼▼【矩形選択用の変数を追加】▼▼▼
const selectionBoxElement = document.getElementById('selection-box');
let isBoxSelecting = false;
const startPoint = new THREE.Vector2();

// ▼▼▼【ハイライト表示用の変数を追加】▼▼▼
const highlightMaterial = new THREE.MeshStandardMaterial({color: 0x00ff00, transparent: true, opacity: 0.7, side: THREE.DoubleSide});
const originalMaterials = new Map();

// ▼▼▼【追加】2Dビューでのグループ変形時に使用する一時的なグループ ▼▼▼
let transformGroup = null;

// ▼▼▼【修正】グループ全体を囲むための、目に見えないメッシュを保持する変数 ▼▼▼
let groupBoundingBoxMesh = null;

/**
 * 【修正】デバッグ関数をエラーが出ないように修正
 */
function debugSelectionHelpers() {
  console.clear();
  console.log('================ DEBUG REPORT ================');

  if (selectedObjects.length < 2) {
    console.log('複数選択されていません。オブジェクトを2つ以上選択してください。');
    console.log('==============================================');
    return;
  }

  console.log(`タイムスタンプ: ${new Date().toLocaleTimeString()}`);
  console.log(`選択中のオブジェクト数: ${selectedObjects.length}`);
  console.log(`selectionBoxes内のヘルパー数: ${selectionBoxes.children.length}`);
  console.log('---');

  selectionBoxes.children.forEach((box, index) => {
    // BoxHelperのobjectプロパティで黄色か緑かを判断
    const isYellowHelper = selectedObjects.includes(box.object);
    const helperType = isYellowHelper ? '黄色 (個別)' : '緑色 (グループ)';

    // ヘルパーのジオメトリからバウンディングボックスを計算してサイズを取得
    const boundingBox = new THREE.Box3();
    if (box.geometry && box.geometry.attributes.position) {
      boundingBox.setFromBufferAttribute(box.geometry.attributes.position);
    }
    const size = boundingBox.getSize(new THREE.Vector3());

    console.log(`%c[ヘルパー ${index + 1}/${selectionBoxes.children.length}] - ${helperType}`, `color: ${isYellowHelper ? '#CCCC00' : '#00FF00'}; font-weight: bold;`);
    console.log(`  - 表示フラグ (visible): ${box.visible}`);
    console.log(`  - マテリアルの色: #${box.material.color.getHexString()}`);
    console.log(`  - ボックスのサイズ: W=${size.x.toFixed(2)}, H=${size.y.toFixed(2)}, D=${size.z.toFixed(2)}`);

    if (size.length() === 0) {
      // size.x,y,zが全て0の場合
      console.warn('  - 警告: このヘルパーはサイズがゼロのため、表示されません。');
    }
    console.log('  - 関連付けられたオブジェクト:', box.object);
    console.log('---');
  });
  console.log('==============================================');
  log('デバッグ情報をコンソールに出力しました。');
}

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
          else if (cmd.commands) {
            cmd.commands.forEach((nestedCmd) => {
              if (nestedCmd.object) newSelection.push(nestedCmd.object);
            });
          }
        });
      } else if (command.object) {
        newSelection.push(command.object);
      }
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

function deleteSelectedObject() {
  if (selectedObjects.length === 0) return log('削除対象なし');
  const commands = selectedObjects.map((obj) => new DeleteObjectCommand(obj));
  history.execute(new MacroCommand(commands, `選択した ${selectedObjects.length} 個のオブジェクトを削除`));
  selectedObjects = [];
  updateSelection();
}

/**
 * 【修正】カスタムジオメトリ（合体後の形状）の保存に対応
 */
function autoSaveScene() {
  const sceneData = {objects: []};
  mechaGroup.children.forEach((mesh) => {
    let geometryType = '';
    let geometryData = null;
    let sides = null;

    if (mesh.geometry instanceof THREE.BoxGeometry) {
      geometryType = 'Box';
    } else if (mesh.geometry instanceof THREE.SphereGeometry) {
      geometryType = 'Sphere';
    } else if (mesh.geometry instanceof THREE.ConeGeometry) {
      geometryType = 'Cone';
    } else if (mesh.geometry instanceof THREE.CylinderGeometry) {
      // 円柱か多角形柱かを判定
      if (mesh.geometry.parameters.radialSegments >= 32) {
        geometryType = 'Cylinder';
      } else {
        geometryType = 'Prism';
        sides = mesh.geometry.parameters.radialSegments;
      }
    } else if (mesh.geometry instanceof THREE.BufferGeometry) {
      geometryType = 'Custom';
      geometryData = mesh.geometry.toJSON();
    }

    if (geometryType) {
      const saveData = {
        geometryType,
        position: mesh.position.toArray(),
        rotation: mesh.rotation.toArray().slice(0, 3),
        scale: mesh.scale.toArray(),
        color: mesh.material.color.getHex(),
      };
      if (geometryData) {
        saveData.geometryData = geometryData;
      }
      if (sides) {
        saveData.sides = sides;
      }
      sceneData.objects.push(saveData);
    }
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

  const loader = new THREE.BufferGeometryLoader();

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
      case 'Cylinder':
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32);
        break;
      case 'Prism':
        geometry = new THREE.CylinderGeometry(0.7, 0.7, 1.5, data.sides || 6);
        break;
      case 'Custom':
        if (data.geometryData) {
          geometry = loader.parse(data.geometryData);
        }
        break;
      default:
        return;
    }

    if (geometry) {
      const material = new THREE.MeshStandardMaterial({
        color: data.color,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.fromArray(data.position);
      mesh.rotation.fromArray(data.rotation);
      mesh.scale.fromArray(data.scale);
      mechaGroup.add(mesh);
    }
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
  if (selectedObjects.length === 0 || viewportKey === 'perspective') {
    scaleGizmoGroup.visible = false;
    return;
  }
  const box = new THREE.Box3();
  selectedObjects.forEach((obj) => {
    box.expandByObject(obj);
  });
  if (box.isEmpty()) {
    scaleGizmoGroup.visible = false;
    return;
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  if (size.x === 0) size.x = 0.001;
  if (size.y === 0) size.y = 0.001;
  if (size.z === 0) size.z = 0.001;
  scaleGizmoGroup.visible = true;
  scaleGizmoGroup.position.copy(center);
  scaleGizmoGroup.renderOrder = 999;
  const cam = viewports[viewportKey].camera;
  const dist = center.distanceTo(cam.position);
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

/**
 * 【修正】オブジェクトの選択状態が変更されたときに呼び出されます。
 * 選択状態に応じて、適切なヘルパー（黄色・緑の矩形）を生成・破棄します。
 */
function updateSelection() {
  // 既存のヘルパーと、グループ用の不可視メッシュを全てクリア
  while (selectionBoxes.children.length > 0) {
    const box = selectionBoxes.children[0];
    selectionBoxes.remove(box);
    box.geometry.dispose();
    box.material.dispose();
  }
  if (groupBoundingBoxMesh) {
    scene.remove(groupBoundingBoxMesh);
    groupBoundingBoxMesh.geometry.dispose();
    groupBoundingBoxMesh.material.dispose();
    groupBoundingBoxMesh = null;
  }
  transformControls.detach();

  // 単体選択の場合（変更なし）
  if (selectedObjects.length === 1) {
    transformControls.attach(selectedObjects[0]);
    const helper = new THREE.BoxHelper(selectedObjects[0], 0xffff00);
    selectionBoxes.add(helper);
  }
  // 複数選択の場合
  else if (selectedObjects.length > 1) {
    // 1. 各オブジェクトに対応する「黄色い」ヘルパーを追加
    selectedObjects.forEach((obj) => {
      selectionBoxes.add(new THREE.BoxHelper(obj, 0xffff00));
    });

    // 2. グループ全体を囲む「緑の」ヘルパーを追加
    const groupBox3 = new THREE.Box3();
    selectedObjects.forEach((obj) => {
      groupBox3.expandByObject(obj);
    });

    if (!groupBox3.isEmpty()) {
      // 2a. グループのバウンディングボックスに合わせた、目に見えないメッシュを作成
      //    ジオメトリは1x1x1で作成し、スケールでサイズを調整するのが効率的
      groupBoundingBoxMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({visible: false, transparent: true}));
      // 2b. メッシュの位置とスケールをボックスに合わせる
      groupBox3.getCenter(groupBoundingBoxMesh.position);
      groupBox3.getSize(groupBoundingBoxMesh.scale);
      scene.add(groupBoundingBoxMesh);

      // 2c. この不可視メッシュを追跡するヘルパー（緑の線）を作成
      const groupHelper = new THREE.BoxHelper(groupBoundingBoxMesh, 0x00ff00);
      selectionBoxes.add(groupHelper);

      // 3. TransformControlsをグループの中心に設定
      multiSelectHelper.position.copy(groupBoundingBoxMesh.position);
      transformControls.attach(multiSelectHelper);
    }
  }
}

/**
 * 【最終版】変形焼き込み・法線再計算・両面描画を適用した合体関数
 */
function performUnion() {
  if (selectedObjects.length < 2) {
    log('合体するにはオブジェクトを2つ以上選択してください。');
    return;
  }

  scene.updateMatrixWorld(true);

  const evaluator = new Evaluator();
  let baseMesh = selectedObjects[0];
  const finalMaterial = baseMesh.material.clone();

  for (let i = 1; i < selectedObjects.length; i++) {
    const geometryA = baseMesh.geometry.toNonIndexed().clone().applyMatrix4(baseMesh.matrixWorld);
    const geometryB = selectedObjects[i].geometry.toNonIndexed().clone().applyMatrix4(selectedObjects[i].matrixWorld);

    const brushA = new Brush(geometryA);
    const brushB = new Brush(geometryB);

    const resultMesh = evaluator.evaluate(brushA, brushB, ADDITION);

    if (!resultMesh.geometry.attributes.position || resultMesh.geometry.attributes.position.count === 0) {
      log('エラー: オブジェクトの合体に失敗しました。');
      return;
    }

    baseMesh = resultMesh;
  }

  const newMesh = baseMesh;
  newMesh.material = finalMaterial;

  // 法線を再計算し、ライティング（光の当たり方）を修正
  newMesh.geometry.computeVertexNormals();

  // ▼▼▼【追加】マテリアルを両面描画に設定し、穴が見えないようにする ▼▼▼
  newMesh.material.side = THREE.DoubleSide;

  const commands = [];
  selectedObjects.forEach((obj) => {
    commands.push(new DeleteObjectCommand(obj));
  });
  commands.push(new AddObjectCommand(newMesh));

  history.execute(new MacroCommand(commands, `${selectedObjects.length}個のオブジェクトを合体`));

  selectedObjects = [newMesh];
  updateSelection();
}
/**
 * 選択された複数のオブジェクトの重なっている部分（交差）を抽出する関数（焼き込み＆両面描画適用）
 */
function performIntersect() {
  if (selectedObjects.length < 2) {
    log('交差するにはオブジェクトを2つ以上選択してください。');
    return;
  }

  scene.updateMatrixWorld(true);

  const evaluator = new Evaluator();
  let baseMesh = selectedObjects[0];
  const finalMaterial = baseMesh.material.clone();

  for (let i = 1; i < selectedObjects.length; i++) {
    // 1. ジオメトリを複製し、ワールド変形情報（反転含む）を直接頂点に「焼き込む」
    const geometryA = baseMesh.geometry.toNonIndexed().clone().applyMatrix4(baseMesh.matrixWorld);
    const geometryB = selectedObjects[i].geometry.toNonIndexed().clone().applyMatrix4(selectedObjects[i].matrixWorld);

    // 2. 変形済みのジオメトリからブラシを作成
    const brushA = new Brush(geometryA);
    const brushB = new Brush(geometryB);

    // 3. 交差演算を実行
    const resultMesh = evaluator.evaluate(brushA, brushB, INTERSECTION);

    if (!resultMesh.geometry.attributes.position || resultMesh.geometry.attributes.position.count === 0) {
      log('エラー: オブジェクトの交差に失敗しました。重なっている部分がありません。');
      return;
    }

    baseMesh = resultMesh;
  }

  const newMesh = baseMesh;
  newMesh.material = finalMaterial;

  // 法線を再計算し、ライティング（光の当たり方）を修正
  newMesh.geometry.computeVertexNormals();

  // ▼▼▼ マテリアルを両面描画に設定し、穴が見えないようにする ▼▼▼
  newMesh.material.side = THREE.DoubleSide;

  const commands = [];
  selectedObjects.forEach((obj) => {
    commands.push(new DeleteObjectCommand(obj));
  });
  commands.push(new AddObjectCommand(newMesh));

  history.execute(new MacroCommand(commands, `${selectedObjects.length}個のオブジェクトを交差`));

  selectedObjects = [newMesh];
  updateSelection();
}

/**
 * 掘削モードを開始する
 */
function startSubtractMode() {
  if (selectedObjects.length < 2) {
    log('掘削するにはオブジェクトを2つ以上選択してください。');
    return;
  }
  isSubtractMode = true;
  subtractTargets = [...selectedObjects]; // 選択中のオブジェクトを候補として保持

  // ▼▼▼【ハイライト処理を追加】▼▼▼
  originalMaterials.clear();
  subtractTargets.forEach((obj) => {
    originalMaterials.set(obj, obj.material); // 元のマテリアルを記憶
    obj.material = highlightMaterial; // ハイライト用マテリアルを適用
  });

  // UIを掘削モードに切り替え
  document.getElementById('subtractObjects').style.display = 'none';
  document.getElementById('cancelSubtract').style.display = 'inline-block';

  // いったん全ての選択を解除し、ユーザーにドリルを選択させる
  selectedObjects = [];
  updateSelection();

  log('掘削モード: 掘削に使うオブジェクト（ドリル）を1つクリックしてください。Escキーでキャンセル。');
}

/**
 * 掘削モードをキャンセルする
 */
function cancelSubtractMode() {
  if (!isSubtractMode) return;
  isSubtractMode = false;
  subtractTargets = [];

  // UIを通常モードに戻す
  document.getElementById('subtractObjects').style.display = 'inline-block';
  document.getElementById('cancelSubtract').style.display = 'none';

  log('掘削モードをキャンセルしました。');
}

/**
 * 【修正】掘削（減算）を実行する
 * @param {THREE.Mesh[]} baseObjects - 掘削されるオブジェクトの配列
 * @param {THREE.Mesh} drillObject - 掘削に使うオブジェクト（ドリル）
 */
function performSubtract(baseObjects, drillObject) {
  // 計算前に、必ず全てのマテリアルを元に戻す
  subtractTargets.forEach((obj) => {
    if (originalMaterials.has(obj)) {
      obj.material = originalMaterials.get(obj);
    }
  });
  originalMaterials.clear();

  scene.updateMatrixWorld(true);
  const evaluator = new Evaluator();

  // 1. 掘削される側のオブジェクト（ベース）を準備する
  let baseMesh = baseObjects[0];
  const finalMaterial = baseMesh.material.clone();

  // ベースオブジェクトが複数ある場合は、先にそれらを一つに合体させる
  if (baseObjects.length > 1) {
    let combinedMesh = baseObjects[0];
    for (let i = 1; i < baseObjects.length; i++) {
      const geomA = combinedMesh.geometry.toNonIndexed().clone().applyMatrix4(combinedMesh.matrixWorld);
      const geomB = baseObjects[i].geometry.toNonIndexed().clone().applyMatrix4(baseObjects[i].matrixWorld);
      const brushA = new Brush(geomA);
      const brushB = new Brush(geomB);
      combinedMesh = evaluator.evaluate(brushA, brushB, ADDITION);
      combinedMesh.updateMatrixWorld(true);
    }
    baseMesh = combinedMesh;
  }

  // 2. ベースとドリルの両方で、「変形情報の焼き込み」を行う
  const finalBaseGeometry = baseMesh.geometry.toNonIndexed().clone().applyMatrix4(baseMesh.matrixWorld);
  const drillGeometry = drillObject.geometry.toNonIndexed().clone().applyMatrix4(drillObject.matrixWorld);

  const baseBrush = new Brush(finalBaseGeometry);
  const drillBrush = new Brush(drillGeometry);

  // 3. 減算（掘削）を実行
  const resultMesh = evaluator.evaluate(baseBrush, drillBrush, SUBTRACTION);

  // 4. 結果を検証
  if (!resultMesh.geometry.attributes.position || resultMesh.geometry.attributes.position.count === 0) {
    log('エラー: 掘削に失敗しました。完全にくり抜かれたか、形状が複雑すぎる可能性があります。');
    cancelSubtractMode();
    return;
  }

  // 5. 最終的なメッシュを整えてコマンドとして実行
  const newMesh = resultMesh;
  newMesh.material = finalMaterial;
  newMesh.geometry.computeVertexNormals();
  newMesh.material.side = THREE.DoubleSide;

  const commands = [];
  subtractTargets.forEach((obj) => {
    commands.push(new DeleteObjectCommand(obj));
  });
  commands.push(new AddObjectCommand(newMesh));

  history.execute(new MacroCommand(commands, 'オブジェクトを掘削'));

  selectedObjects = [newMesh];
  updateSelection();
  cancelSubtractMode(); // モードを終了
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

    // ▼▼▼【修正】ペースト操作以外の場合、生成したオブジェクトを選択状態にする ▼▼▼
    // ブーリアンや鏡面コピーなど、独自の選択ロジックを持つ操作は、
    // この後の処理で選択状態が上書きされるので、このままで問題ありません。
    if (!this.isPaste) {
      selectedObjects = [this.object];
      updateSelection();
    }
  }
  undo() {
    mechaGroup.remove(this.object);
    // Undo後は安全のため選択をクリア
    selectedObjects = [];
    updateSelection();
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

// ... addConeのリスナーの後など ...
document.getElementById('addCylinder').addEventListener('click', () => {
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32), new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff}));
  history.execute(new AddObjectCommand(cylinder));
});
document.getElementById('addPrism').addEventListener('click', () => {
  document.getElementById('prismModal').style.display = 'flex';
});
document.getElementById('cancelPrism').addEventListener('click', () => {
  document.getElementById('prismModal').style.display = 'none';
});
document.getElementById('confirmPrism').addEventListener('click', () => {
  const sidesInput = document.getElementById('sidesInput');
  let sides = parseInt(sidesInput.value, 10);
  if (isNaN(sides) || sides < 3) {
    sides = 3; // 不正な値の場合は三角形にする
  }
  if (sides > 64) {
    sides = 64; // 上限
  }
  sidesInput.value = sides;

  const prism = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.5, sides), new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff}));
  history.execute(new AddObjectCommand(prism));

  document.getElementById('prismModal').style.display = 'none';
});

// ▼▼▼【「合体」ボタンのイベントリスナーを追加】▼▼▼
document.getElementById('unionObjects').addEventListener('click', performUnion);
document.getElementById('intersectObjects').addEventListener('click', performIntersect);

document.getElementById('subtractObjects').addEventListener('click', startSubtractMode);
document.getElementById('cancelSubtract').addEventListener('click', cancelSubtractMode);

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
document.getElementById('debugLog').addEventListener('click', debugSelectionHelpers);

// ▼▼▼【修正】パンモードボタンの処理 ▼▼▼
const panModeButton = document.getElementById('panModeButton');
panModeButton.addEventListener('click', () => {
  isPanModeActive = !isPanModeActive;
  if (isPanModeActive) {
    panModeButton.style.backgroundColor = '#2ecc71'; // 有効時は緑色に
    orbitControls.mouseButtons.LEFT = THREE.MOUSE.PAN; // 左クリックの操作を「パン」に設定
    log('パンモード開始。3Dビューの左ドラッグで視点を移動できます。');
  } else {
    panModeButton.style.backgroundColor = '#3498db'; // 無効時は青色に
    orbitControls.mouseButtons.LEFT = THREE.MOUSE.ROTATE; // 左クリックの操作を「回転」に戻す
    log('パンモード終了。');
  }
});

// ▼▼▼【追加】スペースキーでのパンモード一時切り替え ▼▼▼
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' && !isSpacebarDown) {
    e.preventDefault(); // ページのスクロールを防止
    isSpacebarDown = true;
    orbitControls.mouseButtons.LEFT = THREE.MOUSE.PAN; // 左クリックの操作を「パン」に設定
    // カーソルを「掴む」形状に変更して、ユーザーに状態を伝える
    for (const key in viewports) {
      viewports[key].element.style.cursor = 'grab';
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === ' ') {
    isSpacebarDown = false;
    // パンモードが有効でない場合のみ、左クリックの操作を「回転」に戻す
    if (!isPanModeActive) {
      orbitControls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    }
    // カーソルを元に戻す
    for (const key in viewports) {
      viewports[key].element.style.cursor = 'default';
    }
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
    transformStartCache = selectedObjects.map((obj) => ({position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone()}));
    multiSelectHelper.rotation.set(0, 0, 0);
    multiSelectHelper.scale.set(1, 1, 1);
    selectedObjects.forEach((obj) => {
      worldTransforms.set(obj, {parent: obj.parent});
      multiSelectHelper.attach(obj);
    });
  } else if (selectedObjects.length === 1) {
    transformStartCache = [{position: selectedObjects[0].position.clone(), rotation: selectedObjects[0].rotation.clone(), scale: selectedObjects[0].scale.clone()}];
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
  // UIやドラッグ中の3Dギズモ操作は何もしない
  if (event.target.closest('#ui') || transformControls.dragging) return;

  // 2Dパン操作を開始する共通関数
  const start2DPan = (e) => {
    let clickedViewportKey = null;
    for (const key in viewports) {
      if (key === 'perspective') continue;
      const rect = viewports[key].element.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        clickedViewportKey = key;
        break;
      }
    }

    if (clickedViewportKey) {
      isPanning2D = true;
      panningViewportKey = clickedViewportKey;
      panStart.x = e.clientX;
      panStart.y = e.clientY;
      cameraStartPos.copy(viewports[panningViewportKey].camera.position);
      orbitControls.enabled = false;
      // ドラッグ中はカーソルを「掴んでいる」形状に
      viewports[clickedViewportKey].element.style.cursor = 'grabbing';
    }
  };

  // 右クリックでのパン処理
  if (event.button === 2) {
    start2DPan(event);
    return;
  }

  // 左クリックの処理
  if (event.button === 0) {
    let clickedViewportKey = null;
    for (const key in viewports) {
      const rect = viewports[key].element.getBoundingClientRect();
      if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
        clickedViewportKey = key;
        break;
      }
    }

    // パンモードが有効で、クリックされたのが3Dビューなら、OrbitControlsに処理を委ねて終了
    if ((isPanModeActive || isSpacebarDown) && clickedViewportKey === 'perspective') {
      return;
    }
    // パンモードが有効で、クリックされたのが2Dビューなら、2Dパンを開始して終了
    if ((isPanModeActive || isSpacebarDown) && clickedViewportKey !== 'perspective' && clickedViewportKey !== null) {
      start2DPan(event);
      return;
    }
    // --- 以下は既存の左クリック処理 ---
    startPoint.set(event.clientX, event.clientY);

    // 特殊モード（鏡面コピー、掘削、ペースト）中は、クリック判定をpointerupに任せる
    if (isMirrorCopyMode || isSubtractMode || isPasteMode) {
      return;
    }

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
    if (!clickedViewportKey) return;

    const clickedViewport = viewports[clickedViewportKey];
    pointer.x = ((event.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
    pointer.y = -((event.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, clickedViewport.camera);

    updateScaleGizmo(clickedViewportKey);

    const is2DView = clickedViewportKey !== 'perspective';

    const allObjectIntersects = raycaster.intersectObjects(mechaGroup.children, true);
    const clickedObject = allObjectIntersects.length > 0 ? allObjectIntersects[0].object : null;

    if (is2DView && selectedObjects.length > 0) {
      mechaGroup.visible = false;
      const handleIntersects = raycaster.intersectObjects(gizmoHandles, true);
      mechaGroup.visible = true;

      const setupTransformState = () => {
        orbitControls.enabled = false;
        dragStartPointer.set(event.clientX, event.clientY);
        transformStartCache = selectedObjects.map((obj) => ({position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone()}));
      };

      const setupMultiSelectGroup = () => {
        const groupBounds = new THREE.Box3();
        selectedObjects.forEach((obj) => groupBounds.expandByObject(obj));
        groupBounds.getCenter(dragStartObjectState.position);
        groupBounds.getSize(dragStartObjectState.scale);

        worldTransforms.clear();
        selectedObjects.forEach((obj) => worldTransforms.set(obj, {parent: obj.parent}));

        if (transformGroup) scene.remove(transformGroup);
        transformGroup = new THREE.Group();
        transformGroup.position.copy(dragStartObjectState.position);
        scene.add(transformGroup);
        selectedObjects.forEach((obj) => transformGroup.attach(obj));
      };

      if (handleIntersects.length > 0) {
        setupTransformState();
        if (selectedObjects.length === 1) {
          const target = selectedObjects[0];
          dragStartObjectState.position.copy(target.position);
          dragStartObjectState.scale.copy(target.scale);
          dragStartObjectState.rotation.copy(target.rotation);
        } else {
          setupMultiSelectGroup();
        }
        if (gizmoMode === 'scale') isScalingIn2DView = true;
        else if (gizmoMode === 'rotate') isRotatingIn2DView = true;
        draggedInfo = {viewportKey: clickedViewportKey, handleName: handleIntersects[0].object.name};
        return;
      }

      if (clickedObject && selectedObjects.includes(clickedObject) && !event.shiftKey && !event.ctrlKey) {
        setupTransformState();
        isDraggingIn2DView = true;
        if (selectedObjects.length === 1) {
          dragStartObjectState.position.copy(selectedObjects[0].position);
        } else {
          setupMultiSelectGroup();
        }
        draggedInfo = {viewportKey: clickedViewportKey, handleName: null};
        return;
      }
    }

    let gizmoIntersects = [];
    if (!is2DView && transformControls.object) {
      gizmoIntersects = raycaster.intersectObjects(transformControls.children, true);
    }

    if (!clickedObject && gizmoIntersects.length === 0) {
      isBoxSelecting = true;
      selectionBoxElement.style.display = 'block';
      orbitControls.enabled = false;
    }
  }
});

window.addEventListener('pointermove', (event) => {
  // ▼▼▼【修正】2Dビューのパン操作中の処理を追加 ▼▼▼
  if (isPanning2D) {
    const view = viewports[panningViewportKey];
    const rect = view.element.getBoundingClientRect();
    const frustumSize = 10;

    // マウスの移動量をスクリーン座標からワールド座標の移動量に変換
    const aspect = rect.width / rect.height;
    const deltaX = ((event.clientX - panStart.x) / rect.width) * frustumSize * aspect;
    const deltaY = ((event.clientY - panStart.y) / rect.height) * frustumSize;

    const camera = view.camera;
    // 開始時のカメラ位置を基準に、マウスの移動量だけカメラをずらす
    switch (panningViewportKey) {
      case 'top':
        camera.position.x = cameraStartPos.x - deltaX;
        camera.position.z = cameraStartPos.z - deltaY;
        break;
      case 'front':
        camera.position.x = cameraStartPos.x - deltaX;
        camera.position.y = cameraStartPos.y + deltaY;
        break;
      case 'side':
        camera.position.z = cameraStartPos.z + deltaX;
        camera.position.y = cameraStartPos.y + deltaY;
        break;
    }
    return; // パン操作中は他の処理を行わない
  }

  if (isBoxSelecting) {
    const currentX = event.clientX;
    const currentY = event.clientY;
    const left = Math.min(startPoint.x, currentX);
    const top = Math.min(startPoint.y, currentY);
    const width = Math.abs(startPoint.x - currentX);
    const height = Math.abs(startPoint.y - currentY);

    selectionBoxElement.style.left = `${left}px`;
    selectionBoxElement.style.top = `${top}px`;
    selectionBoxElement.style.width = `${width}px`;
    selectionBoxElement.style.height = `${height}px`;
    return;
  }

  if (!isDraggingIn2DView && !isScalingIn2DView && !isRotatingIn2DView) return;
  event.preventDefault();
  const view = viewports[draggedInfo.viewportKey];
  const rect = view.element.getBoundingClientRect();
  const aspect = rect.width / rect.height;
  const frustumSize = 10;
  const worldDeltaX = ((event.clientX - dragStartPointer.x) / rect.width) * frustumSize * aspect;
  const worldDeltaY = ((event.clientY - dragStartPointer.y) / rect.height) * frustumSize;

  if (selectedObjects.length === 1) {
    const targetObject = selectedObjects[0];
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
        v_change = 0,
        axisU,
        axisV;
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
      const u_multiplier = draggedInfo.viewportKey === 'side' ? (handleName.includes('left') ? 1 : handleName.includes('right') ? -1 : 0) : handleName.includes('left') ? -1 : handleName.includes('right') ? 1 : 0;
      const v_multiplier = draggedInfo.viewportKey === 'top' ? (handleName.includes('top') ? -1 : handleName.includes('bottom') ? 1 : 0) : handleName.includes('top') ? 1 : handleName.includes('bottom') ? -1 : 0;
      const scaleChangeU = u_change * u_multiplier;
      const scaleChangeV = v_change * v_multiplier;
      if (u_multiplier !== 0 && dragStartObjectState.scale[axisU] + scaleChangeU > 0.01) {
        newScale[axisU] = dragStartObjectState.scale[axisU] + scaleChangeU;
        newPosition[axisU] = dragStartObjectState.position[axisU] - (dragStartObjectState.scale[axisU] / 2) * u_multiplier + (newScale[axisU] / 2) * u_multiplier;
      }
      if (v_multiplier !== 0 && dragStartObjectState.scale[axisV] + scaleChangeV > 0.01) {
        newScale[axisV] = dragStartObjectState.scale[axisV] + scaleChangeV;
        newPosition[axisV] = dragStartObjectState.position[axisV] - (dragStartObjectState.scale[axisV] / 2) * v_multiplier + (newScale[axisV] / 2) * v_multiplier;
      }
      targetObject.scale.copy(newScale);
      targetObject.position.copy(newPosition);
    } else if (isRotatingIn2DView) {
      const center3D = targetObject.position.clone();
      const centerProjected = center3D.project(view.camera);
      const centerX = (centerProjected.x * 0.5 + 0.5) * rect.width + rect.left;
      const centerY = (-centerProjected.y * 0.5 + 0.5) * rect.height + rect.top;
      const centerOnScreen = new THREE.Vector2(centerX, centerY);
      const startVec = new THREE.Vector2().subVectors(dragStartPointer, centerOnScreen);
      const currentVec = new THREE.Vector2(event.clientX, event.clientY).sub(centerOnScreen);
      const deltaAngle = Math.atan2(currentVec.y, currentVec.x) - Math.atan2(startVec.y, startVec.x);
      const newRotation = dragStartObjectState.rotation.clone();
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
    }
  } else if (selectedObjects.length > 1) {
    if (isDraggingIn2DView && transformGroup) {
      const worldDelta = new THREE.Vector3();
      switch (draggedInfo.viewportKey) {
        case 'top':
          worldDelta.set(worldDeltaX, 0, worldDeltaY);
          break;
        case 'front':
          worldDelta.set(worldDeltaX, -worldDeltaY, 0);
          break;
        case 'side':
          worldDelta.set(0, -worldDeltaY, -worldDeltaX);
          break;
      }
      transformGroup.position.copy(dragStartObjectState.position).add(worldDelta);
    } else if (isRotatingIn2DView && transformGroup) {
      const center3D = dragStartObjectState.position;
      const centerProjected = center3D.clone().project(view.camera);
      const centerX = (centerProjected.x * 0.5 + 0.5) * rect.width + rect.left;
      const centerY = (-centerProjected.y * 0.5 + 0.5) * rect.height + rect.top;
      const centerOnScreen = new THREE.Vector2(centerX, centerY);
      const startVec = new THREE.Vector2().subVectors(dragStartPointer, centerOnScreen);
      const currentVec = new THREE.Vector2(event.clientX, event.clientY).sub(centerOnScreen);
      const deltaAngle = Math.atan2(currentVec.y, currentVec.x) - Math.atan2(startVec.y, startVec.x);
      const axis = new THREE.Vector3();
      switch (draggedInfo.viewportKey) {
        case 'top':
          axis.set(0, 1, 0);
          break;
        case 'front':
          axis.set(0, 0, 1);
          break;
        case 'side':
          axis.set(1, 0, 0);
          break;
      }
      transformGroup.quaternion.setFromAxisAngle(axis, deltaAngle);
    } else if (isScalingIn2DView && transformGroup) {
      const oldSize = dragStartObjectState.scale;
      const newSize = oldSize.clone();
      const newCenter = dragStartObjectState.position.clone();
      const handleName = draggedInfo.handleName;
      let u_change = 0,
        v_change = 0,
        axisU,
        axisV;

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
      const u_multiplier = draggedInfo.viewportKey === 'side' ? (handleName.includes('left') ? 1 : handleName.includes('right') ? -1 : 0) : handleName.includes('left') ? -1 : handleName.includes('right') ? 1 : 0;
      const v_multiplier = draggedInfo.viewportKey === 'top' ? (handleName.includes('top') ? -1 : handleName.includes('bottom') ? 1 : 0) : handleName.includes('top') ? 1 : handleName.includes('bottom') ? -1 : 0;
      const scaleChangeU = u_change * u_multiplier;
      const scaleChangeV = v_change * v_multiplier;

      if (u_multiplier !== 0 && oldSize[axisU] + scaleChangeU > 0.01) {
        newSize[axisU] = oldSize[axisU] + scaleChangeU;
        newCenter[axisU] = dragStartObjectState.position[axisU] - (oldSize[axisU] / 2) * u_multiplier + (newSize[axisU] / 2) * u_multiplier;
      }
      if (v_multiplier !== 0 && oldSize[axisV] + scaleChangeV > 0.01) {
        newSize[axisV] = oldSize[axisV] + scaleChangeV;
        newCenter[axisV] = dragStartObjectState.position[axisV] - (oldSize[axisV] / 2) * v_multiplier + (newSize[axisV] / 2) * v_multiplier;
      }

      const scaleFactor = new THREE.Vector3(oldSize.x !== 0 ? newSize.x / oldSize.x : 1, oldSize.y !== 0 ? newSize.y / oldSize.y : 1, oldSize.z !== 0 ? newSize.z / oldSize.z : 1);

      transformGroup.position.copy(newCenter);
      transformGroup.scale.copy(scaleFactor);
    }
  }
});

window.addEventListener('pointerup', (e) => {
  if (isPanning2D) {
    // ▼▼▼【修正】カーソルを元に戻す処理を追加 ▼▼▼
    // スペースキーが押されていれば「掴む」に、そうでなければ「デフォルト」に戻す
    const newCursor = isSpacebarDown ? 'grab' : 'default';
    viewports[panningViewportKey].element.style.cursor = newCursor;

    isPanning2D = false;
    panningViewportKey = null;
    orbitControls.enabled = true;
    return;
  }

  if (isBoxSelecting) {
    selectionBoxElement.style.display = 'none';
    isBoxSelecting = false;
    orbitControls.enabled = true;

    const endPoint = new THREE.Vector2(e.clientX, e.clientY);
    if (startPoint.distanceTo(endPoint) < 5) {
      if (!e.ctrlKey && !e.shiftKey && !isMultiSelectMode) {
        selectedObjects = [];
        updateSelection();
        log('待機中');
      }
      return;
    }

    const boxRect = {
      left: Math.min(startPoint.x, endPoint.x),
      right: Math.max(startPoint.x, endPoint.x),
      top: Math.min(startPoint.y, endPoint.y),
      bottom: Math.max(startPoint.y, endPoint.y),
    };

    const objectsInBox = [];
    for (const key in viewports) {
      const view = viewports[key];
      const rect = view.element.getBoundingClientRect();
      if (boxRect.left > rect.right || boxRect.right < rect.left || boxRect.top > rect.bottom || boxRect.bottom < rect.top) {
        continue;
      }
      mechaGroup.children.forEach((mesh) => {
        const pos = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
        pos.project(view.camera);
        const screenX = ((pos.x + 1) / 2) * rect.width + rect.left;
        const screenY = ((-pos.y + 1) / 2) * rect.height + rect.top;
        if (screenX >= boxRect.left && screenX <= boxRect.right && screenY >= boxRect.top && screenY <= boxRect.bottom) {
          if (!objectsInBox.includes(mesh)) {
            objectsInBox.push(mesh);
          }
        }
      });
    }

    if (e.ctrlKey) {
      objectsInBox.forEach((obj) => {
        const index = selectedObjects.indexOf(obj);
        if (index > -1) {
          selectedObjects.splice(index, 1);
        } else {
          selectedObjects.push(obj);
        }
      });
    } else if (e.shiftKey || isMultiSelectMode) {
      objectsInBox.forEach((obj) => {
        if (!selectedObjects.includes(obj)) {
          selectedObjects.push(obj);
        }
      });
    } else {
      selectedObjects = objectsInBox;
    }
    updateSelection();
    log(`${selectedObjects.length}個のオブジェクトを選択中`);
    return;
  }

  if (isDraggingIn2DView || isScalingIn2DView || isRotatingIn2DView) {
    if (transformGroup) {
      selectedObjects.forEach((obj) => {
        worldTransforms.get(obj).parent.attach(obj);
      });
      scene.remove(transformGroup);
      transformGroup = null;
      worldTransforms.clear();
    }
    if (transformStartCache) {
      if (selectedObjects.length === 1) {
        const oldT = transformStartCache[0];
        const obj = selectedObjects[0];
        const newT = {position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone()};
        if (!oldT.position.equals(newT.position) || !oldT.rotation.equals(newT.rotation) || !oldT.scale.equals(newT.scale)) {
          history.execute(new TransformCommand(obj, oldT, newT));
        }
      } else if (selectedObjects.length > 1) {
        const commands = selectedObjects.map((obj, i) => {
          const oldT = transformStartCache[i];
          const newT = {position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone()};
          return new TransformCommand(obj, oldT, newT);
        });
        history.execute(new MacroCommand(commands, `選択した ${selectedObjects.length} 個のオブジェクトをグループ変形`));
      }
    }
    isDraggingIn2DView = isScalingIn2DView = isRotatingIn2DView = false;
    orbitControls.enabled = true;
    updateGizmoAppearance();
    transformStartCache = null;
    updateSelection();
    return;
  }

  if (startPoint.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) < 5) {
    if (isSubtractMode) {
      let clickedViewportKey = null;
      let clickedRect = null;
      for (const key in viewports) {
        const rect = viewports[key].element.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          clickedViewportKey = key;
          clickedRect = rect;
          break;
        }
      }
      if (!clickedViewportKey) {
        cancelSubtractMode();
        return;
      }
      const clickedViewport = viewports[clickedViewportKey];
      pointer.x = ((e.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
      pointer.y = -((e.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, clickedViewport.camera);
      const intersects = raycaster.intersectObjects(mechaGroup.children, true);
      let drillObject = null;
      if (intersects.length > 0) {
        if (subtractTargets.includes(intersects[0].object)) {
          drillObject = intersects[0].object;
        }
      }
      if (drillObject) {
        const baseObjects = subtractTargets.filter((obj) => obj !== drillObject);
        if (baseObjects.length > 0) {
          performSubtract(baseObjects, drillObject);
        } else {
          cancelSubtractMode();
        }
      } else {
        log('掘削操作をキャンセルしました。');
        cancelSubtractMode();
      }
      return;
    }

    if (isMirrorCopyMode) {
      let clickedViewportKey = null;
      let clickedRect = null;
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

    let clickedViewportKey = null;
    let clickedRect = null;
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

    if (e.ctrlKey) {
      if (clickedObject) {
        const index = selectedObjects.indexOf(clickedObject);
        if (index > -1) {
          selectedObjects.splice(index, 1);
        } else {
          selectedObjects.push(clickedObject);
        }
      }
    } else if (e.shiftKey || isMultiSelectMode) {
      if (clickedObject && !selectedObjects.includes(clickedObject)) {
        selectedObjects.push(clickedObject);
      }
    } else {
      selectedObjects = clickedObject ? [clickedObject] : [];
    }

    if (isMultiSelectMode && !clickedObject) {
      isMultiSelectMode = false;
      multiSelectButton.style.backgroundColor = '#f39c12';
    }

    updateSelection();
    log(selectedObjects.length > 0 ? `${selectedObjects.length}個のオブジェクトを選択中` : '待機中');
    return;
  }
});

// ▼▼▼【追加】2Dビューでの右クリックメニューを抑制する処理 ▼▼▼
window.addEventListener('contextmenu', (event) => {
  // 2Dビューポートのキーを配列で定義
  const twoDViewKeys = ['top', 'front', 'side'];

  for (const key of twoDViewKeys) {
    const view = viewports[key];
    const rect = view.element.getBoundingClientRect();

    // イベントが発生した座標が、いずれかの2Dビューの範囲内かチェック
    if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
      // 範囲内であれば、デフォルトのメニュー表示をキャンセル
      event.preventDefault();
      return; // 処理を終了
    }
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
          clipboard = selectedObjects.map((obj) => ({geometry: obj.geometry, material: obj.material, source: {scale: obj.scale.clone(), rotation: obj.rotation.clone(), position: obj.position.clone()}}));
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
/**
 * 【修正】アニメーションループ。
 * 毎フレーム、グループ選択用の不可視メッシュのサイズと位置を更新してから、
 * 全てのヘルパーを更新します。
 */
function animate() {
  requestAnimationFrame(animate);
  orbitControls.update();

  // 複数選択されている場合、グループ用の不可視メッシュを更新する
  if (groupBoundingBoxMesh) {
    const groupBox3 = new THREE.Box3();
    selectedObjects.forEach((obj) => {
      groupBox3.expandByObject(obj);
    });
    if (!groupBox3.isEmpty()) {
      groupBox3.getCenter(groupBoundingBoxMesh.position);
      groupBox3.getSize(groupBoundingBoxMesh.scale);
    }
  }

  // 全てのヘルパーを更新する
  selectionBoxes.children.forEach((box) => box.update());

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
      selectionBoxes.visible = false;
      scene.overrideMaterial = wireframeMaterial;
      renderer.render(scene, view.camera);
      scene.overrideMaterial = null;
      selectionBoxes.visible = true;
      gridHelper.visible = true;

      if (selectedObjects.length > 0) {
        renderer.render(scaleGizmoGroup, view.camera);
      }
      renderer.autoClear = originalAutoClear;
    } else {
      scaleGizmoGroup.visible = false;
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
