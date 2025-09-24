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
    if (this.newTransform.matrix) {
      this.object.matrix.copy(this.newTransform.matrix);
      // matrixを直接変更した後は、必ず decompose を呼び出し、
      // position/quaternion/scale との同期を保つ
      this.object.matrix.decompose(this.object.position, this.object.quaternion, this.object.scale);
    } else {
      this.object.position.copy(this.newTransform.position);
      this.object.rotation.copy(this.newTransform.rotation);
      this.object.scale.copy(this.newTransform.scale);
    }
    // ▼▼▼ 修正の核心 ▼▼▼
    // 操作の最後に、必ず matrixAutoUpdate を true に戻し、オブジェクトを正常な状態に復元する
    this.object.matrixAutoUpdate = true;
    this.object.updateMatrixWorld(true);
  }

  undo() {
    if (this.oldTransform.matrix) {
      this.object.matrix.copy(this.oldTransform.matrix);
      // undoでも同様に同期を保つ
      this.object.matrix.decompose(this.object.position, this.object.quaternion, this.object.scale);
    } else {
      this.object.position.copy(this.oldTransform.position);
      this.object.rotation.copy(this.oldTransform.rotation);
      this.object.scale.copy(this.oldTransform.scale);
    }
    // ▼▼▼ 修正の核心 ▼▼▼
    // undo後も、必ず正常な状態に戻す
    this.object.matrixAutoUpdate = true;
    this.object.updateMatrixWorld(true);
  }
}

/**
 * ジョイントのトランスフォームを変更するコマンド。
 */
export class JointTransformCommand extends command {
  constructor(initialStates, finalStates) {
    super();
    this.initialStates = initialStates.map((s) => ({ object: s.object, position: s.position.clone(), quaternion: s.quaternion.clone() }));
    this.finalStates = finalStates.map((s) => ({ object: s.object, position: s.position.clone(), quaternion: s.quaternion.clone() }));
    this.message = 'ジョイントを操作';
  }

  execute() {
    this.finalStates.forEach((state) => {
      state.object.position.copy(state.position);
      state.object.quaternion.copy(state.quaternion);
      state.object.updateMatrixWorld(true);
    });
  }

  undo() {
    this.initialStates.forEach((state) => {
      state.object.position.copy(state.position);
      state.object.quaternion.copy(state.quaternion);
      state.object.updateMatrixWorld(true);
    });
  }
}