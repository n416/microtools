import * as THREE from 'three';

export class AppState {
  constructor() {
    /** @type {THREE.Object3D[]} */
    this.selectedObjects = [];
    this.onSelectionChange = new Set(); 

    this.modes = {
      isMirrorCopyMode: false,
      isPasteMode: false,
      isSubtractMode: false,
      subtractTargets: [],
      clipboard: null,
      lastPasteInfo: {objects: [], offset: new THREE.Vector3()},
    };

    // モード関連フラグ
    this.isMultiSelectMode = false;
    this.isPaintMode = false; // クリックで連続塗装するモード
    this.isLivePaintPreviewMode = false; // 選択オブジェクトをリアルタイム編集するモード
    this.isEyedropperMode = false;
    
    // ★★★ 修正箇所: 連続塗装用の設定(ブラシ設定)として名前を明確化 ★★★
    this.brushProperties = {
        color: new THREE.Color(0xffffff),
        metalness: 1.0,
        isEmissive: false,
        lightDirection: 'neg-z',
        emissiveProperties: {
            color: new THREE.Color(0xffffff),
            intensity: 1.0,
            penumbra: 0.2
        }
    };

    // ライブペイントプレビュー用の一時保存領域
    this.livePaintOriginalStates = new Map();
  }

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