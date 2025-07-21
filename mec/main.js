import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';

// 状態管理クラスのインポート
import {AppState} from './AppState.js';
// ビューポート管理クラスのインポート
import {ViewportManager} from './ViewportManager.js';

// コマンド関連のインポート
import {command} from './command.js';
import {createColorPalette} from './paint.js';
import {ChangeColorCommand} from './command-paint.js';
import {AddObjectCommand} from './command-create.js';
import {MacroCommand, DeleteObjectCommand, TransformCommand} from './command-edit.js';

// 機能モジュールのインポート
import * as CsgOperations from './csg-operations.js';
import * as SceneIO from './scene-io.js';
import * as ClipboardFeatures from './clipboard-features.js';

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
gridHelper.name = 'GridHelper';
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

// アプリケーションの状態を一元管理
const appState = new AppState();

let multiSelectHelper = new THREE.Object3D();
scene.add(multiSelectHelper);
let selectionBoxes = new THREE.Group();
scene.add(selectionBoxes);
let isPanning2D = false;
let panStart = {x: 0, y: 0};
let cameraStartPos = new THREE.Vector3();
let panningViewportKey = null;
let isPanModeActive = false;
let isSpacebarDown = false;
const selectionBoxElement = document.getElementById('selection-box');
let isBoxSelecting = false;
const startPoint = new THREE.Vector2();
const highlightMaterial = new THREE.MeshStandardMaterial({color: 0x00ff00, transparent: true, opacity: 0.7, side: THREE.DoubleSide});
const originalMaterials = new Map();
let transformGroup = null;
let groupBoundingBoxMesh = null;
let transformStartCache = null;
let draggedInfo = null;
const dragStartObjectState = {position: new THREE.Vector3(), scale: new THREE.Vector3(), rotation: new THREE.Euler()};
const worldTransforms = new Map();
let isDraggingIn2DView = false;
let isScalingIn2DView = false;
let isRotatingIn2DView = false;
const dragStartPointer = new THREE.Vector2();

// =================================================================
// ◆ 3. コントロールと主要機能
// =================================================================
const viewportContainer = document.getElementById('viewport-container');

// ViewportManager を先にインスタンス化してカメラを準備
const viewportManager = new ViewportManager(viewportContainer, scene, mechaGroup, selectionBoxes, scaleGizmoGroup);
viewportManager.setRenderer(renderer);

// カメラが利用可能になった後で Controls をインスタンス化
const orbitControls = new OrbitControls(viewportManager.viewports.perspective.camera, viewportManager.viewports.perspective.element);
orbitControls.enableDamping = true;
const transformControls = new TransformControls(viewportManager.viewports.perspective.camera, renderer.domElement);

// ViewportManager にインスタンス化した controls を渡す
viewportManager.setControls(transformControls, orbitControls);

transformControls.addEventListener('objectChange', () => {
  selectedObjectHolder = transformControls.object;
});

export class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }
  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
    if (!(command instanceof AddObjectCommand && command.isInternal)) {
      appState.modes.lastPasteInfo = {objects: [], offset: new THREE.Vector3()};
    }
    log(command.message);
    SceneIO.autoSaveScene(appContext);
  }
  undo() {
    appState.modes.lastPasteInfo = {objects: [], offset: new THREE.Vector3()};
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
      appState.clearSelection();
      log(`Undo: ${command.message}`);
      SceneIO.autoSaveScene(appContext);
    } else {
      log('これ以上元に戻せません。');
    }
  }
  redo() {
    appState.modes.lastPasteInfo = {objects: [], offset: new THREE.Vector3()};
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);
      if (command instanceof DeleteObjectCommand || (command instanceof MacroCommand && command.commands[0] instanceof DeleteObjectCommand)) {
        appState.clearSelection();
      } else if (command instanceof MacroCommand) {
        const newSelection = [];
        command.commands.forEach((cmd) => {
          if (cmd.object) newSelection.push(cmd.object);
        });
        if (newSelection.length > 0) appState.setSelection(newSelection);
      }
      log(`Redo: ${command.message}`);
      SceneIO.autoSaveScene(appContext);
    } else {
      log('これ以上やり直せません。');
    }
  }
}

