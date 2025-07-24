import * as THREE from 'three';

export class ViewportManager {
  constructor(container, scene, mechaGroup, selectionBoxes, scaleGizmoGroup) {
    this.container = container;
    this.scene = scene;
    this.mechaGroup = mechaGroup;
    this.selectionBoxes = selectionBoxes;
    this.scaleGizmoGroup = scaleGizmoGroup;
    this.renderer = null;
    this.transformControls = null;
    this.orbitControls = null;

    this.wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      polygonOffset: true,
      polygonOffsetFactor: -1, // ポリゴンをカメラ側に引き寄せるためにマイナスに設定
      polygonOffsetUnits: -1, // こちらもマイナスに設定
    });

    this.viewports = {
      top: {element: document.getElementById('view-top'), camera: new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000), background: new THREE.Color(0x1a1a1a)},
      perspective: {element: document.getElementById('view-perspective'), camera: new THREE.PerspectiveCamera(75, 1, 0.1, 1000), background: new THREE.Color(0x282c34)},
      side: {element: document.getElementById('view-side'), camera: new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000), background: new THREE.Color(0x1a1a1a)},
      front: {element: document.getElementById('view-front'), camera: new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000), background: new THREE.Color(0x1a1a1a)},
    };

    this.frustumSize = 2.0;

    this._setupCameras();
    this._setupEventListeners();
  }

  setRenderer(renderer) {
    this.renderer = renderer;
  }

  setSelectionBoxes(selectionBoxes) {
    this.selectionBoxes = selectionBoxes;
  }

  setControls(transformControls, orbitControls) {
    this.transformControls = transformControls;
    this.orbitControls = orbitControls;
  }

  _setupCameras() {
    this.viewports.perspective.camera.position.set(1, 0.5, 0);
    this.viewports.perspective.camera.lookAt(0, 0, 0);
    this.viewports.top.camera.position.set(0, 10, 0);
    this.viewports.top.camera.lookAt(0, 0, 0);
    this.viewports.top.camera.up.set(0, 0, -1);
    this.viewports.front.camera.position.set(0, 0, 10);
    this.viewports.front.camera.lookAt(0, 0, 0);
    this.viewports.side.camera.position.set(10, 0, 0);
    this.viewports.side.camera.lookAt(0, 0, 0);
  }

  _setupEventListeners() {
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  onWindowResize() {
    for (const key in this.viewports) {
      const view = this.viewports[key];
      const rect = view.element.getBoundingClientRect();
      const aspect = rect.width / rect.height;
      if (view.camera.isPerspectiveCamera) {
        view.camera.aspect = aspect;
      } else {
        view.camera.left = (-this.frustumSize * aspect) / 2;
        view.camera.right = (this.frustumSize * aspect) / 2;
        view.camera.top = this.frustumSize / 2;
        view.camera.bottom = -this.frustumSize / 2;
      }
      view.camera.updateProjectionMatrix();
    }
  }

  updateScaleGizmo(viewportKey, appState) {
    const selectedObjects = appState.selectedObjects;
    if (selectedObjects.length === 0 || viewportKey === 'perspective') {
      this.scaleGizmoGroup.visible = false;
      return;
    }
    const box = new THREE.Box3();
    selectedObjects.forEach((obj) => {
      box.expandByObject(obj);
    });
    if (box.isEmpty()) {
      this.scaleGizmoGroup.visible = false;
      return;
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    if (size.x === 0) size.x = 0.001;
    if (size.y === 0) size.y = 0.001;
    if (size.z === 0) size.z = 0.001;
    this.scaleGizmoGroup.visible = true;
    this.scaleGizmoGroup.position.copy(center);
    this.scaleGizmoGroup.renderOrder = 999;
    const cam = this.viewports[viewportKey].camera;
    const viewHeight = cam.top - cam.bottom;
    const handleScreenFraction = 0.025;
    const handleWorldSize = viewHeight * handleScreenFraction;
    const handleBaseSize = 0.5;
    const handleScalar = handleWorldSize / handleBaseSize;
    switch (viewportKey) {
      case 'top':
        this.scaleGizmoGroup.scale.set(size.x, size.z, 1);
        this.scaleGizmoGroup.rotation.set(-Math.PI / 2, 0, 0);
        this.scaleGizmoGroup.children.forEach((child) => {
          if (child.isMesh) {
            child.scale.set(1 / size.x, 1 / size.z, 1).multiplyScalar(handleScalar);
          }
        });
        break;
      case 'front':
        this.scaleGizmoGroup.scale.set(size.x, size.y, 1);
        this.scaleGizmoGroup.rotation.set(0, 0, 0);
        this.scaleGizmoGroup.children.forEach((child) => {
          if (child.isMesh) {
            child.scale.set(1 / size.x, 1 / size.y, 1).multiplyScalar(handleScalar);
          }
        });
        break;
      case 'side':
        this.scaleGizmoGroup.scale.set(size.z, size.y, 1);
        this.scaleGizmoGroup.rotation.set(0, Math.PI / 2, 0);
        this.scaleGizmoGroup.children.forEach((child) => {
          if (child.isMesh) {
            child.scale.set(1 / size.z, 1 / size.y, 1).multiplyScalar(handleScalar);
          }
        });
        break;
    }
    this.scaleGizmoGroup.updateMatrixWorld(true);
  }

  render(appState) {
    if (!this.renderer || !this.transformControls || !this.selectionBoxes) return;

    const perspectiveGrid = this.scene.getObjectByName('PerspectiveGrid');
    const gridXZ = this.scene.getObjectByName('GridHelperXZ');
    const gridXY = this.scene.getObjectByName('GridHelperXY');
    const gridYZ = this.scene.getObjectByName('GridHelperYZ');
    const axisX = this.scene.getObjectByName('AxisX');
    const axisY = this.scene.getObjectByName('AxisY');
    const axisZ = this.scene.getObjectByName('AxisZ');

    if (perspectiveGrid) perspectiveGrid.visible = false;
    if (gridXZ) gridXZ.visible = false;
    if (gridXY) gridXY.visible = false;
    if (gridYZ) gridYZ.visible = false;
    if (axisX) axisX.visible = false;
    if (axisY) axisY.visible = false;
    if (axisZ) axisZ.visible = false;

    for (const key in this.viewports) {
      const view = this.viewports[key];
      const rect = view.element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > this.renderer.domElement.clientHeight || rect.right < 0 || rect.left > this.renderer.domElement.clientWidth) continue;

      const width = rect.right - rect.left;
      const height = rect.bottom - rect.top;
      const left = rect.left;
      const bottom = this.renderer.domElement.clientHeight - rect.bottom;

      this.renderer.setViewport(left, bottom, width, height);
      this.renderer.setScissor(left, bottom, width, height);
      this.renderer.setScissorTest(true);
      this.renderer.setClearColor(view.background);

      // renderメソッド内の for (const key in this.viewports) { ... } ループを探してください

     if (view.camera.isOrthographicCamera) {
        const rect = view.element.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > this.renderer.domElement.clientHeight || rect.right < 0 || rect.left > this.renderer.domElement.clientWidth) continue;

        const width = rect.right - rect.left;
        const height = rect.bottom - rect.top;
        const left = rect.left;
        const bottom = this.renderer.domElement.clientHeight - rect.bottom;

        this.renderer.setViewport(left, bottom, width, height);
        this.renderer.setScissor(left, bottom, width, height);
        this.renderer.setScissorTest(true);
        this.renderer.setClearColor(view.background);

        // --- 確実な描画ロジック ---

        // 1. このビューで表示すべきグリッドや軸を設定
        const perspectiveGrid = this.scene.getObjectByName('PerspectiveGrid');
        if (perspectiveGrid) perspectiveGrid.visible = false;
        
        const gridXZ = this.scene.getObjectByName('GridHelperXZ');
        if (gridXZ) gridXZ.visible = (key === 'top');
        const gridXY = this.scene.getObjectByName('GridHelperXY');
        if (gridXY) gridXY.visible = (key === 'front');
        const gridYZ = this.scene.getObjectByName('GridHelperYZ');
        if (gridYZ) gridYZ.visible = (key === 'side');
        
        const axisX = this.scene.getObjectByName('AxisX');
        if (axisX) axisX.visible = (key === 'top' || key === 'front');
        const axisY = this.scene.getObjectByName('AxisY');
        if (axisY) axisY.visible = (key === 'front' || key === 'side');
        const axisZ = this.scene.getObjectByName('AxisZ');
        if (axisZ) axisZ.visible = (key === 'top' || key === 'side');
        
        this.mechaGroup.visible = true;
        this.selectionBoxes.visible = true;
        this.updateScaleGizmo(key, appState);

        // 2. 【第一描画】シーン全体を通常通り描画（ここで手順1のライトが適用される）
        this.renderer.autoClear = true; // 最初にビューポートをクリア
        this.scene.overrideMaterial = null;
        this.renderer.render(this.scene, view.camera);
        
        // 3. 【第二描画】ワイヤーフレームが有効な場合、上から重ねて描画
        if (appState.isWireframeOverlay) {
            this.renderer.autoClear = false; // 前の描画を消さない！
            this.scene.overrideMaterial = this.wireframeMaterial;
            this.renderer.render(this.mechaGroup, view.camera);
            this.scene.overrideMaterial = null; // 必ず元に戻す
        }
        
        // 4. 【第三描画】スケールギズモを常に最前面に描画
        if (this.scaleGizmoGroup.visible) {
            this.renderer.autoClear = false; // 前の描画を消さない！
            this.renderer.render(this.scaleGizmoGroup, view.camera);
        }
        
      } else {
      // ▲▲▲ 差し替えはここまで ▲▲▲

        // --- Perspectiveカメラの処理（ここは変更なし）---
        const perspectiveGrid = this.scene.getObjectByName('PerspectiveGrid');
        if (perspectiveGrid) perspectiveGrid.visible = true;
        this.scaleGizmoGroup.visible = false;
        this.transformControls.visible = !!this.transformControls.object && !appState.modes.isMirrorCopyMode && !appState.modes.isPasteMode && !appState.isPaintMode;
        this.renderer.render(this.scene, view.camera);
      }
      
    }
  }

  getViewportFromEvent(event) {
    for (const key in this.viewports) {
      const view = this.viewports[key];
      const rect = view.element.getBoundingClientRect();
      if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
        return {key, rect};
      }
    }
    return null;
  }
}
