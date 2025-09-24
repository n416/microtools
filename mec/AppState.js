import * as THREE from 'three';

export class AppState {
  constructor() {
    /** @type {THREE.Object3D[]} */
    this.selectedObjects = [];
    this.onSelectionChange = new Set();
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    // ★★★ モード管理を刷新 ★★★
    this.modes = {
      isMirrorCopyMode: false,
      isPasteMode: false,
      isSubtractMode: false,
      isPlacementPreviewMode: false,
      isJointMode: false, // FK
      isIkMode: false,      // 新しい物理ベースIK
      isPinMode: false,     // ★★★ アンカー（ピン留め）モードを追加 ★★★
      subtractTargets: [],
      clipboard: null,
      lastPasteInfo: { objects: [], offset: new THREE.Vector3() },
    };
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

    this.isWireframeOverlay = true; // デフォルトはON

    // モード関連フラグ
    this.isMultiSelectMode = false;
    this.isPaintMode = false; // クリックで連続塗装するモード
    this.isLivePaintPreviewMode = false; // 選択オブジェクトをリアルタイム編集するモード
    this.isEyedropperMode = false;

    this.brushProperties = {
      color: new THREE.Color(0xffffff),
      metalness: 1.0,
      isEmissive: false,
      lightDirection: 'neg-z',
      emissiveProperties: {
        color: new THREE.Color(0xffffff),
        intensity: 1.0,
        penumbra: 0.2,
      },
    };

    // ライブペイントプレビュー用の一時保存領域
    this.livePaintOriginalStates = new Map();

    // 2Dビューでのドラッグ操作中に、対象オブジェクトを一時的に格納するグループ
    this.transformGroup = null;
  }


  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
  // ★★★ モード切り替え用のヘルパー関数を追加 ★★★
  toggleIkMode() {
    this.modes.isIkMode = !this.modes.isIkMode;
    if (this.modes.isIkMode) {
      this.modes.isJointMode = false;
      this.modes.isPinMode = false;
    }
    document.dispatchEvent(new CustomEvent('mode-changed'));
  }

  togglePinMode() {
    this.modes.isPinMode = !this.modes.isPinMode;
    if (this.modes.isPinMode) {
      this.modes.isIkMode = false;
      this.modes.isJointMode = false;
    }
    document.dispatchEvent(new CustomEvent('mode-changed'));
  }
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

  setSelection(objects) {
    this.selectedObjects = Array.isArray(objects) ? objects.slice() : objects ? [objects] : [];
    this.notifySelectionChange();
  }

  addSelection(object) {
    if (object && !this.selectedObjects.includes(object)) {
      this.selectedObjects.push(object);
      this.notifySelectionChange();
    }
  }

  toggleSelection(object) {
    if (!object) return;
    const index = this.selectedObjects.indexOf(object);
    if (index > -1) {
      this.selectedObjects.splice(index, 1);
    } else {
      this.selectedObjects.push(object);
    }
    this.notifySelectionChange();
  }

  clearSelection() {
    this.selectedObjects = [];
    this.notifySelectionChange();
  }

  notifySelectionChange() {
    this.onSelectionChange.forEach((callback) => callback(this.selectedObjects));
  }
}