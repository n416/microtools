import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

import { AppState } from './AppState.js';
import { ViewportManager } from './ViewportManager.js';
import { InputHandler } from './InputHandler.js';
import { UIControl } from './UIControl.js';
import { History } from './History.js';
import * as SceneIO from './SceneIo.js';

export class MechaCreatorApp {
  constructor() {
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    document.body.appendChild(this.renderer.domElement);
    
    this.logMessages = [];
    this.groupBoundingBoxMesh = null;
    this.isPanModeActive = false;
    this.gizmoMode = 'scale';

    this.setupScene();

    this.appState = new AppState();
    // ★ 修正: thisコンテキストを保持するために、appInstanceとしてキャプチャ
    const appInstance = this;
    this.history = new History(this); 
    this.viewportManager = new ViewportManager(document.getElementById('viewport-container'), this.scene, this.mechaGroup, null, this.scaleGizmoGroup);

    this.orbitControls = new OrbitControls(this.viewportManager.viewports.perspective.camera, this.viewportManager.viewports.perspective.element);
    this.transformControls = new TransformControls(this.viewportManager.viewports.perspective.camera, this.renderer.domElement);

    this.selectionBoxes = new THREE.Group();
    this.scene.add(this.selectionBoxes);

    this.appContext = {
      scene: this.scene,
      renderer: this.renderer,
      mechaGroup: this.mechaGroup,
      previewGroup: this.previewGroup,
      viewportManager: this.viewportManager,
      transformControls: this.transformControls,
      orbitControls: this.orbitControls,
      history: this.history,
      state: this.appState,
      modes: this.appState.modes,
      log: this.log.bind(this),
      selectionManager: {
        get: () => this.appState.selectedObjects,
        set: (newSelection) => this.appState.setSelection(newSelection),
        clear: () => this.appState.clearSelection(),
      },
      highlightMaterial: new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
      originalMaterials: new Map(),
      gizmoHandles: this.gizmoHandles,
      // ★★★ 修正: 無限再帰を防ぐため、キャプチャしたインスタンスを参照する ★★★
      get gizmoMode() { return appInstance.gizmoMode; },
      get isPanModeActive() { return appInstance.isPanModeActive; }
    };

    this.inputHandler = new InputHandler(this.appContext);
    this.uiControl = new UIControl(this.appContext);
    
    this.viewportManager.setRenderer(this.renderer);
    this.viewportManager.setControls(this.transformControls, this.orbitControls);
    this.viewportManager.setSelectionBoxes(this.selectionBoxes);
  }

  setupScene() {
        // 環境光と指向性光を弱めにして、SpotLightの効果を分かりやすくする
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);
    
    this.mechaGroup = new THREE.Group();
    this.scene.add(this.mechaGroup);
    
    const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
    gridHelper.name = 'GridHelper';
    this.scene.add(gridHelper);

