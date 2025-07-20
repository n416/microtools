import { command } from './command.js';

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
  constructor(object, mechaGroup) {
    super();
    this.object = object;
    this.mechaGroup = mechaGroup;
    this.message = `${object.geometry.type.replace('Geometry', '')} を削除`;
  }

  execute() {
    this.mechaGroup.remove(this.object);
  }

  undo() {
    this.mechaGroup.add(this.object);
  }
}

/**
 * オブジェクトのトランスフォーム（位置、回転、スケール）を変更するコマンド。
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
    this.object.position.copy(this.newTransform.position);
    this.object.rotation.copy(this.newTransform.rotation);
    this.object.scale.copy(this.newTransform.scale);
  }

  undo() {
    this.object.position.copy(this.oldTransform.position);
    this.object.rotation.copy(this.oldTransform.rotation);
    this.object.scale.copy(this.oldTransform.scale);
  }
}