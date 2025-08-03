import * as THREE from 'three';
import {AddObjectCommand} from './CommandCreate.js';
import {MacroCommand, DeleteObjectCommand, JointTransformCommand, TransformCommand} from './CommandEdit.js';
import * as SceneIO from './SceneIo.js';

export class History {
  constructor(app) {
    this.app = app;
    this.appState = app.appState;
    this.undoStack = [];
    this.redoStack = [];
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];

    // TransformCommand, JointTransformCommand, AddObject(internal) 以外の場合にペースト情報をクリア
    if (!(command instanceof TransformCommand) && !(command instanceof JointTransformCommand) && !(command instanceof AddObjectCommand && command.isInternal)) {
      this.appState.modes.lastPasteInfo = {objects: [], offset: new THREE.Vector3()};
    }

    this.app.log(command.message);
    SceneIO.autoSaveScene(this.app.appContext);
  }

  undo() {
    this.appState.modes.lastPasteInfo = {objects: [], offset: new THREE.Vector3()};
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);

      // Undo後に選択状態を復元する
      if (command instanceof TransformCommand) {
        this.appState.setSelection(command.object);
      } else if (command instanceof MacroCommand) {
        const newSelection = command.commands.map((cmd) => cmd.object).filter(Boolean);
        if (newSelection.length > 0) this.appState.setSelection(newSelection);
      } else {
        this.appState.clearSelection();
      }

      this.app.log(`Undo: ${command.message}`);
      SceneIO.autoSaveScene(this.app.appContext);
    } else {
      this.app.log('これ以上元に戻せません。');
    }
  }

  redo() {
    this.appState.modes.lastPasteInfo = {objects: [], offset: new THREE.Vector3()};
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);

      // Redo後に選択状態を復元する
      if (command instanceof DeleteObjectCommand || (command instanceof MacroCommand && command.commands[0] instanceof DeleteObjectCommand)) {
        this.appState.clearSelection();
      } else if (command instanceof TransformCommand) {
        this.appState.setSelection(command.object);
      } else if (command instanceof MacroCommand) {
        const newSelection = command.commands.map((cmd) => cmd.object).filter(Boolean);
        if (newSelection.length > 0) this.appState.setSelection(newSelection);
      }

      this.app.log(`Redo: ${command.message}`);
      SceneIO.autoSaveScene(this.app.appContext);
    } else {
      this.app.log('これ以上やり直せません。');
    }
  }
}