    this.scaleGizmoGroup = new THREE.Group();
    this.gizmoHandles = [];
    this.gizmoLineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, toneMapped: false, depthTest: false });
    const gizmoHandleMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, toneMapped: false, depthTest: false, side: THREE.DoubleSide });
    const handleSize = 0.5;
    const handlePositions = [
      {x: -0.5, y: 0.5, name: 'top-left'}, {x: 0, y: 0.5, name: 'top-center'}, {x: 0.5, y: 0.5, name: 'top-right'},
      {x: -0.5, y: 0, name: 'middle-left'}, {x: 0.5, y: 0, name: 'middle-right'},
      {x: -0.5, y: -0.5, name: 'bottom-left'}, {x: 0, y: -0.5, name: 'bottom-center'}, {x: 0.5, y: -0.5, name: 'bottom-right'},
    ];
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, 0.5, 0), new THREE.Vector3(0.5, 0.5, 0), new THREE.Vector3(0.5, -0.5, 0), new THREE.Vector3(-0.5, -0.5, 0), new THREE.Vector3(-0.5, 0.5, 0)]);
    const gizmoFrame = new THREE.Line(lineGeometry, this.gizmoLineMaterial);
    this.scaleGizmoGroup.add(gizmoFrame);
    handlePositions.forEach((pos) => {
      const handleGeometry = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
      const handle = new THREE.Mesh(handleGeometry, gizmoHandleMaterial.clone());
      handle.position.set(pos.x, pos.y, 0);
      handle.name = pos.name;
      this.gizmoHandles.push(handle);
      this.scaleGizmoGroup.add(handle);
    });
    this.scene.add(this.scaleGizmoGroup);

    this.previewGroup = new THREE.Group();
    this.scene.add(this.previewGroup);
  }

  log(message) {
    const logDisplay = document.getElementById('log-display');
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    this.logMessages.unshift(`[${timestamp}] ${message}`);
    if (this.logMessages.length > 4) this.logMessages.pop();
    logDisplay.innerHTML = this.logMessages.join('<br>');
    console.log(message);
  }

  updateSelection() {
    const selectedObjects = this.appState.selectedObjects;

    while (this.selectionBoxes.children.length > 0) {
      const box = this.selectionBoxes.children[0];
      this.selectionBoxes.remove(box); box.geometry.dispose(); box.material.dispose();
    }
    if (this.groupBoundingBoxMesh) {
      this.scene.remove(this.groupBoundingBoxMesh); this.groupBoundingBoxMesh.geometry.dispose(); this.groupBoundingBoxMesh.material.dispose(); this.groupBoundingBoxMesh = null;
    }
    this.transformControls.detach();

    if (selectedObjects.length === 1) {
      this.transformControls.attach(selectedObjects[0]);
      this.selectionBoxes.add(new THREE.BoxHelper(selectedObjects[0], 0xffff00));
    } else if (selectedObjects.length > 1) {
      selectedObjects.forEach((obj) => { this.selectionBoxes.add(new THREE.BoxHelper(obj, 0xffff00)); });
      const groupBox3 = new THREE.Box3();
      selectedObjects.forEach((obj) => { groupBox3.expandByObject(obj); });
      if (!groupBox3.isEmpty()) {
          const center = groupBox3.getCenter(new THREE.Vector3());
          const size = groupBox3.getSize(new THREE.Vector3());
          const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ visible: false }));
          boxMesh.position.copy(center);
          boxMesh.scale.copy(size);
          this.scene.add(boxMesh);
          this.transformControls.attach(boxMesh);
          this.selectionBoxes.add(new THREE.BoxHelper(boxMesh, 0x00ff00));
          this.groupBoundingBoxMesh = boxMesh;
      }
    }
  }

  updateGizmoAppearance() {
      const color = this.gizmoMode === 'rotate' ? new THREE.Color(0x00ffff) : new THREE.Color(0xffff00);
      this.gizmoLineMaterial.color.copy(color);
      this.gizmoHandles.forEach((handle) => {
          if (handle.name.includes('center')) { handle.visible = this.gizmoMode === 'scale'; }
          handle.material.color.copy(color);
      });
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.orbitControls.update();

    if (this.groupBoundingBoxMesh) {
      const groupBox3 = new THREE.Box3();
      this.appState.selectedObjects.forEach((obj) => {
          groupBox3.expandByObject(obj);
      });
      if (!groupBox3.isEmpty()) {
          groupBox3.getCenter(this.groupBoundingBoxMesh.position);
          groupBox3.getSize(this.groupBoundingBoxMesh.scale);
          this.groupBoundingBoxMesh.updateMatrixWorld(true);
      }
    }

    this.selectionBoxes.children.forEach((box) => box.update());
    this.viewportManager.render(this.appState);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  init() {
    this.appState.onSelectionChange.add(this.updateSelection.bind(this));
    this.inputHandler.initialize();
    this.uiControl.initialize();
    
    document.addEventListener('setGizmoMode', (e) => {
        this.gizmoMode = e.detail;
        this.updateGizmoAppearance();
    });
    document.addEventListener('setPanMode', (e) => {
        this.isPanModeActive = e.detail;
    });

    this.updateGizmoAppearance();
    this.updateSelection();

    window.addEventListener('load', () => {
        const data = localStorage.getItem('mechaCreatorAutoSave');
        if (data) {
            try { SceneIO.loadFromData(this.appContext, JSON.parse(data)); }
            catch (e) { console.error('自動保存データの復元に失敗', e); }
        }
        this.log('初期化完了');
        this.viewportManager.onWindowResize();
    });

    this.animate();
  }
}