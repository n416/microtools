import * as THREE from 'three'; // ★★★ 修正: THREE.jsライブラリのインポートを追加 ★★★
import { AddObjectCommand } from './command-create.js';
import { MacroCommand, DeleteObjectCommand } from './command-edit.js';
import * as SceneIO from './scene-io.js';

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
        if (!(command instanceof AddObjectCommand && command.isInternal)) {
            this.appState.modes.lastPasteInfo = { objects: [], offset: new THREE.Vector3() };
        }
        this.app.log(command.message);
        SceneIO.autoSaveScene(this.app.appContext);
    }

    undo() {
        this.appState.modes.lastPasteInfo = { objects: [], offset: new THREE.Vector3() };
        const command = this.undoStack.pop();
        if (command) {
            command.undo();
            this.redoStack.push(command);
            this.appState.clearSelection();
            this.app.log(`Undo: ${command.message}`);
            SceneIO.autoSaveScene(this.app.appContext);
        } else {
            this.app.log('これ以上元に戻せません。');
        }
    }

    redo() {
        this.appState.modes.lastPasteInfo = { objects: [], offset: new THREE.Vector3() };
        const command = this.redoStack.pop();
        if (command) {
            command.execute();
            this.undoStack.push(command);
            if (command instanceof DeleteObjectCommand || (command instanceof MacroCommand && command.commands[0] instanceof DeleteObjectCommand)) {
                this.appState.clearSelection();
            } else if (command instanceof MacroCommand) {
                const newSelection = command.commands.map(cmd => cmd.object).filter(Boolean);
                if (newSelection.length > 0) this.appState.setSelection(newSelection);
            }
            this.app.log(`Redo: ${command.message}`);
            SceneIO.autoSaveScene(this.app.appContext);
        } else {
            this.app.log('これ以上やり直せません。');
        }
    }
}