const history = new History();

const appContext = {
  scene,
  renderer,
  mechaGroup,
  previewGroup,
  viewportManager,
  transformControls,
  state: appState,
  modes: appState.modes,
  originalMaterials,
  selectionManager: {
    get: () => appState.selectedObjects,
    set: (newSelection) => appState.setSelection(newSelection),
    clear: () => appState.clearSelection(),
  },
  log,
  history,
  highlightMaterial,
  updateSelection,
};

function log(message) {
  const timestamp = new Date().toLocaleTimeString('ja-JP');
  logMessages.unshift(`[${timestamp}] ${message}`);
  if (logMessages.length > 4) logMessages.pop();
  logDisplay.innerHTML = logMessages.join('<br>');
  console.log(message);
}

appState.onSelectionChange.add(updateSelection);

function updateSelection() {
  const selectedObjects = appState.selectedObjects;

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

  if (selectedObjects.length === 1) {
    transformControls.attach(selectedObjects[0]);
    selectionBoxes.add(new THREE.BoxHelper(selectedObjects[0], 0xffff00));
  } else if (selectedObjects.length > 1) {
    selectedObjects.forEach((obj) => {
      selectionBoxes.add(new THREE.BoxHelper(obj, 0xffff00));
    });
    const groupBox3 = new THREE.Box3();
    selectedObjects.forEach((obj) => {
      groupBox3.expandByObject(obj);
    });
    if (!groupBox3.isEmpty()) {
      groupBoundingBoxMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({visible: false, transparent: true}));
      groupBox3.getCenter(groupBoundingBoxMesh.position);
      groupBox3.getSize(groupBoundingBoxMesh.scale);
      scene.add(groupBoundingBoxMesh);
      selectionBoxes.add(new THREE.BoxHelper(groupBoundingBoxMesh, 0x00ff00));
      multiSelectHelper.position.copy(groupBoundingBoxMesh.position);
      transformControls.attach(multiSelectHelper);
    }
  }
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

function debugSelectionHelpers() {
  console.clear();
  const selectedObjects = appState.selectedObjects;
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
    const isYellowHelper = selectedObjects.includes(box.object);
    const helperType = isYellowHelper ? '黄色 (個別)' : '緑色 (グループ)';
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
      console.warn('  - 警告: このヘルパーはサイズがゼロのため、表示されません。');
    }
    console.log('  - 関連付けられたオブジェクト:', box.object);
    console.log('---');
  });
  console.log('==============================================');
  log('デバッグ情報をコンソールに出力しました。');
}

