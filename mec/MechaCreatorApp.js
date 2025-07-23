import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';

import {AppState} from './AppState.js';
import {ViewportManager} from './ViewportManager.js';
import {InputHandler} from './InputHandler.js';
import {UIControl} from './UIControl.js';
import {History} from './History.js';
import * as SceneIO from './SceneIo.js';

export class MechaCreatorApp {
  constructor() {
    // 1. クラスのプロパティを最初にすべて定義・初期化
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.logMessages = [];
    this.groupBoundingBoxMesh = null;
    this.isPanModeActive = false;
    this.gizmoMode = 'scale';
    this.guides = {};
    this.mechaGroup = new THREE.Group();
    this.previewGroup = new THREE.Group();
    this.selectionBoxes = new THREE.Group();
    this.scaleGizmoGroup = new THREE.Group();
    this.gizmoHandles = [];
    this.gizmoLineMaterial = new THREE.LineBasicMaterial({color: 0xffff00, toneMapped: false, depthTest: false});

    // 2. DOM要素を追加し、シーンの基本設定を完了
    document.body.appendChild(this.renderer.domElement);
    this.setupScene();

    // 3. 主要なコンポーネントをインスタンス化
    this.appState = new AppState();
    this.history = new History(this);
    this.viewportManager = new ViewportManager(document.getElementById('viewport-container'), this.scene, this.mechaGroup, this.selectionBoxes, this.scaleGizmoGroup);
    this.orbitControls = new OrbitControls(this.viewportManager.viewports.perspective.camera, this.viewportManager.viewports.perspective.element);
    this.transformControls = new TransformControls(this.viewportManager.viewports.perspective.camera, this.renderer.domElement);

    // 4. thisの参照を保持するための定数
    const appInstance = this;

    // 5. すべてのコンポーネントが準備できた後で、それらをまとめる appContext を作成
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
      log: (message) => this.log(message),
      selectionManager: {
        get: () => this.appState.selectedObjects,
        set: (newSelection) => this.appState.setSelection(newSelection),
        clear: () => this.appState.clearSelection(),
      },
      highlightMaterial: new THREE.MeshStandardMaterial({color: 0x00ff00, transparent: true, opacity: 0.7, side: THREE.DoubleSide}),
      originalMaterials: new Map(),
      gizmoHandles: this.gizmoHandles,
      guides: this.guides,
      // ★★★ ここが最終的な修正箇所です ★★★
      get gizmoMode() {
        return appInstance.gizmoMode;
      },
      get isPanModeActive() {
        return appInstance.isPanModeActive;
      },
    };

    // 6. appContext を使用する残りのコンポーネントを初期化
    this.inputHandler = new InputHandler(this.appContext);
    this.uiControl = new UIControl(this.appContext);

    // 7. 最終的なセットアップ
    this.viewportManager.setRenderer(this.renderer);
    this.viewportManager.setControls(this.transformControls, this.orbitControls);
  }

  setupScene() {
    this.scene.background = new THREE.Color(0x111111);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);

    const guideMaterial = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
      depthTest: false,
    });

    this.guides.player = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.0), guideMaterial);
    this.guides.player.name = 'PlayerGuide';
    this.guides.player.position.y = 1.0 / 2; // ★ 自機の高さ(1.0)の半分だけ上に移動
    this.guides.player.visible = false;
    this.scene.add(this.guides.player);

    this.guides.zako = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), guideMaterial.clone());
    this.guides.zako.name = 'ZakoGuide';
    this.guides.zako.position.y = 0.5 / 2; // ★ ザコの高さ(0.5)の半分だけ上に移動
    this.guides.zako.visible = false;
    this.scene.add(this.guides.zako);

    this.guides.boss = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.0, 3.0), guideMaterial.clone());
    this.guides.boss.name = 'BossGuide';
    this.guides.boss.position.y = 3.0 / 2; // ★ ボスの高さ(3.0)の半分だけ上に移動
    this.guides.boss.visible = false;
    this.scene.add(this.guides.boss);

    this.scene.add(this.mechaGroup);
    this.scene.add(this.previewGroup);
    this.scene.add(this.selectionBoxes);

    const gridHelper = new THREE.GridHelper(5, 100, 0x888888, 0x444444);
    gridHelper.name = 'GridHelper';
    this.scene.add(gridHelper);

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
      this.selectionBoxes.remove(box);
      if (box.geometry) box.geometry.dispose();
      if (box.material) box.material.dispose();
    }
    if (this.groupBoundingBoxMesh) {
      this.scene.remove(this.groupBoundingBoxMesh);
      if (this.groupBoundingBoxMesh.geometry) this.groupBoundingBoxMesh.geometry.dispose();
      if (this.groupBoundingBoxMesh.material) this.groupBoundingBoxMesh.material.dispose();
      this.groupBoundingBoxMesh = null;
    }
    this.transformControls.detach();

    if (selectedObjects.length === 1) {
      this.transformControls.attach(selectedObjects[0]);
      this.selectionBoxes.add(new THREE.BoxHelper(selectedObjects[0], 0xffff00));
    } else if (selectedObjects.length > 1) {
      selectedObjects.forEach((obj) => {
        this.selectionBoxes.add(new THREE.BoxHelper(obj, 0xffff00));
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
      if (handle.name.includes('center')) {
        handle.visible = this.gizmoMode === 'scale';
      }
      handle.material.color.copy(color);
    });
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.orbitControls.update();

    if (this.groupBoundingBoxMesh && this.appState.selectedObjects.length > 1) {
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
    if (this.renderer.domElement.width !== window.innerWidth || this.renderer.domElement.height !== window.innerHeight) {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.viewportManager.onWindowResize();
    }
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
        try {
          SceneIO.loadFromData(this.appContext, JSON.parse(data));
        } catch (e) {
          console.error('自動保存データの復元に失敗', e);
          this.log('自動保存データの復元に失敗しました');
        }
      }
      this.log('初期化完了');
      this.viewportManager.onWindowResize();
    });

    this.animate();
  }
}
