import * as THREE from 'three';
import {TransformCommand, MacroCommand, DeleteObjectCommand} from './CommandEdit.js';
import {PaintObjectCommand} from './CommandPaint.js';
import * as CsgOperations from './CsgOperations.js';
import * as ClipboardFeatures from './ClipboardFeatures.js';
import * as PlacementFeatures from './PlacementFeatures.js';

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
    this.activePointerId = null;

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
    this.viewportManager.container.addEventListener('wheel', this.onMouseWheel.bind(this), {passive: false});
  }

  onMouseWheel(event) {
    const clickedViewportInfo = this.viewportManager.getViewportFromEvent(event);
    if (!clickedViewportInfo || clickedViewportInfo.key === 'perspective') {
      return;
    }
    event.preventDefault();
    const view = this.viewportManager.viewports[clickedViewportInfo.key];
    const camera = view.camera;
    const zoomAmount = event.deltaY * -0.001;
    camera.zoom = Math.max(0.1, Math.min(20, camera.zoom + zoomAmount * camera.zoom));
    camera.updateProjectionMatrix();
  }

  onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.appState.modes.isPlacementPreviewMode) {
        PlacementFeatures.cancelPlacementPreview(this.appContext);
        return;
      }
      if (this.appState.isLivePaintPreviewMode) {
        document.getElementById('cancelPaint').click();
        return;
      }
      if (this.appState.modes.isMirrorCopyMode) {
        document.getElementById('cancelMirrorCopy').click();
        return;
      }
      if (this.appState.modes.isPasteMode) {
        ClipboardFeatures.cancelPasteMode(this.appContext);
        this.log('貼り付けをキャンセルしました。');
        return;
      }
      if (this.appState.modes.isSubtractMode) {
        document.getElementById('cancelSubtract').click();
        return;
      }
      if (this.appState.isPaintMode) {
        document.getElementById('paintModeButton').click();
        return;
      }
      if (this.appContext.isPanModeActive) {
        document.getElementById('panModeButton').click();
        return;
      }
      if (this.appState.isMultiSelectMode) {
        document.getElementById('multiSelect').click();
        return;
      }
      if (this.appState.selectedObjects.length > 0) {
        this.appState.clearSelection();
        this.log('選択を解除しました。');
        return;
      }
      this.log('通常モードです。');
      return;
    }

    if (this.appState.isLivePaintPreviewMode) {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('confirmPaint').click();
      }
      return;
    }

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (this.appState.isPaintMode && !this.appState.isEyedropperMode) {
      let colorChanged = false;
      const hsl = {};
      this.appState.brushProperties.color.getHSL(hsl);
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
        this.appState.brushProperties.color.setHSL(hsl.h, hsl.s, hsl.l);
        document.dispatchEvent(new CustomEvent('updateCurrentColorDisplay'));
        this.log(`色調整: H:${hsl.h.toFixed(2)} S:${hsl.s.toFixed(2)} L:${hsl.l.toFixed(2)}`);
        return;
      }
    }

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
            this.appState.modes.clipboard = selectedObjectsCopy.map((obj) => ({
              geometry: obj.geometry,
              material: obj.material,
              userData: obj.userData,
              source: {scale: obj.scale.clone(), rotation: obj.rotation.clone(), position: obj.position.clone()},
            }));
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

    if (e.key === ' ' && !this.isSpacebarDown) {
      e.preventDefault();
      this.isSpacebarDown = true;
      this.appContext.orbitControls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      for (const key in this.viewportManager.viewports) {
        this.viewportManager.viewports[key].element.style.cursor = 'grab';
      }
      return;
    }

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
        this.appContext.orbitControls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      }
      for (const key in this.viewportManager.viewports) {
        this.viewportManager.viewports[key].element.style.cursor = 'default';
      }
    }
  }

  onPointerDown(event) {
    if (event.target.closest('#ui') || this.transformControls.dragging) return;
    if (this.activePointerId !== null) return;
    this.activePointerId = event.pointerId;

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

      if (this.appState.modes.isMirrorCopyMode || this.appState.modes.isSubtractMode || this.appState.modes.isPasteMode || this.appState.isPaintMode || this.appState.isEyedropperMode || this.appState.isLivePaintPreviewMode || this.appState.modes.isPlacementPreviewMode) return;

      const clickedViewport = this.viewportManager.viewports[clickedViewportKey];
      this.pointer.x = ((event.clientX - clickedRect.left) / clickedRect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - clickedRect.top) / clickedRect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, clickedViewport.camera);

      this.viewportManager.updateScaleGizmo(clickedViewportKey, this.appState);

      const is2DView = clickedViewportKey !== 'perspective';
      const allObjectIntersects = this.raycaster.intersectObjects(this.mechaGroup.children, true);
      const clickedObject = allObjectIntersects.length > 0 ? allObjectIntersects[0].object : null;

      if (is2DView && this.appState.selectedObjects.length > 0) {
        const gizmoHandles = this.appContext.gizmoHandles;
        const handleIntersects = this.raycaster.intersectObjects(gizmoHandles, true);

        const setupTransformState = () => {
          this.appContext.orbitControls.enabled = false;
          this.dragStartPointer.set(event.clientX, event.clientY);
          // 選択された各オブジェクトに対して、以下の処理を行う。
          this.appState.selectedObjects.forEach((obj) => {
            // 1. オブジェクトが回転しているか？ (Quaternionが初期状態ではないか？)
            const isRotated = !obj.quaternion.equals(new THREE.Quaternion());

            // 2. もし回転しており、かつ現在「簡易モード」(`matrixAutoUpdate = true`)であれば...
            if (isRotated && obj.matrixAutoUpdate === true) {
              // 3. オブジェクトを「専門モード」に切り替える。
              //    これにより、以降の変形は常に matrix が基準となり、シアー情報が失われなくなる。
              obj.matrixAutoUpdate = false;

              // 4. ★重要★ モード切替の瞬間に、現在のPRS(位置・回転・スケール)の状態を
              //    matrix に一度だけ正確に反映させる。これで情報の不整合が完全に解消される。
              obj.updateMatrix();
            }
          });

          this.transformStartCache = this.appState.selectedObjects.map((obj) => ({matrix: obj.matrix.clone()}));
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
          this.appState.transformGroup = this.transformGroup;

          this.transformGroup.position.copy(this.dragStartObjectState.position);
          this.appContext.scene.add(this.transformGroup);
          this.appState.selectedObjects.forEach((obj) => this.transformGroup.attach(obj));
        };

        if (handleIntersects.length > 0) {
          setupTransformState();
          setupMultiSelectGroup();
          if (this.appContext.gizmoMode === 'scale') {
            this.isScalingIn2DView = true;
          } else if (this.appContext.gizmoMode === 'rotate') {
            this.isRotatingIn2DView = true;
          }
          this.draggedInfo = {viewportKey: clickedViewportKey, handleName: handleIntersects[0].object.name};
          return;
        }

        if (clickedObject && this.appState.selectedObjects.includes(clickedObject) && !event.shiftKey && !event.ctrlKey) {
          setupTransformState();
          this.isDraggingIn2DView = true;
          this.appState.isDraggingObject = true;
          setupMultiSelectGroup();
          this.draggedInfo = {viewportKey: clickedViewportKey, handleName: null};
          return;
        }
      }

      const isGizmoHit = !is2DView && this.transformControls.object && this.transformControls.pointerOver;
      if (!clickedObject && !isGizmoHit) {
        this.isBoxSelecting = true;
        this.selectionBoxElement.style.left = `${this.startPoint.x}px`;
        this.selectionBoxElement.style.top = `${this.startPoint.y}px`;
        this.selectionBoxElement.style.width = '0px';
        this.selectionBoxElement.style.height = '0px';
        this.selectionBoxElement.style.display = 'block';
        this.appContext.orbitControls.enabled = false;
      }
    }
  }

  onPointerMove(event) {
    if (this.isPanning2D) {
      const view = this.viewportManager.viewports[this.panningViewportKey];
      const rect = view.element.getBoundingClientRect();
      const camera = view.camera;
      const effectiveFrustumSize = this.viewportManager.frustumSize / camera.zoom;
      const aspect = rect.width / rect.height;
      const deltaX = ((event.clientX - this.panStart.x) / rect.width) * effectiveFrustumSize * aspect;
      const deltaY = ((event.clientY - this.panStart.y) / rect.height) * effectiveFrustumSize;

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
    const effectiveFrustumSize = this.viewportManager.frustumSize / view.camera.zoom;
    let worldDeltaX = ((event.clientX - this.dragStartPointer.x) / rect.width) * effectiveFrustumSize * aspect;
    let worldDeltaY = ((event.clientY - this.dragStartPointer.y) / rect.height) * effectiveFrustumSize;

    if (this.transformGroup) {
      if (this.isDraggingIn2DView) {
        if (event.shiftKey) {
          if (Math.abs(worldDeltaX) > Math.abs(worldDeltaY)) {
            worldDeltaY = 0;
          } else {
            worldDeltaX = 0;
          }
        }
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
        const newPosition = this.dragStartObjectState.position.clone().add(worldDelta);
        if (event.ctrlKey) {
          const gridSize = this.appContext.gridCellSize;
          newPosition.x = Math.round(newPosition.x / gridSize) * gridSize;
          newPosition.y = Math.round(newPosition.y / gridSize) * gridSize;
          newPosition.z = Math.round(newPosition.z / gridSize) * gridSize;
        }
        this.transformGroup.position.copy(newPosition);
      } else if (this.isRotatingIn2DView) {
        const center3D = this.dragStartObjectState.position;
        const centerProjected = center3D.clone().project(view.camera);
        const centerX = (centerProjected.x * 0.5 + 0.5) * rect.width + rect.left;
        const centerY = (-centerProjected.y * 0.5 + 0.5) * rect.height + rect.top;
        const centerOnScreen = new THREE.Vector2(centerX, centerY);
        const startVec = new THREE.Vector2().subVectors(this.dragStartPointer, centerOnScreen);
        const currentVec = new THREE.Vector2(event.clientX, event.clientY).sub(centerOnScreen);
        let deltaAngle = Math.atan2(startVec.y, startVec.x) - Math.atan2(currentVec.y, currentVec.x);

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
        const oldCenter = this.dragStartObjectState.position;
        const handleName = this.draggedInfo.handleName;

        let u_change = 0,
          v_change = 0;
        let axisU, axisV;

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

        const oldMin = new THREE.Vector3().subVectors(oldCenter, oldSize.clone().multiplyScalar(0.5));
        const oldMax = new THREE.Vector3().addVectors(oldCenter, oldSize.clone().multiplyScalar(0.5));

        const draggedPoint = new THREE.Vector3();
        const anchorPoint = new THREE.Vector3();

        switch (this.draggedInfo.viewportKey) {
          case 'top':
            if (handleName.includes('left')) {
              draggedPoint.x = oldMin.x;
              anchorPoint.x = oldMax.x;
            } else if (handleName.includes('right')) {
              draggedPoint.x = oldMax.x;
              anchorPoint.x = oldMin.x;
            } else {
              draggedPoint.x = oldMin.x;
              anchorPoint.x = oldMax.x;
            }
            if (handleName.includes('top')) {
              draggedPoint.z = oldMin.z;
              anchorPoint.z = oldMax.z;
            } else if (handleName.includes('bottom')) {
              draggedPoint.z = oldMax.z;
              anchorPoint.z = oldMin.z;
            } else {
              draggedPoint.z = oldMin.z;
              anchorPoint.z = oldMax.z;
            }
            draggedPoint.y = oldMin.y;
            anchorPoint.y = oldMax.y;
            break;
          case 'front':
            if (handleName.includes('left')) {
              draggedPoint.x = oldMin.x;
              anchorPoint.x = oldMax.x;
            } else if (handleName.includes('right')) {
              draggedPoint.x = oldMax.x;
              anchorPoint.x = oldMin.x;
            } else {
              draggedPoint.x = oldMin.x;
              anchorPoint.x = oldMax.x;
            }
            if (handleName.includes('top')) {
              draggedPoint.y = oldMax.y;
              anchorPoint.y = oldMin.y;
            } else if (handleName.includes('bottom')) {
              draggedPoint.y = oldMin.y;
              anchorPoint.y = oldMax.y;
            } else {
              draggedPoint.y = oldMin.y;
              anchorPoint.y = oldMax.y;
            }
            draggedPoint.z = oldMin.z;
            anchorPoint.z = oldMax.z;
            break;
          case 'side':
            if (handleName.includes('left')) {
              draggedPoint.z = oldMax.z;
              anchorPoint.z = oldMin.z;
            } else if (handleName.includes('right')) {
              draggedPoint.z = oldMin.z;
              anchorPoint.z = oldMax.z;
            } else {
              draggedPoint.z = oldMin.z;
              anchorPoint.z = oldMax.z;
            }
            if (handleName.includes('top')) {
              draggedPoint.y = oldMax.y;
              anchorPoint.y = oldMin.y;
            } else if (handleName.includes('bottom')) {
              draggedPoint.y = oldMin.y;
              anchorPoint.y = oldMax.y;
            } else {
              draggedPoint.y = oldMin.y;
              anchorPoint.y = oldMax.y;
            }
            draggedPoint.x = oldMin.x;
            anchorPoint.x = oldMax.x;
            break;
        }

        const u_multiplier = handleName.includes('left') || handleName.includes('right');
        const v_multiplier = handleName.includes('top') || handleName.includes('bottom');
        if (u_multiplier) draggedPoint[axisU] += u_change;
        if (v_multiplier) draggedPoint[axisV] += v_change;

        const rawNewMin = new THREE.Vector3(Math.min(draggedPoint.x, anchorPoint.x), Math.min(draggedPoint.y, anchorPoint.y), Math.min(draggedPoint.z, anchorPoint.z));
        const rawNewMax = new THREE.Vector3(Math.max(draggedPoint.x, anchorPoint.x), Math.max(draggedPoint.y, anchorPoint.y), Math.max(draggedPoint.z, anchorPoint.z));

        let newSize = new THREE.Vector3().subVectors(rawNewMax, rawNewMin);
        let newCenter = new THREE.Vector3().addVectors(rawNewMin, rawNewMax).multiplyScalar(0.5);

        if (event.altKey) {
          const tempVec = new THREE.Vector3();
          tempVec.subVectors(draggedPoint, oldCenter);
          tempVec.multiplyScalar(2);
          tempVec.x = Math.abs(tempVec.x);
          tempVec.y = Math.abs(tempVec.y);
          tempVec.z = Math.abs(tempVec.z);
          newSize.copy(tempVec);
          newCenter.copy(oldCenter);
        }

        if (event.shiftKey) {
          const primaryAxis = Math.abs(u_change) > Math.abs(v_change) ? axisU : axisV;
          const scaleRatio = oldSize[primaryAxis] !== 0 ? newSize[primaryAxis] / oldSize[primaryAxis] : 1;
          newSize = oldSize.clone().multiplyScalar(scaleRatio);
          if (!event.altKey) {
            const newMin = new THREE.Vector3();
            const newMax = new THREE.Vector3();
            ['x', 'y', 'z'].forEach((axis) => {
              if (draggedPoint[axis] < anchorPoint[axis]) {
                newMin[axis] = anchorPoint[axis] - newSize[axis];
                newMax[axis] = anchorPoint[axis];
              } else {
                newMax[axis] = anchorPoint[axis] + newSize[axis];
                newMin[axis] = anchorPoint[axis];
              }
            });
            newCenter.addVectors(newMin, newMax).multiplyScalar(0.5);
          }
        }

        if (event.ctrlKey) {
          const gridSize = this.appContext.gridCellSize;
          const tempBBox = new THREE.Box3().setFromCenterAndSize(newCenter, newSize);
          tempBBox.min.x = Math.round(tempBBox.min.x / gridSize) * gridSize;
          tempBBox.min.y = Math.round(tempBBox.min.y / gridSize) * gridSize;
          tempBBox.min.z = Math.round(tempBBox.min.z / gridSize) * gridSize;
          tempBBox.max.x = Math.round(tempBBox.max.x / gridSize) * gridSize;
          tempBBox.max.y = Math.round(tempBBox.max.y / gridSize) * gridSize;
          tempBBox.max.z = Math.round(tempBBox.max.z / gridSize) * gridSize;
          newSize = tempBBox.getSize(new THREE.Vector3());
          newCenter = tempBBox.getCenter(new THREE.Vector3());
        }

        if (newSize.x < 0.01) newSize.x = 0.01;
        if (newSize.y < 0.01) newSize.y = 0.01;
        if (newSize.z < 0.01) newSize.z = 0.01;

        const scaleFactor = new THREE.Vector3(oldSize.x !== 0 ? newSize.x / oldSize.x : 1, oldSize.y !== 0 ? newSize.y / oldSize.y : 1, oldSize.z !== 0 ? newSize.z / oldSize.z : 1);

        this.transformGroup.position.copy(newCenter);
        this.transformGroup.scale.copy(scaleFactor);
      }
    }
  }

  onPointerUp(e) {
    if (e.pointerId !== this.activePointerId) {
      return;
    }

    if (this.isPanning2D) {
      const newCursor = this.isSpacebarDown ? 'grab' : 'default';
      if (this.panningViewportKey) this.viewportManager.viewports[this.panningViewportKey].element.style.cursor = newCursor;
      this.isPanning2D = false;
      this.panningViewportKey = null;
      this.appContext.orbitControls.enabled = true;
      this.activePointerId = null;
      return;
    }

    if (this.isDraggingIn2DView || this.isScalingIn2DView || this.isRotatingIn2DView) {
      const selectedObjects = this.appState.selectedObjects;
      if (this.transformGroup) {
        const commands = [];

        // ★★★ 将来のデグレ防止のための重要コメント ★★★
        // 2Dビューでの変形操作は、せん断(Shear)を含む可能性があるため、
        // 単純なposition, rotation, scale(PRS)では状態を完全に表現できない。
        // ここでは、以下の手順でせん断情報を含む正しい最終的なローカルマトリクスを計算し、
        // それをコマンドとして記録する。

        selectedObjects.forEach((obj, i) => {
          const oldT = this.transformStartCache[i];
          const originalParent = this.worldTransforms.get(obj).parent;

          // 1. three.jsのattach()メソッドを利用する。
          //    これは、オブジェクトのワールド空間での見た目(位置、回転、拡縮、せん断の全て)を
          //    完全に維持したまま、親子関係を安全に変更するための公式な方法。
          // 2. この操作により、オブジェクトの`.matrix`プロパティ(ローカル座標変換マトリクス)が
          //    新しい親(originalParent)に対して、見た目が変わらないように自動的に再計算される。
          // 3. この再計算された`.matrix`こそが、せん断情報を含む正しい最終的な変形状態である。
          originalParent.attach(obj);

          const newT = {matrix: obj.matrix.clone()};

          if (!oldT.matrix.equals(newT.matrix)) {
            commands.push(new TransformCommand(obj, oldT, newT));
          }
        });

        this.appContext.scene.remove(this.transformGroup);
        this.appState.transformGroup = null;
        this.transformGroup = null;
        this.worldTransforms.clear();

        if (commands.length > 0) {
          this.history.execute(new MacroCommand(commands, `選択した ${selectedObjects.length} 個のオブジェクトをグループ変形`));
        }
      }
      this.isDraggingIn2DView = this.isScalingIn2DView = this.isRotatingIn2DView = false;
      this.appState.isDraggingObject = false;
      this.appContext.orbitControls.enabled = true;
      document.dispatchEvent(new CustomEvent('updateGizmoAppearance'));
      this.transformStartCache = null;
      this.appState.notifySelectionChange();
      this.activePointerId = null;
      return;
    }

    const endPoint = new THREE.Vector2(e.clientX, e.clientY);
    const isClick = this.startPoint.distanceTo(endPoint) < 5;

    if (this.isBoxSelecting) {
      this.selectionBoxElement.style.display = 'none';
      this.isBoxSelecting = false;
      this.appContext.orbitControls.enabled = true;
      if (!isClick) {
        if (this.appState.isLivePaintPreviewMode) {
          document.getElementById('cancelPaint').click();
        }
        const boxRect = {left: Math.min(this.startPoint.x, endPoint.x), right: Math.max(this.startPoint.x, endPoint.x), top: Math.min(this.startPoint.y, endPoint.y), bottom: Math.max(this.startPoint.y, endPoint.y)};
        const objectsInBox = [];
        for (const key in this.viewportManager.viewports) {
          const view = this.viewportManager.viewports[key];
          const rect = view.element.getBoundingClientRect();
          if (boxRect.left > rect.right || boxRect.right < rect.left || boxRect.top > rect.bottom || boxRect.bottom < rect.top) continue;
          this.mechaGroup.children.forEach((mesh) => {
            if (mesh.userData.isNonSelectable) return;
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
        this.activePointerId = null;
        return;
      }
    }

    if (isClick) {
      const clickedViewportInfo = this.viewportManager.getViewportFromEvent(e);
      if (!clickedViewportInfo) {
        this.activePointerId = null;
        return;
      }

      this.pointer.x = ((event.clientX - clickedViewportInfo.rect.left) / clickedViewportInfo.rect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - clickedViewportInfo.rect.top) / clickedViewportInfo.rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.viewportManager.viewports[clickedViewportInfo.key].camera);

      if (this.appState.modes.isPlacementPreviewMode) {
        const previewIntersects = this.raycaster.intersectObjects(this.appContext.previewGroup.children);
        if (previewIntersects.length > 0) {
          const clickedPreview = previewIntersects[0].object;
          if (clickedPreview.userData.isPlacementPreview) {
            PlacementFeatures.confirmPlacement(clickedPreview, this.appContext);
          }
        } else {
          PlacementFeatures.cancelPlacementPreview(this.appContext);
        }
        this.activePointerId = null;
        return;
      }

      const intersects = this.raycaster.intersectObjects(
        this.mechaGroup.children.filter((c) => !c.userData.isNonSelectable),
        false
      );
      const clickedObject = intersects.length > 0 ? intersects[0].object : null;

      if (this.appState.isEyedropperMode) {
        if (clickedObject) {
          const pickedProps = {
            color: clickedObject.material.color.clone(),
            metalness: clickedObject.material.metalness,
            isEmissive: clickedObject.material.emissive.getHex() > 0,
            emissiveProperties: {color: clickedObject.material.emissive.clone(), intensity: 1.0, penumbra: 0.2},
            lightDirection: 'neg-z',
          };
          const existingLight = clickedObject.getObjectByProperty('isSpotLight', true);
          if (existingLight) {
            pickedProps.isEmissive = true;
            pickedProps.emissiveProperties.color.copy(existingLight.color);
            pickedProps.emissiveProperties.intensity = existingLight.intensity;
            pickedProps.emissiveProperties.penumbra = existingLight.penumbra;
            pickedProps.lightDirection = existingLight.userData.direction || 'neg-z';
          }

          if (this.appState.isLivePaintPreviewMode) {
            document.dispatchEvent(new CustomEvent('livePaintEyedrop', {detail: pickedProps}));
            this.log(`プロパティを抽出しました`);
          } else {
            this.appState.brushProperties = {...pickedProps};
            document.dispatchEvent(new CustomEvent('updatePaintUIFromBrush'));
            this.log(`ブラシにプロパティを抽出しました`);
          }
        }
        document.dispatchEvent(new CustomEvent('setEyedropperMode', {detail: false}));
        this.activePointerId = null;
        return;
      }

      if (this.appState.isLivePaintPreviewMode) {
        if (!clickedObject) {
          document.getElementById('cancelPaint').click();
        } else if (!this.appState.selectedObjects.includes(clickedObject)) {
          document.getElementById('confirmPaint').click();
        }
      }

      if (this.appState.isPaintMode) {
        if (clickedObject) {
          this.history.execute(new PaintObjectCommand(clickedObject, this.appState.brushProperties));
          this.appState.setSelection(clickedObject);
        }
      } else if (this.appState.modes.isSubtractMode) {
        const drillObject = clickedObject && this.appState.modes.subtractTargets.includes(clickedObject) ? clickedObject : null;
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
      } else if (this.appState.modes.isMirrorCopyMode) {
        const previewIntersects = this.raycaster.intersectObjects(this.previewGroup.children, true);
        if (previewIntersects.length > 0) {
          ClipboardFeatures.performMirrorCopy(previewIntersects[0].object, this.appContext);
        } else {
          ClipboardFeatures.cancelMirrorCopyMode(this.appContext);
          this.log('鏡面コピーモードをキャンセルしました。');
        }
      } else if (this.appState.modes.isPasteMode) {
        const previewIntersects = this.raycaster.intersectObjects(this.previewGroup.children, true);
        if (previewIntersects.length > 0) {
          ClipboardFeatures.confirmPaste(previewIntersects[0].object, this.appContext);
        } else {
          ClipboardFeatures.cancelPasteMode(this.appContext);
          this.log('貼り付けをキャンセルしました。');
        }
      } else {
        if (e.ctrlKey) {
          this.appState.toggleSelection(clickedObject);
        } else if (e.shiftKey || this.appState.isMultiSelectMode) {
          this.appState.addSelection(clickedObject);
        } else {
          this.appState.setSelection(clickedObject);
        }
        if (this.appState.isMultiSelectMode && !clickedObject) document.dispatchEvent(new CustomEvent('setMultiSelectMode', {detail: false}));
        this.log(this.appState.selectedObjects.length > 0 ? `${this.appState.selectedObjects.length}個のオブジェクトを選択中` : '待機中');
      }
    } else {
      if (!e.ctrlKey && !e.shiftKey && !this.appState.isMultiSelectMode) {
        this.appState.clearSelection();
        this.log('待機中');
      }
    }
    this.activePointerId = null;
  }

  onContextMenu(event) {
    const clickedViewportInfo = this.viewportManager.getViewportFromEvent(event);
    if (clickedViewportInfo && clickedViewportInfo.key !== 'perspective') {
      event.preventDefault();
    }
  }
}