// =================================================================
// ◆ 4. イベントリスナー
// =================================================================
function setupEventListeners() {
  const fileInput = document.getElementById('fileInput');

  // --- オブジェクト追加 ---
  document.getElementById('addCube').addEventListener('click', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff}));
    history.execute(new AddObjectCommand(mesh, mechaGroup, appContext.selectionManager));
  });
  document.getElementById('addSphere').addEventListener('click', () => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 16), new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff}));
    history.execute(new AddObjectCommand(mesh, mechaGroup, appContext.selectionManager));
  });
  document.getElementById('addCone').addEventListener('click', () => {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.5, 32), new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff}));
    history.execute(new AddObjectCommand(mesh, mechaGroup, appContext.selectionManager));
  });
  document.getElementById('addCylinder').addEventListener('click', () => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32), new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff}));
    history.execute(new AddObjectCommand(mesh, mechaGroup, appContext.selectionManager));
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
    if (isNaN(sides) || sides < 3) sides = 3;
    if (sides > 64) sides = 64;
    sidesInput.value = sides;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.5, sides), new THREE.MeshStandardMaterial({color: Math.random() * 0xffffff}));
    history.execute(new AddObjectCommand(mesh, mechaGroup, appContext.selectionManager));
    document.getElementById('prismModal').style.display = 'none';
  });

  // --- 機能呼び出し ---
  document.getElementById('unionObjects').addEventListener('click', () => CsgOperations.performUnion(appContext));
  document.getElementById('intersectObjects').addEventListener('click', () => CsgOperations.performIntersect(appContext));
  document.getElementById('subtractObjects').addEventListener('click', () => CsgOperations.startSubtractMode(appContext));
  document.getElementById('cancelSubtract').addEventListener('click', () => CsgOperations.cancelSubtractMode(appContext));
  document.getElementById('mirrorCopy').addEventListener('click', () => ClipboardFeatures.startMirrorCopyMode(appContext));
  document.getElementById('cancelMirrorCopy').addEventListener('click', () => ClipboardFeatures.cancelMirrorCopyMode(appContext));
  document.getElementById('deleteObject').addEventListener('click', () => {
    const selectedObjects = appState.selectedObjects;
    if (selectedObjects.length === 0) return log('削除対象なし');
    const commands = selectedObjects.map((obj) => new DeleteObjectCommand(obj, mechaGroup));
    history.execute(new MacroCommand(commands, `選択した ${selectedObjects.length} 個のオブジェクトを削除`));
    appState.clearSelection();
  });

  // --- ファイルIO ---
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
  document.getElementById('load').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      try {
        SceneIO.loadFromData(appContext, JSON.parse(re.target.result));
      } catch (err) {
        log('ファイル読込失敗');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // --- UIモード ---
  document.getElementById('debugLog').addEventListener('click', debugSelectionHelpers);
  const multiSelectButton = document.getElementById('multiSelect');
  multiSelectButton.addEventListener('click', () => {
    appState.isMultiSelectMode = !appState.isMultiSelectMode;
    if (appState.isMultiSelectMode) {
      multiSelectButton.style.backgroundColor = '#2ecc71';
      log('複数選択モード開始。SHIFTキーで選択を追加/解除できます。');
    } else {
      multiSelectButton.style.backgroundColor = '#f39c12';
      appState.clearSelection();
      log('複数選択モード終了。');
    }
  });
  const panModeButton = document.getElementById('panModeButton');
  panModeButton.addEventListener('click', () => {
    isPanModeActive = !isPanModeActive;
    if (isPanModeActive) {
      panModeButton.style.backgroundColor = '#2ecc71';
      orbitControls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      log('パンモード開始。3Dビューの左ドラッグで視点を移動できます。');
    } else {
      panModeButton.style.backgroundColor = '#3498db';
      orbitControls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      log('パンモード終了。');
    }
  });

  // --- ペイント関連 ---
  const paintModeButton = document.getElementById('paintModeButton');
  const eyedropperButton = document.getElementById('eyedropperButton');
  const paintControls = document.getElementById('paint-controls');
  const colorPaletteContainer = document.getElementById('colorPalette');
  const currentColorDisplay = document.getElementById('currentColorDisplay');
  const basePaletteColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0x999999];
  const paletteFragment = createColorPalette(basePaletteColors, 5);
  colorPaletteContainer.appendChild(paletteFragment);
  colorPaletteContainer.addEventListener('click', (e) => {
    if (e.target.dataset.color) {
      const colorHex = parseInt(e.target.dataset.color, 10);
      appState.currentColor.set(colorHex);
      updateCurrentColorDisplay();
      log(`色を選択: #${appState.currentColor.getHexString()}`);
    }
  });
  function updateCurrentColorDisplay() {
    currentColorDisplay.style.backgroundColor = `#${appState.currentColor.getHexString()}`;
  }
  updateCurrentColorDisplay();
  paintModeButton.addEventListener('click', () => {
    appState.isPaintMode = !appState.isPaintMode;
    if (appState.isPaintMode) {
      paintModeButton.style.backgroundColor = '#2ecc71';
      paintControls.style.display = 'flex';
      if (appState.isMultiSelectMode) multiSelectButton.click();
      ClipboardFeatures.cancelMirrorCopyMode(appContext);
      ClipboardFeatures.cancelPasteMode(appContext);
      CsgOperations.cancelSubtractMode(appContext);
      appState.clearSelection();
      log('ペイントモード開始。オブジェクトをクリックして着色します。');
    } else {
      paintModeButton.style.backgroundColor = '#9b59b6';
      paintControls.style.display = 'none';
      appState.isEyedropperMode = false;
      for (const key in viewportManager.viewports) {
        viewportManager.viewports[key].element.style.cursor = 'default';
      }
      log('ペイントモード終了。');
    }
  });
  eyedropperButton.addEventListener('click', () => {
    appState.isEyedropperMode = true;
    if (!appState.isPaintMode) {
      paintModeButton.click();
    }
    log('スポイトモード開始。オブジェクトをクリックして色を抽出します。');
    for (const key in viewportManager.viewports) {
      viewportManager.viewports[key].element.style.cursor = 'crosshair';
    }
  });

  // --- グローバルイベントリスナー ---
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (appState.isPaintMode && !appState.isEyedropperMode) {
      let colorChanged = false;
      const hsl = {};
      appState.currentColor.getHSL(hsl);
      const hueStep = 0.01;
      const lightnessStep = 0.02;

      switch (e.key) {
        case 'ArrowUp':
          hsl.l = Math.min(1, hsl.l + lightnessStep);
          colorChanged = true;
          break;
        case 'ArrowDown':
          hsl.l = Math.max(0, hsl.l - lightnessStep);
          colorChanged = true;
          break;
        case 'ArrowLeft':
          hsl.h -= hueStep;
          if (hsl.h < 0) hsl.h += 1;
          colorChanged = true;
          break;
        case 'ArrowRight':
          hsl.h = (hsl.h + hueStep) % 1.0;
          colorChanged = true;
          break;
      }

      if (colorChanged) {
        e.preventDefault();
        appState.currentColor.setHSL(hsl.h, hsl.s, hsl.l);
        updateCurrentColorDisplay();
        log(`色調整: H:${hsl.h.toFixed(2)} S:${hsl.s.toFixed(2)} L:${hsl.l.toFixed(2)}`);
        return;
      }
    }

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
          const selectedObjects = appState.selectedObjects;
          if (selectedObjects.length > 0) {
            appState.modes.clipboard = selectedObjects.map((obj) => ({geometry: obj.geometry, material: obj.material, source: {scale: obj.scale.clone(), rotation: obj.rotation.clone(), position: obj.position.clone()}}));
            log(`${selectedObjects.length}個のオブジェクトをコピーしました。`);
          } else {
            log('コピーするオブジェクトが選択されていません。');
          }
          return;
        case 'v':
          e.preventDefault();
          if (!appState.modes.clipboard) {
            log('クリップボードが空です。');
            return;
          }
          const lastSelectedIds = appState.modes.lastPasteInfo.objects.map((o) => o.uuid);
          const currentSelectedIds = appState.selectedObjects.map((o) => o.uuid);
          const isSameSelection = lastSelectedIds.length === currentSelectedIds.length && lastSelectedIds.every((id) => currentSelectedIds.includes(id));
          if (isSameSelection && lastSelectedIds.length > 0) {
            ClipboardFeatures.performDirectPaste(appContext);
          } else {
            ClipboardFeatures.startPastePreview(appContext);
          }
          return;
      }
    }

    if (e.key === ' ' && !isSpacebarDown) {
      e.preventDefault();
      isSpacebarDown = true;
      orbitControls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      for (const key in viewportManager.viewports) {
        viewportManager.viewports[key].element.style.cursor = 'grab';
      }
      return;
    }

    if (appState.modes.isMirrorCopyMode && e.key === 'Escape') {
      ClipboardFeatures.cancelMirrorCopyMode(appContext);
      return;
    }
    if (appState.modes.isPasteMode && e.key === 'Escape') {
      ClipboardFeatures.cancelPasteMode(appContext);
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

    const selectedObjects = appState.selectedObjects;
    if (selectedObjects.length === 0) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedObjects.length > 0) {
        const commands = selectedObjects.map((obj) => new DeleteObjectCommand(obj, mechaGroup));
        history.execute(new MacroCommand(commands, `選択した ${selectedObjects.length} 個のオブジェクトを削除`));
        appState.clearSelection();
      }
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

  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      isSpacebarDown = false;
      if (!isPanModeActive) {
        orbitControls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      }
      for (const key in viewportManager.viewports) {
        viewportManager.viewports[key].element.style.cursor = 'default';
      }
    }
  });

  window.addEventListener('pointerdown', (event) => {
    if (event.target.closest('#ui') || transformControls.dragging) return;

    const clickedViewportInfo = viewportManager.getViewportFromEvent(event);

    const start2DPan = (e, viewportKey) => {
      if (viewportKey && viewportKey !== 'perspective') {
        isPanning2D = true;
        panningViewportKey = viewportKey;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        cameraStartPos.copy(viewportManager.viewports[panningViewportKey].camera.position);
        orbitControls.enabled = false;
        viewportManager.viewports[clickedViewportInfo.key].element.style.cursor = 'grabbing';
      }
    };

    if (event.button === 2) {
      if (clickedViewportInfo) {
        start2DPan(event, clickedViewportInfo.key);
      }
      return;
    }

    if (event.button === 0) {
      if (!clickedViewportInfo) return;
      const {key: clickedViewportKey, rect: clickedRect} = clickedViewportInfo;

      if ((isPanModeActive || isSpacebarDown) && clickedViewportKey === 'perspective') return;
      if ((isPanModeActive || isSpacebarDown) && clickedViewportKey !== 'perspective' && clickedViewportKey !== null) {
        start2DPan(event, clickedViewportKey);
        return;
      }

      startPoint.set(event.clientX, event.clientY);

      if (appState.modes.isMirrorCopyMode || appState.modes.isSubtractMode || appState.modes.isPasteMode || appState.isPaintMode || appState.isEyedropperMode) return;

      const clickedViewport = viewportManager.viewports[clickedViewportKey];
      pointer.x = ((event.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
      pointer.y = -((event.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, clickedViewport.camera);

      // クリックした瞬間にギズモの状態を更新する
      viewportManager.updateScaleGizmo(clickedViewportKey, appState);

      const is2DView = clickedViewportKey !== 'perspective';
      const allObjectIntersects = raycaster.intersectObjects(mechaGroup.children, true);
      const clickedObject = allObjectIntersects.length > 0 ? allObjectIntersects[0].object : null;

      if (is2DView && appState.selectedObjects.length > 0) {
        const handleIntersects = raycaster.intersectObjects(gizmoHandles, true);

        const setupTransformState = () => {
          orbitControls.enabled = false;
          dragStartPointer.set(event.clientX, event.clientY);
          transformStartCache = appState.selectedObjects.map((obj) => ({position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone()}));
        };
        const setupMultiSelectGroup = () => {
          const groupBounds = new THREE.Box3();
          appState.selectedObjects.forEach((obj) => groupBounds.expandByObject(obj));
          groupBounds.getCenter(dragStartObjectState.position);
          groupBounds.getSize(dragStartObjectState.scale);
          worldTransforms.clear();
          appState.selectedObjects.forEach((obj) => worldTransforms.set(obj, {parent: obj.parent}));
          if (transformGroup) scene.remove(transformGroup);
          transformGroup = new THREE.Group();
          transformGroup.position.copy(dragStartObjectState.position);
          scene.add(transformGroup);
          appState.selectedObjects.forEach((obj) => transformGroup.attach(obj));
        };
        if (handleIntersects.length > 0) {
          setupTransformState();
          if (appState.selectedObjects.length === 1) {
            const target = appState.selectedObjects[0];
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
        if (clickedObject && appState.selectedObjects.includes(clickedObject) && !event.shiftKey && !event.ctrlKey) {
          setupTransformState();
          isDraggingIn2DView = true;
          if (appState.selectedObjects.length === 1) {
            dragStartObjectState.position.copy(appState.selectedObjects[0].position);
          } else {
            setupMultiSelectGroup();
          }
          draggedInfo = {viewportKey: clickedViewportKey, handleName: null};
          return;
        }
      }

      const isGizmoHit = !is2DView && transformControls.object && transformControls.pointerOver;
      if (!clickedObject && !isGizmoHit) {
        isBoxSelecting = true;
        selectionBoxElement.style.display = 'block';
        orbitControls.enabled = false;
      }
    }
  });

  window.addEventListener('pointermove', (event) => {
    if (isPanning2D) {
      const view = viewportManager.viewports[panningViewportKey];
      const rect = view.element.getBoundingClientRect();
      const frustumSize = 10;
      const aspect = rect.width / rect.height;
      const deltaX = ((event.clientX - panStart.x) / rect.width) * frustumSize * aspect;
      const deltaY = ((event.clientY - panStart.y) / rect.height) * frustumSize;
      const camera = view.camera;

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
      return;
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

    const view = viewportManager.viewports[draggedInfo.viewportKey];
    const rect = view.element.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    const frustumSize = 10;
    const worldDeltaX = ((event.clientX - dragStartPointer.x) / rect.width) * frustumSize * aspect;
    const worldDeltaY = ((event.clientY - dragStartPointer.y) / rect.height) * frustumSize;

    if (appState.selectedObjects.length === 1) {
      const targetObject = appState.selectedObjects[0];
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
    } else if (appState.selectedObjects.length > 1) {
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
      const newCursor = isSpacebarDown ? 'grab' : 'default';
      viewportManager.viewports[panningViewportKey].element.style.cursor = newCursor;
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
        if (!e.ctrlKey && !e.shiftKey && !appState.isMultiSelectMode) {
          appState.clearSelection();
          log('待機中');
        }
        return;
      }
      const boxRect = {left: Math.min(startPoint.x, endPoint.x), right: Math.max(startPoint.x, endPoint.x), top: Math.min(startPoint.y, endPoint.y), bottom: Math.max(startPoint.y, endPoint.y)};
      const objectsInBox = [];
      for (const key in viewportManager.viewports) {
        const view = viewportManager.viewports[key];
        const rect = view.element.getBoundingClientRect();
        if (boxRect.left > rect.right || boxRect.right < rect.left || boxRect.top > rect.bottom || boxRect.bottom < rect.top) continue;
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
        const currentSelection = [...appState.selectedObjects];
        objectsInBox.forEach((obj) => {
          const index = currentSelection.indexOf(obj);
          if (index > -1) {
            currentSelection.splice(index, 1);
          } else {
            currentSelection.push(obj);
          }
        });
        appState.setSelection(currentSelection);
      } else if (e.shiftKey || appState.isMultiSelectMode) {
        const newSelection = [...appState.selectedObjects];
        objectsInBox.forEach((obj) => {
          if (!newSelection.includes(obj)) {
            newSelection.push(obj);
          }
        });
        appState.setSelection(newSelection);
      } else {
        appState.setSelection(objectsInBox);
      }
      log(`${appState.selectedObjects.length}個のオブジェクトを選択中`);
      return;
    }

    if (isDraggingIn2DView || isScalingIn2DView || isRotatingIn2DView) {
      const selectedObjects = appState.selectedObjects;
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
      const clickedViewportInfo = viewportManager.getViewportFromEvent(e);
      if (!clickedViewportInfo) return;

      const {key: clickedViewportKey, rect: clickedRect} = clickedViewportInfo;
      const clickedViewport = viewportManager.viewports[clickedViewportKey];
      pointer.x = ((e.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
      pointer.y = -((e.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, clickedViewport.camera);

      if (appState.isEyedropperMode) {
        const intersects = raycaster.intersectObjects(mechaGroup.children, false);
        if (intersects.length > 0) {
          const clickedObject = intersects[0].object;
          appState.currentColor.copy(clickedObject.material.color);
          updateCurrentColorDisplay();
          log(`色を抽出: #${appState.currentColor.getHexString()}`);
        }
        appState.isEyedropperMode = false;
        for (const key in viewportManager.viewports) {
          viewportManager.viewports[key].element.style.cursor = 'default';
        }
        return;
      }

      if (appState.isPaintMode) {
        const intersects = raycaster.intersectObjects(mechaGroup.children, false);
        if (intersects.length > 0) {
          const clickedObject = intersects[0].object;
          if (clickedObject.material.color.getHex() !== appState.currentColor.getHex()) {
            history.execute(new ChangeColorCommand(clickedObject, appState.currentColor));
          }
        }
        return;
      }

      if (appState.modes.isSubtractMode) {
        const intersects = raycaster.intersectObjects(mechaGroup.children, true);
        let drillObject = null;
        if (intersects.length > 0) {
          if (appState.modes.subtractTargets.includes(intersects[0].object)) {
            drillObject = intersects[0].object;
          }
        }
        if (drillObject) {
          const baseObjects = appState.modes.subtractTargets.filter((obj) => obj !== drillObject);
          if (baseObjects.length > 0) {
            CsgOperations.performSubtract(baseObjects, drillObject, appContext);
          } else {
            CsgOperations.cancelSubtractMode(appContext);
          }
        } else {
          log('掘削操作をキャンセルしました。');
          CsgOperations.cancelSubtractMode(appContext);
        }
        return;
      }

      if (appState.modes.isMirrorCopyMode) {
        const intersects = raycaster.intersectObjects(previewGroup.children, true);
        if (intersects.length > 0) {
          ClipboardFeatures.performMirrorCopy(intersects[0].object, appContext);
        } else {
          ClipboardFeatures.cancelMirrorCopyMode(appContext);
        }
        return;
      }

      if (appState.modes.isPasteMode) {
        const intersects = raycaster.intersectObjects(previewGroup.children, true);
        if (intersects.length > 0) {
          ClipboardFeatures.confirmPaste(intersects[0].object, appContext);
        } else {
          ClipboardFeatures.cancelPasteMode(appContext);
        }
        return;
      }

      const intersects = raycaster.intersectObjects(mechaGroup.children, false);
      const clickedObject = intersects.length > 0 ? intersects[0].object : null;

      if (e.ctrlKey) {
        appState.toggleSelection(clickedObject);
      } else if (e.shiftKey || appState.isMultiSelectMode) {
        appState.addSelection(clickedObject);
      } else {
        appState.setSelection(clickedObject);
      }

      if (appState.isMultiSelectMode && !clickedObject) {
        appState.isMultiSelectMode = false;
        document.getElementById('multiSelect').style.backgroundColor = '#f39c12';
      }

      log(appState.selectedObjects.length > 0 ? `${appState.selectedObjects.length}個のオブジェクトを選択中` : '待機中');
      return;
    }
  });

  window.addEventListener('contextmenu', (event) => {
    const clickedViewportInfo = viewportManager.getViewportFromEvent(event);
    if (clickedViewportInfo && clickedViewportInfo.key !== 'perspective') {
      event.preventDefault();
    }
  });

  window.addEventListener('load', () => {
    const data = localStorage.getItem('mechaCreatorAutoSave');
    if (data) {
      try {
        SceneIO.loadFromData(appContext, JSON.parse(data));
      } catch (e) {
        console.error('自動保存データの復元に失敗', e);
      }
    }
    log('初期化完了');
    viewportManager.onWindowResize();
  });
}

// =================================================================
// ◆ 5. アニメーションループ
// =================================================================
function animate() {
  requestAnimationFrame(animate);
  orbitControls.update();

  if (groupBoundingBoxMesh) {
    const groupBox3 = new THREE.Box3();
    appState.selectedObjects.forEach((obj) => {
      groupBox3.expandByObject(obj);
    });
    if (!groupBox3.isEmpty()) {
      groupBox3.getCenter(groupBoundingBoxMesh.position);
      groupBox3.getSize(groupBoundingBoxMesh.scale);
    }
  }

  selectionBoxes.children.forEach((box) => box.update());

  // レンダリング処理をViewportManagerに委譲
  viewportManager.render(appState);

  renderer.setSize(window.innerWidth, window.innerHeight);
}

// =================================================================
// ◆ 6. 初期化
// =================================================================
setupEventListeners();
updateGizmoAppearance();
// ★ 初回描画のために一度呼び出す
updateSelection();
animate();
