import * as THREE from 'three';
import {TransformCommand, MacroCommand, DeleteObjectCommand} from './CommandEdit.js';
import {ChangeColorCommand} from './CommandPaint.js';
import * as CsgOperations from './CsgOperations.js';
import * as ClipboardFeatures from './ClipboardFeatures.js';

export class InputHandler {
  constructor(appContext) {
    this.appContext = appContext;
    this.viewportManager = appContext.viewportManager;
    this.appState = appContext.state;
    this.history = appContext.history;
    this.transformControls = appContext.transformControls;
    this.mechaGroup = appContext.mechaGroup;
    this.previewGroup = appContext.previewGroup;
    this.log = appContext.log;

    // 入力状態の管理
    this.isPanning2D = false;
    this.panStart = {x: 0, y: 0};
    this.cameraStartPos = new THREE.Vector3();
    this.panningViewportKey = null;

    this.isBoxSelecting = false;
    this.selectionBoxElement = document.getElementById('selection-box');
    this.startPoint = new THREE.Vector2();

    this.isDraggingIn2DView = false;
    this.isScalingIn2DView = false;
    this.isRotatingIn2DView = false;
    this.dragStartPointer = new THREE.Vector2();
    this.draggedInfo = null;
    this.transformStartCache = null;
    this.dragStartObjectState = {position: new THREE.Vector3(), scale: new THREE.Vector3(), rotation: new THREE.Euler()};
    this.worldTransforms = new Map();
    this.transformGroup = null;

    this.isSpacebarDown = false;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
  }

