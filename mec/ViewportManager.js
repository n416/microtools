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

    // ドラッグ中（不透明）のワイヤーフレーム用マテリアル
    this.wireframeMaterialOpaque = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      depthTest: false, // 常に手前に描画
    });

    // 静止時（透明）のワイヤーフレーム用マテリアル
    this.wireframeMaterialTransparent = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      depthTest: false, // 常に手前に描画
      transparent: true,
      opacity: 0,
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
  /**
   * render関数
   * アプリケーションのメインループから毎フレーム呼び出され、
   * 4つのビューポート（top, perspective, side, front）すべてを描画する責務を持つ。
   * @param {object} appState - アプリケーション全体の現在の状態（UIのチェック状態など）を保持するオブジェクト
   */
  render(appState) {
    // --- 準備 1: 初期化チェック ---
    // レンダラーや各種コントローラー（TransformControls, SelectionBox）が
    // まだセットされていない場合は、何もせずに処理を中断する。
    if (!this.renderer || !this.transformControls || !this.selectionBoxes) return;

    // --- 準備 2: ヘルパーオブジェクトの取得 ---
    // シーンから名前を頼りに、各ビューで表示/非表示を切り替えるヘルパーオブジェクトを取得しておく。
    const perspectiveGrid = this.scene.getObjectByName('PerspectiveGrid'); // パースビュー用グリッド
    const gridXZ = this.scene.getObjectByName('GridHelperXZ'); // 上面図用グリッド (X-Z平面)
    const gridXY = this.scene.getObjectByName('GridHelperXY'); // 正面図用グリッド (X-Y平面)
    const gridYZ = this.scene.getObjectByName('GridHelperYZ'); // 側面図用グリッド (Y-Z平面)
    const axisX = this.scene.getObjectByName('AxisX'); // X軸
    const axisY = this.scene.getObjectByName('AxisY'); // Y軸
    const axisZ = this.scene.getObjectByName('AxisZ'); // Z軸

    // --- 全ビューポートのループ処理 ---
    // 'top', 'perspective', 'side', 'front' の各ビューポートに対して描画処理を繰り返す。
    for (const key in this.viewports) {
      const view = this.viewports[key];
      // 1. ビューポートに対応するHTML要素の、画面上での位置とサイズを取得する。
      const rect = view.element.getBoundingClientRect();

      // 2. ビューポートが完全に画面外にある場合は、描画処理をスキップして次のビューへ（パフォーマンス最適化）。
      if (rect.bottom < 0 || rect.top > this.renderer.domElement.clientHeight || rect.right < 0 || rect.left > this.renderer.domElement.clientWidth) continue;

      // 3. WebGLの座標系（左下が原点）に合わせて、描画領域を計算する。
      const width = rect.right - rect.left;
      const height = rect.bottom - rect.top;
      const left = rect.left;
      // CSSのY座標（上が0）をWebGLのY座標（下が0）に変換する。
      const bottom = this.renderer.domElement.clientHeight - rect.bottom;

      // 4. レンダラーに、このビュー専用の描画領域とクリッピング領域（シザー）を設定する。
      this.renderer.setViewport(left, bottom, width, height);
      this.renderer.setScissor(left, bottom, width, height);
      this.renderer.setScissorTest(true); // シザーテストを有効にし、設定した領域外にはみ出して描画されるのを防ぐ。
      this.renderer.setClearColor(view.background); // このビューの背景色を設定する。

      // --- 事前準備: ヘルパー類の表示/非表示を一括で設定 ---
      // 各ビューに応じて、表示すべきグリッドを切り替える。
      if (gridXZ) gridXZ.visible = key === 'top';
      if (gridXY) gridXY.visible = key === 'front';
      if (gridYZ) gridYZ.visible = key === 'side';
      if (axisX) axisX.visible = true; // 軸は常に表示
      if (axisY) axisY.visible = true;
      if (axisZ) axisZ.visible = true;
      if (perspectiveGrid) perspectiveGrid.visible = key === 'perspective';

      // --- ビューの種類（2Dか3Dか）による描画処理の分岐 ---
      if (view.camera.isOrthographicCamera) {
        // 【第一描画】ソリッド描画パス
        // ドラッグ中ではないオブジェクト(mechaGroup)を一時的に非表示にする
        this.mechaGroup.visible = false;

        // シーンを一度描画する。
        // これにより、シーン直下にいるドラッグ中のオブジェクト(transformGroup)と、
        // グリッドなどのヘルパーだけがソリッドで描画される。
        this.scene.overrideMaterial = null;
        this.renderer.render(this.scene, view.camera);

        // 次のパスのために、非表示にしたmechaGroupを元に戻す
        this.mechaGroup.visible = true;

        // 【第二描画】ワイヤーフレーム描画パス
        if (appState.isWireframeOverlay) {
          this.renderer.autoClear = false; // 前回の描画を消さずに重ねる

          const originalMaterials = new Map();

          // ワイヤーフレームマテリアルに差し替えるヘルパー関数
          const applyWireframe = (object) => {
            if (object.isMesh) {
              originalMaterials.set(object, object.material);
              // 前回の修正で追加したOpaque（不透明）なマテリアルを使用
              object.material = this.wireframeMaterialOpaque;
            }
          };

          // 元のマテリアルに戻すヘルパー関数
          const restoreMaterial = (object) => {
            if (object.isMesh && originalMaterials.has(object)) {
              object.material = originalMaterials.get(object);
            }
          };

          // 静止オブジェクト(mechaGroup)にワイヤーフレームを描画
          this.mechaGroup.traverse(applyWireframe);
          this.renderer.render(this.mechaGroup, view.camera);
          this.mechaGroup.traverse(restoreMaterial);

          // ドラッグ中のオブジェクト(transformGroup)があれば、それにもワイヤーフレームを描画
          if (appState.transformGroup) {
            appState.transformGroup.traverse(applyWireframe);
            this.renderer.render(appState.transformGroup, view.camera);
            appState.transformGroup.traverse(restoreMaterial);
          }
        }

        // 【第三描画】選択枠とギズモの描画
        this.renderer.autoClear = false;
        this.renderer.render(this.selectionBoxes, view.camera);
        this.updateScaleGizmo(key, appState);
        if (this.scaleGizmoGroup.visible) {
          this.renderer.render(this.scaleGizmoGroup, view.camera);
        }
      } else {
        // --- 3Dビュー (パース) の処理 ---
        // 3Dビューは単純にシーンを一度描画するだけ。

        // パースビュー専用のグリッドを表示状態にする。
        const perspectiveGrid = this.scene.getObjectByName('PerspectiveGrid');
        if (perspectiveGrid) perspectiveGrid.visible = true;

        // 2Dビュー用のカスタムスケールギズモは非表示にする。
        this.scaleGizmoGroup.visible = false;
        // TransformControls(移動/回転/拡縮ギズモ)の表示/非表示をアプリの状態に応じて決定する。
        this.transformControls.visible = !!this.transformControls.object && !appState.modes.isMirrorCopyMode && !appState.modes.isPasteMode && !appState.isPaintMode;
        // シーン全体を描画する。
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
