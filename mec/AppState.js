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
      isPlacementPreviewMode: false,
      isJointMode: false, // FK
      isIkMode: false,
      ik: {
        endEffector: null,
        ikChain: [],
        isDragging: false,
      },
      subtractTargets: [],
      clipboard: null,
      lastPasteInfo: {objects: [], offset: new THREE.Vector3()},
    };

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

  clearIkSelection() {
    // 選択ハイライト(BoxHelper)を削除
    if (this.modes.ik.endEffector && this.modes.ik.endEffector.userData.boxHelper) {
      const boxHelper = this.modes.ik.endEffector.userData.boxHelper;
      // boxHelper.parent が存在する場合のみ remove を呼び出す
      if (boxHelper.parent) {
        boxHelper.parent.remove(boxHelper);
      }
      this.modes.ik.endEffector.userData.boxHelper = null; // 参照を削除
    }

    // IKチェーンのジョイントのハイライトを元に戻す
    if (this.modes.ik.ikChain) {
        this.modes.ik.ikChain.forEach(joint => {
            joint.material.color.set(0xffa500); // 元の色に戻す
        });
    }

    // IK状態をリセット
    this.modes.ik.endEffector = null;
    this.modes.ik.ikChain = [];
    this.modes.ik.isDragging = false;
    this.notifySelectionChange();
  }


  notifySelectionChange() {
    this.onSelectionChange.forEach((callback) => callback(this.selectedObjects));
  }
}