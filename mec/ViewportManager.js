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
    this.gridHelper = this.scene.getObjectByName('GridHelper');
    this.wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.7 });

    this.viewports = {
      top: { element: document.getElementById('view-top'), camera: new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000), background: new THREE.Color(0x1a1a1a) },
      perspective: { element: document.getElementById('view-perspective'), camera: new THREE.PerspectiveCamera(75, 1, 0.1, 1000), background: new THREE.Color(0x282c34) },
      side: { element: document.getElementById('view-side'), camera: new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000), background: new THREE.Color(0x1a1a1a) },
      front: { element: document.getElementById('view-front'), camera: new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000), background: new THREE.Color(0x1a1a1a) },
    };

    this._setupCameras();
    this._setupEventListeners();
  }

  setRenderer(renderer) {
    this.renderer = renderer;
  }

  setControls(transformControls, orbitControls) {
      this.transformControls = transformControls;
      this.orbitControls = orbitControls;
  }

  _setupCameras() {
    this.viewports.perspective.camera.position.set(4, 3, 5);
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
        const frustumSize = 10;
        view.camera.left = (-frustumSize * aspect) / 2;
        view.camera.right = (frustumSize * aspect) / 2;
        view.camera.top = frustumSize / 2;
        view.camera.bottom = -frustumSize / 2;
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
      const dist = center.distanceTo(cam.position);
      const frustumSize = 10;
      const handleSize = 0.5;
      const handleVisibleSize = Math.max(((frustumSize * handleSize) / dist) * 1.5, 0.15);
      switch (viewportKey) {
        case 'top':
          this.scaleGizmoGroup.scale.set(size.x, size.z, 1);
          this.scaleGizmoGroup.rotation.set(-Math.PI / 2, 0, 0);
          this.scaleGizmoGroup.position.z += 0.01;
          this.scaleGizmoGroup.children.forEach((child) => {
            if (child.isMesh) child.scale.set(Math.max(1 / size.x, 0.15), Math.max(1 / size.z, 0.15), 1).multiplyScalar(handleVisibleSize);
          });
          break;
        case 'front':
          this.scaleGizmoGroup.scale.set(size.x, size.y, 1);
          this.scaleGizmoGroup.rotation.set(0, 0, 0);
          this.scaleGizmoGroup.position.z += 0.01;
          this.scaleGizmoGroup.children.forEach((child) => {
            if (child.isMesh) child.scale.set(Math.max(1 / size.x, 0.15), Math.max(1 / size.y, 0.15), 1).multiplyScalar(handleVisibleSize);
          });
          break;
        case 'side':
          this.scaleGizmoGroup.scale.set(size.z, size.y, 1);
          this.scaleGizmoGroup.rotation.set(0, Math.PI / 2, 0);
          this.scaleGizmoGroup.position.x += 0.01;
          this.scaleGizmoGroup.children.forEach((child) => {
            if (child.isMesh) child.scale.set(Math.max(1 / size.z, 0.15), Math.max(1 / size.y, 0.15), 1).multiplyScalar(handleVisibleSize);
          });
          break;
      }
      this.scaleGizmoGroup.updateMatrixWorld(true);
  }

  render(appState) {
    if (!this.renderer || !this.transformControls) return;

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

      if (view.camera.isOrthographicCamera) {
        this.updateScaleGizmo(key, appState);
        this.scaleGizmoGroup.updateMatrixWorld(true);
        const originalAutoClear = this.renderer.autoClear;
        this.renderer.autoClear = false;
        this.renderer.clear();

        this.mechaGroup.visible = false;
        this.transformControls.visible = false;
        this.renderer.render(this.scene, view.camera);

        this.mechaGroup.visible = true;
        this.gridHelper.visible = false;
        this.selectionBoxes.visible = false;
        this.scene.overrideMaterial = this.wireframeMaterial;
        this.renderer.render(this.scene, view.camera);
        this.scene.overrideMaterial = null;
        this.selectionBoxes.visible = true;
        this.gridHelper.visible = true;

        if (appState.selectedObjects.length > 0) {
          this.renderer.render(this.scaleGizmoGroup, view.camera);
        }
        this.renderer.autoClear = originalAutoClear;
      } else { // Perspective View
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
              return { key, rect };
          }
      }
      return null;
  }
}