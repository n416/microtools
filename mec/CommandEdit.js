import { command } from './Command.js';
import * as THREE from 'three';

/**
 * 複数のコマンドをまとめて扱うマクロコマンド。
 */
export class MacroCommand extends command {
  constructor(commands, message) {
    super();
    this.commands = commands;
    this.message = message || '複数の操作';
  }

  execute() {
    this.commands.forEach((c) => c.execute());
  }

  undo() {
    this.commands
      .slice()
      .reverse()
      .forEach((c) => c.undo());
  }
}

/**
 * オブジェクトをシーンから削除するコマンド。
 */
export class DeleteObjectCommand extends command {
  constructor(object, parentGroup) {
    super();
    this.object = object;
    this.parentGroup = parentGroup;
    const objectType = object.userData.isJoint ? 'ジョイント' : object.geometry.type.replace('Geometry', '');
    this.message = `${objectType} を削除`;
  }

  execute() {
    this.parentGroup.remove(this.object);
  }

  undo() {
    this.parentGroup.add(this.object);
  }
}

/**
 * オブジェクトのトランスフォームを変更するコマンド。
 */
export class TransformCommand extends command {
  constructor(object, oldTransform, newTransform) {
    super();
    this.object = object;
    this.oldTransform = oldTransform;
    this.newTransform = newTransform;
    this.message = 'オブジェクトを変形';
  }

  execute() {
    console.log(`--- TransformCommand.execute ---`);
    console.log(`Before: Object Name = "${this.object.name}", UUID = ${this.object.uuid}`);

    if (this.newTransform.matrix) {
      this.object.matrix.copy(this.newTransform.matrix);
      this.object.matrix.decompose(this.object.position, this.object.quaternion, this.object.scale);
    } else {
      this.object.position.copy(this.newTransform.position);
      this.object.rotation.copy(this.newTransform.rotation);
      this.object.scale.copy(this.newTransform.scale);
    }
    this.object.matrixAutoUpdate = true;
    this.object.updateMatrixWorld(true);

    console.log(`After:  Object Name = "${this.object.name}"`);
    console.log(`------------------------------`);
  }

  undo() {
    console.log(`--- TransformCommand.undo ---`);
    console.log(`Before: Object Name = "${this.object.name}", UUID = ${this.object.uuid}`);

    if (this.oldTransform.matrix) {
      this.object.matrix.copy(this.oldTransform.matrix);
      this.object.matrix.decompose(this.object.position, this.object.quaternion, this.object.scale);
    } else {
      this.object.position.copy(this.oldTransform.position);
      this.object.rotation.copy(this.oldTransform.rotation);
      this.object.scale.copy(this.oldTransform.scale);
    }
    this.object.matrixAutoUpdate = true;
    this.object.updateMatrixWorld(true);

    console.log(`After:  Object Name = "${this.object.name}"`);
    console.log(`-----------------------------`);
  }
}

/**
 * ジョイントのトランスフォームを変更するコマンド。
 */
export class JointTransformCommand extends command {
  constructor(initialStates, finalStates) {
    super();
    // ★★★ エラー修正： 'quaternion' を使用するように統一 ★★★
    this.initialStates = initialStates.map((s) => ({ object: s.object, position: s.position.clone(), quaternion: s.quaternion.clone() }));
    this.finalStates = finalStates.map((s) => ({ object: s.object, position: s.position.clone(), quaternion: s.quaternion.clone() }));
    this.message = 'ジョイントを操作';
  }

  execute() {
    this.finalStates.forEach((state) => {
      state.object.position.copy(state.position);
      state.object.quaternion.copy(state.quaternion); // ★★★ 'quaternion' を使用
      state.object.updateMatrixWorld(true);
    });
  }

  undo() {
    this.initialStates.forEach((state) => {
      state.object.position.copy(state.position);
      state.object.quaternion.copy(state.quaternion); // ★★★ 'quaternion' を使用
      state.object.updateMatrixWorld(true);
    });
  }
}