  initialize() {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    window.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));
    window.addEventListener('contextmenu', this.onContextMenu.bind(this));
  }

  onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // ペイントモード時の色調整
    if (this.appState.isPaintMode && !this.appState.isEyedropperMode) {
      let colorChanged = false;
      const hsl = {};
      this.appState.currentColor.getHSL(hsl);
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
        this.appState.currentColor.setHSL(hsl.h, hsl.s, hsl.l);
        // UI更新はmain.jsの責務
        document.dispatchEvent(new CustomEvent('updateCurrentColorDisplay'));
        this.log(`色調整: H:${hsl.h.toFixed(2)} S:${hsl.s.toFixed(2)} L:${hsl.l.toFixed(2)}`);
        return;
      }
    }

    // Undo/Redo/Copy/Paste
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          e.shiftKey ? this.history.redo() : this.history.undo();
          return;
        case 'y':
          e.preventDefault();
          this.history.redo();
          return;
        case 'c':
          e.preventDefault();
          const selectedObjectsCopy = this.appState.selectedObjects;
          if (selectedObjectsCopy.length > 0) {
            this.appState.modes.clipboard = selectedObjectsCopy.map((obj) => ({geometry: obj.geometry, material: obj.material, source: {scale: obj.scale.clone(), rotation: obj.rotation.clone(), position: obj.position.clone()}}));
            this.log(`${selectedObjectsCopy.length}個のオブジェクトをコピーしました。`);
          } else {
            this.log('コピーするオブジェクトが選択されていません。');
          }
          return;
        case 'v':
          e.preventDefault();
          if (!this.appState.modes.clipboard) {
            this.log('クリップボードが空です。');
            return;
          }
          const lastSelectedIds = this.appState.modes.lastPasteInfo.objects.map((o) => o.uuid);
          const currentSelectedIds = this.appState.selectedObjects.map((o) => o.uuid);
          const isSameSelection = lastSelectedIds.length === currentSelectedIds.length && lastSelectedIds.every((id) => currentSelectedIds.includes(id));

          if (isSameSelection && lastSelectedIds.length > 0) {
            ClipboardFeatures.performDirectPaste(this.appContext);
          } else {
            ClipboardFeatures.startPastePreview(this.appContext);
          }
          return;
      }
    }

    // パンモード（スペースキー）
    if (e.key === ' ' && !this.isSpacebarDown) {
      e.preventDefault();
      this.isSpacebarDown = true;
      this.appContext.orbitControls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      for (const key in this.viewportManager.viewports) {
        this.viewportManager.viewports[key].element.style.cursor = 'grab';
      }
      return;
    }

    // 各種モードのキャンセル
    if (this.appState.modes.isMirrorCopyMode && e.key === 'Escape') {
      ClipboardFeatures.cancelMirrorCopyMode(this.appContext);
      this.log('鏡面コピーモードをキャンセルしました。');
      return;
    }
    if (this.appState.modes.isPasteMode && e.key === 'Escape') {
      ClipboardFeatures.cancelPasteMode(this.appContext);
      this.log('貼り付けをキャンセルしました。');
      return;
    }
    if (this.appState.modes.isSubtractMode && e.key === 'Escape') {
      CsgOperations.cancelSubtractMode(this.appContext);
      return;
    }

    // TransformControlsのモード切替
    switch (e.key.toLowerCase()) {
      case 't':
        this.transformControls.setMode('translate');
        this.log('モード -> 移動 (3Dビュー)');
        break;
      case 'r':
        this.transformControls.setMode('rotate');
        document.dispatchEvent(new CustomEvent('setGizmoMode', {detail: 'rotate'}));
        this.log('モード -> 回転 (3D/2Dビュー)');
        break;
      case 's':
        this.transformControls.setMode('scale');
        document.dispatchEvent(new CustomEvent('setGizmoMode', {detail: 'scale'}));
        this.log('モード -> 拡縮 (3D/2Dビュー)');
        break;
    }

    // 選択オブジェクトの操作（矢印キー）
    const selectedObjects = this.appState.selectedObjects;
    if (selectedObjects.length === 0) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedObjects.length > 0) {
        const commands = selectedObjects.map((obj) => new DeleteObjectCommand(obj, this.mechaGroup));
        this.history.execute(new MacroCommand(commands, `選択した ${selectedObjects.length} 個のオブジェクトを削除`));
        this.appState.clearSelection();
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
      this.history.execute(new MacroCommand(commands, `選択した ${commands.length} 個のオブジェクトを変形`));
    }
  }

  onKeyUp(e) {
    if (e.key === ' ') {
      this.isSpacebarDown = false;
      if (!this.appContext.isPanModeActive) {
        // isPanModeActive は main.js で管理
        this.appContext.orbitControls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      }
      for (const key in this.viewportManager.viewports) {
        this.viewportManager.viewports[key].element.style.cursor = 'default';
      }
    }
  }

  onPointerDown(event) {
    if (event.target.closest('#ui') || this.transformControls.dragging) return;

    const clickedViewportInfo = this.viewportManager.getViewportFromEvent(event);

    const start2DPan = (e, viewportKey) => {
      if (viewportKey && viewportKey !== 'perspective') {
        this.isPanning2D = true;
        this.panningViewportKey = viewportKey;
        this.panStart.x = e.clientX;
        this.panStart.y = e.clientY;
        this.cameraStartPos.copy(this.viewportManager.viewports[this.panningViewportKey].camera.position);
        this.appContext.orbitControls.enabled = false;
        this.viewportManager.viewports[clickedViewportInfo.key].element.style.cursor = 'grabbing';
      }
    };

    if (event.button === 2) {
      if (clickedViewportInfo) start2DPan(event, clickedViewportInfo.key);
      return;
    }

    if (event.button === 0) {
      if (!clickedViewportInfo) return;
      const {key: clickedViewportKey, rect: clickedRect} = clickedViewportInfo;

      if ((this.appContext.isPanModeActive || this.isSpacebarDown) && clickedViewportKey === 'perspective') return;
      if ((this.appContext.isPanModeActive || this.isSpacebarDown) && clickedViewportKey !== 'perspective') {
        start2DPan(event, clickedViewportKey);
        return;
      }

      this.startPoint.set(event.clientX, event.clientY);

      if (this.appState.modes.isMirrorCopyMode || this.appState.modes.isSubtractMode || this.appState.modes.isPasteMode || this.appState.isPaintMode || this.appState.isEyedropperMode) return;

      const clickedViewport = this.viewportManager.viewports[clickedViewportKey];
      this.pointer.x = ((event.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, clickedViewport.camera);

      this.viewportManager.updateScaleGizmo(clickedViewportKey, this.appState);

      const is2DView = clickedViewportKey !== 'perspective';
      const allObjectIntersects = this.raycaster.intersectObjects(this.mechaGroup.children, true);
      const clickedObject = allObjectIntersects.length > 0 ? allObjectIntersects[0].object : null;

      if (is2DView && this.appState.selectedObjects.length > 0) {
        const gizmoHandles = this.appContext.gizmoHandles; // main.js から gizmoHandles を取得
        const handleIntersects = this.raycaster.intersectObjects(gizmoHandles, true);

        const setupTransformState = () => {
          this.appContext.orbitControls.enabled = false;
          this.dragStartPointer.set(event.clientX, event.clientY);
          this.transformStartCache = this.appState.selectedObjects.map((obj) => ({position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone()}));
        };
        const setupMultiSelectGroup = () => {
          const groupBounds = new THREE.Box3();
          this.appState.selectedObjects.forEach((obj) => groupBounds.expandByObject(obj));
          groupBounds.getCenter(this.dragStartObjectState.position);
          groupBounds.getSize(this.dragStartObjectState.scale);
          this.worldTransforms.clear();
          this.appState.selectedObjects.forEach((obj) => this.worldTransforms.set(obj, {parent: obj.parent}));
          if (this.transformGroup) this.appContext.scene.remove(this.transformGroup);
          this.transformGroup = new THREE.Group();
          this.transformGroup.position.copy(this.dragStartObjectState.position);
          this.appContext.scene.add(this.transformGroup);
          this.appState.selectedObjects.forEach((obj) => this.transformGroup.attach(obj));
        };

        if (handleIntersects.length > 0) {
          setupTransformState();
          // ★★★ 修正: 単体選択でもグループ化処理を呼ぶように統一 ★★★
          setupMultiSelectGroup();
          if (this.appContext.gizmoMode === 'scale') this.isScalingIn2DView = true;
          else if (this.appContext.gizmoMode === 'rotate') this.isRotatingIn2DView = true;
          this.draggedInfo = {viewportKey: clickedViewportKey, handleName: handleIntersects[0].object.name};
          return;
        }

        if (clickedObject && this.appState.selectedObjects.includes(clickedObject) && !event.shiftKey && !event.ctrlKey) {
          setupTransformState();
          this.isDraggingIn2DView = true;
          // ★★★ 修正: 単体選択でもグループ化処理を呼ぶように統一 ★★★
          setupMultiSelectGroup();
          this.draggedInfo = {viewportKey: clickedViewportKey, handleName: null};
          return;
        }
      }

      const isGizmoHit = !is2DView && this.transformControls.object && this.transformControls.pointerOver;
      if (!clickedObject && !isGizmoHit) {
        this.isBoxSelecting = true;
        this.selectionBoxElement.style.display = 'block';
        this.appContext.orbitControls.enabled = false;
      }
    }
  }

  onPointerMove(event) {
    if (this.isPanning2D) {
      const view = this.viewportManager.viewports[this.panningViewportKey];
      const rect = view.element.getBoundingClientRect();
      const frustumSize = 10;
      const aspect = rect.width / rect.height;
      const deltaX = ((event.clientX - this.panStart.x) / rect.width) * frustumSize * aspect;
      const deltaY = ((event.clientY - this.panStart.y) / rect.height) * frustumSize;
      const camera = view.camera;

      switch (this.panningViewportKey) {
        case 'top':
          camera.position.x = this.cameraStartPos.x - deltaX;
          camera.position.z = this.cameraStartPos.z - deltaY;
          break;
        case 'front':
          camera.position.x = this.cameraStartPos.x - deltaX;
          camera.position.y = this.cameraStartPos.y + deltaY;
          break;
        case 'side':
          camera.position.z = this.cameraStartPos.z + deltaX;
          camera.position.y = this.cameraStartPos.y + deltaY;
          break;
      }
      return;
    }

    if (this.isBoxSelecting) {
      const currentX = event.clientX;
      const currentY = event.clientY;
      const left = Math.min(this.startPoint.x, currentX);
      const top = Math.min(this.startPoint.y, currentY);
      const width = Math.abs(this.startPoint.x - currentX);
      const height = Math.abs(this.startPoint.y - currentY);
      this.selectionBoxElement.style.left = `${left}px`;
      this.selectionBoxElement.style.top = `${top}px`;
      this.selectionBoxElement.style.width = `${width}px`;
      this.selectionBoxElement.style.height = `${height}px`;
      return;
    }

    if (!this.isDraggingIn2DView && !this.isScalingIn2DView && !this.isRotatingIn2DView) return;
    event.preventDefault();

    const view = this.viewportManager.viewports[this.draggedInfo.viewportKey];
    const rect = view.element.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    const frustumSize = 10;
    const worldDeltaX = ((event.clientX - this.dragStartPointer.x) / rect.width) * frustumSize * aspect;
    const worldDeltaY = ((event.clientY - this.dragStartPointer.y) / rect.height) * frustumSize;

    // ★★★ 修正: 単体選択時のロジックを削除し、グループ操作に一本化 ★★★
    if (this.transformGroup) {
      if (this.isDraggingIn2DView) {
        const worldDelta = new THREE.Vector3();
        switch (this.draggedInfo.viewportKey) {
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
        this.transformGroup.position.copy(this.dragStartObjectState.position).add(worldDelta);
      } else if (this.isRotatingIn2DView) {
        const center3D = this.dragStartObjectState.position;
        const centerProjected = center3D.clone().project(view.camera);
        const centerX = (centerProjected.x * 0.5 + 0.5) * rect.width + rect.left;
        const centerY = (-centerProjected.y * 0.5 + 0.5) * rect.height + rect.top;
        const centerOnScreen = new THREE.Vector2(centerX, centerY);
        const startVec = new THREE.Vector2().subVectors(this.dragStartPointer, centerOnScreen);
        const currentVec = new THREE.Vector2(event.clientX, event.clientY).sub(centerOnScreen);
        // ★ 修正: 変数を let で宣言し、回転方向を修正
        let deltaAngle = Math.atan2(startVec.y, startVec.x) - Math.atan2(currentVec.y, currentVec.x);

        // ★ 追加: SHIFTキーが押されている場合、角度を22.5度単位でスナップさせる
        if (event.shiftKey) {
          const snapAngle = THREE.MathUtils.degToRad(22.5);
          deltaAngle = Math.round(deltaAngle / snapAngle) * snapAngle;
        }
        
        const axis = new THREE.Vector3();
        switch (this.draggedInfo.viewportKey) {
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
        this.transformGroup.quaternion.setFromAxisAngle(axis, deltaAngle);
      } else if (this.isScalingIn2DView) {
        const oldSize = this.dragStartObjectState.scale;
        const newSize = oldSize.clone();
        const newCenter = this.dragStartObjectState.position.clone();
        let u_change = 0,
          v_change = 0,
          axisU,
          axisV;
        switch (this.draggedInfo.viewportKey) {
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
        const u_multiplier = this.draggedInfo.viewportKey === 'side' ? (this.draggedInfo.handleName.includes('left') ? 1 : this.draggedInfo.handleName.includes('right') ? -1 : 0) : this.draggedInfo.handleName.includes('left') ? -1 : this.draggedInfo.handleName.includes('right') ? 1 : 0;
        const v_multiplier = this.draggedInfo.viewportKey === 'top' ? (this.draggedInfo.handleName.includes('top') ? -1 : this.draggedInfo.handleName.includes('bottom') ? 1 : 0) : this.draggedInfo.handleName.includes('top') ? 1 : this.draggedInfo.handleName.includes('bottom') ? -1 : 0;
        const scaleChangeU = u_change * u_multiplier;
        const scaleChangeV = v_change * v_multiplier;
        if (u_multiplier !== 0 && oldSize[axisU] + scaleChangeU > 0.01) {
          newSize[axisU] = oldSize[axisU] + scaleChangeU;
          newCenter[axisU] = this.dragStartObjectState.position[axisU] - (oldSize[axisU] / 2) * u_multiplier + (newSize[axisU] / 2) * u_multiplier;
        }
        if (v_multiplier !== 0 && oldSize[axisV] + scaleChangeV > 0.01) {
          newSize[axisV] = oldSize[axisV] + scaleChangeV;
          newCenter[axisV] = this.dragStartObjectState.position[axisV] - (oldSize[axisV] / 2) * v_multiplier + (newSize[axisV] / 2) * v_multiplier;
        }
        const scaleFactor = new THREE.Vector3(oldSize.x !== 0 ? newSize.x / oldSize.x : 1, oldSize.y !== 0 ? newSize.y / oldSize.y : 1, oldSize.z !== 0 ? newSize.z / oldSize.z : 1);
        this.transformGroup.position.copy(newCenter);
        this.transformGroup.scale.copy(scaleFactor);
      }
    }
  }

  onPointerUp(e) {
    if (this.isPanning2D) {
      const newCursor = this.isSpacebarDown ? 'grab' : 'default';
      this.viewportManager.viewports[this.panningViewportKey].element.style.cursor = newCursor;
      this.isPanning2D = false;
      this.panningViewportKey = null;
      this.appContext.orbitControls.enabled = true;
      return;
    }

    if (this.isBoxSelecting) {
      this.selectionBoxElement.style.display = 'none';
      this.isBoxSelecting = false;
      this.appContext.orbitControls.enabled = true;
      const endPoint = new THREE.Vector2(e.clientX, e.clientY);
      if (this.startPoint.distanceTo(endPoint) < 5) {
        if (!e.ctrlKey && !e.shiftKey && !this.appState.isMultiSelectMode) {
          this.appState.clearSelection();
          this.log('待機中');
        }
        return;
      }
      const boxRect = {left: Math.min(this.startPoint.x, endPoint.x), right: Math.max(this.startPoint.x, endPoint.x), top: Math.min(this.startPoint.y, endPoint.y), bottom: Math.max(this.startPoint.y, endPoint.y)};
      const objectsInBox = [];
      for (const key in this.viewportManager.viewports) {
        const view = this.viewportManager.viewports[key];
        const rect = view.element.getBoundingClientRect();
        if (boxRect.left > rect.right || boxRect.right < rect.left || boxRect.top > rect.bottom || boxRect.bottom < rect.top) continue;
        this.mechaGroup.children.forEach((mesh) => {
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

      const currentSelection = this.appState.selectedObjects.slice();
      if (e.ctrlKey) {
        objectsInBox.forEach((obj) => {
          const index = currentSelection.indexOf(obj);
          if (index > -1) {
            currentSelection.splice(index, 1);
          } else {
            currentSelection.push(obj);
          }
        });
        this.appState.setSelection(currentSelection);
      } else if (e.shiftKey || this.appState.isMultiSelectMode) {
        objectsInBox.forEach((obj) => {
          if (!currentSelection.includes(obj)) {
            currentSelection.push(obj);
          }
        });
        this.appState.setSelection(currentSelection);
      } else {
        this.appState.setSelection(objectsInBox);
      }
      this.log(`${this.appState.selectedObjects.length}個のオブジェクトを選択中`);
      return;
    }

    if (this.isDraggingIn2DView || this.isScalingIn2DView || this.isRotatingIn2DView) {
      const selectedObjects = this.appState.selectedObjects;
      if (this.transformGroup) {
        selectedObjects.forEach((obj) => {
          this.worldTransforms.get(obj).parent.attach(obj);
        });
        this.appContext.scene.remove(this.transformGroup);
        this.transformGroup = null;
        this.worldTransforms.clear();
      }
      if (this.transformStartCache) {
        if (selectedObjects.length === 1) {
          const oldT = this.transformStartCache[0];
          const obj = selectedObjects[0];
          const newT = {position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone()};
          if (!oldT.position.equals(newT.position) || !oldT.rotation.equals(newT.rotation) || !oldT.scale.equals(newT.scale)) {
            this.history.execute(new TransformCommand(obj, oldT, newT));
          }
        } else if (selectedObjects.length > 1) {
          const commands = selectedObjects.map((obj, i) => {
            const oldT = this.transformStartCache[i];
            const newT = {position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone()};
            return new TransformCommand(obj, oldT, newT);
          });
          this.history.execute(new MacroCommand(commands, `選択した ${selectedObjects.length} 個のオブジェクトをグループ変形`));
        }
      }
      this.isDraggingIn2DView = this.isScalingIn2DView = this.isRotatingIn2DView = false;
      this.appContext.orbitControls.enabled = true;
      document.dispatchEvent(new CustomEvent('updateGizmoAppearance'));
      this.transformStartCache = null;
      this.appState.notifySelectionChange();
      return;
    }

    if (this.startPoint.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) < 5) {
      const clickedViewportInfo = this.viewportManager.getViewportFromEvent(e);
      if (!clickedViewportInfo) return;

      const {key: clickedViewportKey, rect: clickedRect} = clickedViewportInfo;
      const clickedViewport = this.viewportManager.viewports[clickedViewportKey];
      this.pointer.x = ((e.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, clickedViewport.camera);

      if (this.appState.isEyedropperMode) {
        const intersects = this.raycaster.intersectObjects(this.mechaGroup.children, false);
        if (intersects.length > 0) {
          const clickedObject = intersects[0].object;
          this.appState.currentColor.copy(clickedObject.material.color);
          document.dispatchEvent(new CustomEvent('updateCurrentColorDisplay'));
          this.log(`色を抽出: #${this.appState.currentColor.getHexString()}`);
        }
        document.dispatchEvent(new CustomEvent('setEyedropperMode', {detail: false}));
        return;
      }

      if (this.appState.isPaintMode) {
        const intersects = this.raycaster.intersectObjects(this.mechaGroup.children, false);
        if (intersects.length > 0) {
          const clickedObject = intersects[0].object;
          if (clickedObject.material.color.getHex() !== this.appState.currentColor.getHex()) {
            this.history.execute(new ChangeColorCommand(clickedObject, this.appState.currentColor));
          }
        }
        return;
      }

      if (this.appState.modes.isSubtractMode) {
        const intersects = this.raycaster.intersectObjects(this.mechaGroup.children, true);
        let drillObject = null;
        if (intersects.length > 0) {
          if (this.appState.modes.subtractTargets.includes(intersects[0].object)) {
            drillObject = intersects[0].object;
          }
        }
        if (drillObject) {
          const baseObjects = this.appState.modes.subtractTargets.filter((obj) => obj !== drillObject);
          if (baseObjects.length > 0) {
            CsgOperations.performSubtract(baseObjects, drillObject, this.appContext);
          } else {
            CsgOperations.cancelSubtractMode(this.appContext);
          }
        } else {
          this.log('掘削操作をキャンセルしました。');
          CsgOperations.cancelSubtractMode(this.appContext);
        }
        return;
      }

      if (this.appState.modes.isMirrorCopyMode) {
        const intersects = this.raycaster.intersectObjects(this.previewGroup.children, true);
        if (intersects.length > 0) {
          ClipboardFeatures.performMirrorCopy(intersects[0].object, this.appContext);
        } else {
          ClipboardFeatures.cancelMirrorCopyMode(this.appContext);
          this.log('鏡面コピーモードをキャンセルしました。');
        }
        return;
      }

      if (this.appState.modes.isPasteMode) {
        const intersects = this.raycaster.intersectObjects(this.previewGroup.children, true);
        if (intersects.length > 0) {
          ClipboardFeatures.confirmPaste(intersects[0].object, this.appContext);
        } else {
          ClipboardFeatures.cancelPasteMode(this.appContext);
          this.log('貼り付けをキャンセルしました。');
        }
        return;
      }

      const intersects = this.raycaster.intersectObjects(this.mechaGroup.children, false);
      const clickedObject = intersects.length > 0 ? intersects[0].object : null;

      if (e.ctrlKey) {
        this.appState.toggleSelection(clickedObject);
      } else if (e.shiftKey || this.appState.isMultiSelectMode) {
        this.appState.addSelection(clickedObject);
      } else {
        this.appState.setSelection(clickedObject);
      }

      if (this.appState.isMultiSelectMode && !clickedObject) {
        document.dispatchEvent(new CustomEvent('setMultiSelectMode', {detail: false}));
      }

      this.log(this.appState.selectedObjects.length > 0 ? `${this.appState.selectedObjects.length}個のオブジェクトを選択中` : '待機中');
    }
  }

  onContextMenu(event) {
    const clickedViewportInfo = this.viewportManager.getViewportFromEvent(event);
    if (clickedViewportInfo && clickedViewportInfo.key !== 'perspective') {
      event.preventDefault();
    }
  }
}
