import {command} from './Command.js';

/**
 * オブジェクトをシーンに追加するコマンド。
 */
export class AddObjectCommand extends command {
  constructor(object, mechaGroup, selectionManager, isInternal = false) {
    super();
    this.object = object;
    this.mechaGroup = mechaGroup;
    this.selectionManager = selectionManager;
    this.isInternal = isInternal;
    this.message = isInternal ? `オブジェクトを内部処理で追加` : `${object.geometry.type.replace('Geometry', '')} を追加`;
  }

  execute() {
    this.mechaGroup.add(this.object);
    if (!this.isInternal) {
      this.selectionManager.set([this.object]);
    }
  }

  undo() {
    this.mechaGroup.remove(this.object);
  }
}

/**
 * ジョイントをシーンに追加するコマンド。
 */
export class AddJointCommand extends command {
  constructor(joint, jointGroup, selectionManager, parentObject, childObjects) {
    super();
    this.object = joint;
    this.jointGroup = jointGroup;
    this.selectionManager = selectionManager;
    this.parentObject = parentObject;
    this.childObjects = childObjects;
    this.message = `${joint.userData.type}ジョイントを追加`;
  }

  execute() {
    this.jointGroup.add(this.object);
    this.selectionManager.set([this.object, this.parentObject, ...this.childObjects]);
  }

  undo() {
    this.jointGroup.remove(this.object);
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

/**
 * インポートされたオブジェクトをシーンに追加するコマンド
 */
export class ImportObjectCommand extends command {
  constructor(object, mechaGroup, selectionManager, fileName) {
    super();
    this.object = object;
    this.mechaGroup = mechaGroup;
    this.selectionManager = selectionManager;
    this.message = `${fileName} をインポート`;
  }

  execute() {
    this.mechaGroup.add(this.object);
    this.selectionManager.set([this.object]);
  }

  undo() {
    this.mechaGroup.remove(this.object);
  }
}
