import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';

import {AppState} from './AppState.js';
import {ViewportManager} from './ViewportManager.js';
import {InputHandler} from './InputHandler.js';
import {UIControl} from './UIControl.js'; // ★ UIControlをインポート

import {AddObjectCommand} from './command-create.js';
import {MacroCommand, DeleteObjectCommand, TransformCommand} from './command-edit.js';

import * as SceneIO from './scene-io.js';

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
const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
gridHelper.name = 'GridHelper';
scene.add(gridHelper);

const logDisplay = document.getElementById('log-display');
let logMessages = [];

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

const appState = new AppState();
const viewportManager = new ViewportManager(document.getElementById('viewport-container'), scene, mechaGroup, null, scaleGizmoGroup);

let isPanModeActive = false;
let gizmoMode = 'scale';

// =================================================================
// ◆ 2. コントロールと主要機能
// =================================================================
viewportManager.setRenderer(renderer);

const orbitControls = new OrbitControls(viewportManager.viewports.perspective.camera, viewportManager.viewports.perspective.element);
orbitControls.enableDamping = true;
const transformControls = new TransformControls(viewportManager.viewports.perspective.camera, renderer.domElement);
viewportManager.setControls(transformControls, orbitControls);

const selectionBoxes = new THREE.Group();
scene.add(selectionBoxes);
viewportManager.setSelectionBoxes(selectionBoxes);

let groupBoundingBoxMesh = null;

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
        const newSelection = command.commands.map((cmd) => cmd.object).filter(Boolean);
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
  orbitControls,
  history,
  state: appState,
  modes: appState.modes,
  log,
  selectionManager: {
    get: () => appState.selectedObjects,
    set: (newSelection) => appState.setSelection(newSelection),
    clear: () => appState.clearSelection(),
  },
  highlightMaterial: new THREE.MeshStandardMaterial({color: 0x00ff00, transparent: true, opacity: 0.7, side: THREE.DoubleSide}),
  originalMaterials: new Map(),
  gizmoHandles,
  get gizmoMode() {
    return gizmoMode;
  },
  get isPanModeActive() {
    return isPanModeActive;
  },
};

const inputHandler = new InputHandler(appContext);
const uiControl = new UIControl(appContext); // ★ UIControlをインスタンス化

function log(message) {
  const timestamp = new Date().toLocaleTimeString('ja-JP');
  logMessages.unshift(`[${timestamp}] ${message}`);
  if (logMessages.length > 4) logMessages.pop();
  logDisplay.innerHTML = logMessages.join('<br>');
  console.log(message);
}

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
      const center = groupBox3.getCenter(new THREE.Vector3());
      const size = groupBox3.getSize(new THREE.Vector3());

      const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({visible: false}));
      boxMesh.position.copy(center);
      boxMesh.scale.copy(size);
      scene.add(boxMesh);

      transformControls.attach(boxMesh);
      selectionBoxes.add(new THREE.BoxHelper(boxMesh, 0x00ff00));
      groupBoundingBoxMesh = boxMesh;
    }
  }
}

function updateGizmoAppearance() {
  const color = gizmoMode === 'rotate' ? new THREE.Color(0x00ffff) : new THREE.Color(0xffff00);
  gizmoLineMaterial.color.copy(color);
  gizmoHandles.forEach((handle) => {
    if (handle.name.includes('center')) {
      handle.visible = gizmoMode === 'scale';
    }
    handle.material.color.copy(color);
  });
}

// =================================================================
// ◆ 5. アニメーションループ
// =================================================================
function animate() {
  requestAnimationFrame(animate);
  orbitControls.update();

  if (groupBoundingBoxMesh) {
    // グループ選択時のバウンディングボックス更新ロジックを簡素化
    const groupBox3 = new THREE.Box3();
    appState.selectedObjects.forEach((obj) => {
      groupBox3.expandByObject(obj);
    });
    if (!groupBox3.isEmpty()) {
      groupBox3.getCenter(groupBoundingBoxMesh.position);
      groupBox3.getSize(groupBoundingBoxMesh.scale);
      groupBoundingBoxMesh.updateMatrixWorld(true);
    }
  }

  selectionBoxes.children.forEach((box) => box.update());
  viewportManager.render(appState);
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// =================================================================
// ◆ 6. 初期化
// =================================================================
appState.onSelectionChange.add(updateSelection);
inputHandler.initialize();
uiControl.initialize(); // ★ UIControlのイベントリスナーを起動

// カスタムイベントのリスナーをここに集約
document.addEventListener('setGizmoMode', (e) => {
  gizmoMode = e.detail;
  updateGizmoAppearance();
});
document.addEventListener('setPanMode', (e) => {
  isPanModeActive = e.detail;
});

updateGizmoAppearance();
updateSelection();

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

animate();
