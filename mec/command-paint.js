import { command } from './command.js';

/**
 * オブジェクトの色を変更するコマンド。
 */
export class ChangeColorCommand extends command {
  constructor(object, newColor) {
      super();
      this.object = object;
      this.oldColor = object.material.color.clone();
      this.newColor = newColor.clone();
      this.message = 'オブジェクトの色を変更';
  }

  execute() {
      this.object.material.color.copy(this.newColor);
  }

  undo() {
      this.object.material.color.copy(this.oldColor);
  }
}