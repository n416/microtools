import { command } from './command.js';

/**
 * オブジェクトをシーンに追加するコマンド。
 */
export class AddObjectCommand extends command {
  constructor(object, mechaGroup, selectionManager, isInternal = false) {
    super();
    this.object = object;
    this.mechaGroup = mechaGroup;
    this.selectionManager = selectionManager;
    this.isInternal = isInternal; // ペーストやCSG操作など、外部で選択管理する場合はtrue
    this.message = isInternal ? `オブジェクトを内部処理で追加` : `${object.geometry.type.replace('Geometry', '')} を追加`;
  }

  execute() {
    this.mechaGroup.add(this.object);
    // UIから直接追加された場合のみ、選択状態を更新する
    if (!this.isInternal) {
      this.selectionManager.set([this.object]);
    }
  }

  undo() {
    this.mechaGroup.remove(this.object);
    // undo後はHistoryクラスで選択がクリアされるため、ここでは何もしない
  }
}

/**
 * オブジェクトを鏡面コピーしてシーンに追加するコマンド。
 */
export class MirrorCopyCommand extends command {
  constructor(newObject, mechaGroup, axis) {
    super();
    this.object = newObject;
    this.mechaGroup = mechaGroup;
    this.message = `${axis.toUpperCase()}軸に鏡面コピー`;
  }

  execute() {
    this.mechaGroup.add(this.object);
  }

  undo() {
    this.mechaGroup.remove(this.object);
  }
}