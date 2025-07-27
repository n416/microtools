import { command } from './Command.js';

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
    // newTransformにmatrixプロパティがあれば、マトリクスによる変形
    if (this.newTransform.matrix) {
      this.object.matrix.copy(this.newTransform.matrix);
      
      // ★★★ 将来のデグレ防止のための重要コメント ★★★
      // 2Dビューでの拡縮操作などにより、せん断(Shear)を含む可能性のある変形が適用された。
      // three.jsのmatrixAutoUpdateは、position, rotation, scaleからmatrixを再計算する機能だが、
      // このPRSはせん断情報を保持できない。
      // そのため、matrixAutoUpdateがtrueのままだと、次の描画フレームでせん断情報が失われてしまう。
      // これを防ぐため、マトリクスを直接操作した後は必ずmatrixAutoUpdateをfalseに設定する。
      this.object.matrixAutoUpdate = false;
      
      // UIのプロパティ表示などのために、PRSプロパティも更新しておく
      this.object.matrix.decompose(this.object.position, this.object.quaternion, this.object.scale);

    } else { // キーボード操作など、せん断を含まない従来のPRSによる変形
      // PRSで操作するので、自動更新を有効に戻す
      this.object.matrixAutoUpdate = true;
      this.object.position.copy(this.newTransform.position);
      this.object.rotation.copy(this.newTransform.rotation);
      this.object.scale.copy(this.newTransform.scale);
    }
  }

  undo() {
    // oldTransformにmatrixプロパティがあれば、マトリクスによる変形状態に戻す
    if (this.oldTransform.matrix) {
      this.object.matrix.copy(this.oldTransform.matrix);
      this.object.matrixAutoUpdate = false; // 同上の理由でfalseに設定
      this.object.matrix.decompose(this.object.position, this.object.quaternion, this.object.scale);

    } else { // 従来のPRSによる変形状態に戻す
      this.object.matrixAutoUpdate = true; // 自動更新を有効に戻す
      this.object.position.copy(this.oldTransform.position);
      this.object.rotation.copy(this.oldTransform.rotation);
      this.object.scale.copy(this.oldTransform.scale);
    }
  }
}