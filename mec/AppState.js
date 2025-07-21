import * as THREE from 'three';

export class AppState {
  constructor() {
    /** @type {THREE.Object3D[]} */
    this.selectedObjects = [];
    this.onSelectionChange = new Set(); // 選択変更を外部に通知するための仕組み

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
    this.isPaintMode = false;
    this.isEyedropperMode = false;

    // データ
    this.currentColor = new THREE.Color(0xffffff);
  }

  /**
   * 選択状態を更新し、変更を通知します。
   * @param {THREE.Object3D[] | THREE.Object3D | null} objects - 新しく選択するオブジェクト(配列、単体、またはnull)
   */
  setSelection(objects) {
    this.selectedObjects = Array.isArray(objects) ? objects.slice() : objects ? [objects] : [];
    this.notifySelectionChange();
  }

  /**
   * 現在の選択にオブジェクトを追加し、変更を通知します。
   * @param {THREE.Object3D} object - 追加するオブジェクト
   */
  addSelection(object) {
    if (object && !this.selectedObjects.includes(object)) {
      this.selectedObjects.push(object);
      this.notifySelectionChange();
    }
  }

  /**
   * 現在の選択からオブジェクトを削除/追加(トグル)し、変更を通知します。
   * @param {THREE.Object3D} object - トグルするオブジェクト
   */
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

  /**
   * 選択をクリアし、変更を通知します。
   */
  clearSelection() {
    this.selectedObjects = [];
    this.notifySelectionChange();
  }

  /**
   * 選択の変更を購読しているコールバックをすべて実行します。
   */
  notifySelectionChange() {
    this.onSelectionChange.forEach((callback) => callback(this.selectedObjects));
  }
}
