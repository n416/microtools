import { AddObjectCommand } from './CommandCreate.js';
import { MacroCommand, DeleteObjectCommand } from './CommandEdit.js';
import * as CsgOperations from './CsgOperations.js';
import * as SceneIO from './SceneIo.js';
import * as ClipboardFeatures from './ClipboardFeatures.js';
import { createColorPalette } from './Paint.js';
import * as THREE from 'three';

export class UIControl {
  constructor(appContext) {
    this.appContext = appContext;
    this.history = appContext.history;
    this.appState = appContext.state;
    this.mechaGroup = appContext.mechaGroup;
    this.log = appContext.log;
  }

  initialize() {
    this.setupObjectCreation();
    this.setupCsgOperations();
    this.setupFileIO();
    this.setupModeButtons();
    this.setupPaintControls();
  }

  setupObjectCreation() {
    document.getElementById('addCube').addEventListener('click', () => this.history.execute(new AddObjectCommand(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })), this.mechaGroup, this.appContext.selectionManager)));
    document.getElementById('addSphere').addEventListener('click', () => this.history.execute(new AddObjectCommand(new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 16), new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })), this.mechaGroup, this.appContext.selectionManager)));
    document.getElementById('addCone').addEventListener('click', () => this.history.execute(new AddObjectCommand(new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.5, 32), new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })), this.mechaGroup, this.appContext.selectionManager)));
    document.getElementById('addCylinder').addEventListener('click', () => this.history.execute(new AddObjectCommand(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32), new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })), this.mechaGroup, this.appContext.selectionManager)));
    
    document.getElementById('addPrism').addEventListener('click', () => { document.getElementById('prismModal').style.display = 'flex'; });
    document.getElementById('cancelPrism').addEventListener('click', () => { document.getElementById('prismModal').style.display = 'none'; });
    document.getElementById('confirmPrism').addEventListener('click', () => {
        const sidesInput = document.getElementById('sidesInput');
        let sides = parseInt(sidesInput.value, 10);
        sides = Math.max(3, Math.min(64, sides || 6));
        sidesInput.value = sides;
        this.history.execute(new AddObjectCommand(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.5, sides), new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })), this.mechaGroup, this.appContext.selectionManager));
        document.getElementById('prismModal').style.display = 'none';
    });
  }

  setupCsgOperations() {
    document.getElementById('unionObjects').addEventListener('click', () => CsgOperations.performUnion(this.appContext));
    document.getElementById('intersectObjects').addEventListener('click', () => CsgOperations.performIntersect(this.appContext));
    document.getElementById('subtractObjects').addEventListener('click', () => CsgOperations.startSubtractMode(this.appContext));
    document.getElementById('cancelSubtract').addEventListener('click', () => CsgOperations.cancelSubtractMode(this.appContext));
    document.getElementById('mirrorCopy').addEventListener('click', () => ClipboardFeatures.startMirrorCopyMode(this.appContext));
    document.getElementById('cancelMirrorCopy').addEventListener('click', () => {
        ClipboardFeatures.cancelMirrorCopyMode(this.appContext);
        this.log('鏡面コピーモードをキャンセルしました。');
    });
    document.getElementById('deleteObject').addEventListener('click', () => {
        const selected = this.appState.selectedObjects;
        if (selected.length === 0) return this.log('削除対象なし');
        this.history.execute(new MacroCommand(selected.map(obj => new DeleteObjectCommand(obj, this.mechaGroup)), `選択した ${selected.length} 個のオブジェクトを削除`));
        this.appState.clearSelection();
    });
  }

  setupFileIO() {
    const fileInput = document.getElementById('fileInput');
    document.getElementById('save').addEventListener('click', () => {
        const dataString = localStorage.getItem('mechaCreatorAutoSave');
        if (!dataString) return this.log('保存データなし');
        const blob = new Blob([dataString], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'mecha-data.json';
        a.click();
        URL.revokeObjectURL(a.href);
        this.log('データ保存');
    });
    document.getElementById('load').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => { try { SceneIO.loadFromData(this.appContext, JSON.parse(re.target.result)); } catch (err) { this.log('ファイル読込失敗'); } };
        reader.readAsText(file);
        e.target.value = '';
    });
  }

  setupModeButtons() {
    const multiSelectButton = document.getElementById('multiSelect');
    const panModeButton = document.getElementById('panModeButton');

    multiSelectButton.addEventListener('click', () => {
        this.appState.isMultiSelectMode = !this.appState.isMultiSelectMode;
        multiSelectButton.style.backgroundColor = this.appState.isMultiSelectMode ? '#2ecc71' : '#f39c12';
        this.log(this.appState.isMultiSelectMode ? '複数選択モード開始。SHIFTキーで選択を追加/解除できます。' : '複数選択モード終了。');
        if(!this.appState.isMultiSelectMode) this.appState.clearSelection();
    });

    panModeButton.addEventListener('click', () => {
        const isPanModeActive = !this.appContext.isPanModeActive;
        document.dispatchEvent(new CustomEvent('setPanMode', {detail: isPanModeActive}));
        panModeButton.style.backgroundColor = isPanModeActive ? '#2ecc71' : '#3498db';
        this.appContext.orbitControls.mouseButtons.LEFT = isPanModeActive ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
        this.log(isPanModeActive ? 'パンモード開始。3Dビューの左ドラッグで視点を移動できます。' : 'パンモード終了。');
    });

    // main.jsからのカスタムイベントをリッスン
    document.addEventListener('setMultiSelectMode', (e) => {
        this.appState.isMultiSelectMode = e.detail;
        multiSelectButton.style.backgroundColor = e.detail ? '#2ecc71' : '#f39c12';
         if(!e.detail) this.log('複数選択モード終了。');
    });
  }

  setupPaintControls() {
    const paintModeButton = document.getElementById('paintModeButton');
    const eyedropperButton = document.getElementById('eyedropperButton');
    const paintControls = document.getElementById('paint-controls');
    const colorPaletteContainer = document.getElementById('colorPalette');
    const currentColorDisplay = document.getElementById('currentColorDisplay');
    
    const updateCurrentColorDisplayUI = () => { currentColorDisplay.style.backgroundColor = `#${this.appState.currentColor.getHexString()}`; }
    document.addEventListener('updateCurrentColorDisplay', updateCurrentColorDisplayUI);
    
    colorPaletteContainer.appendChild(createColorPalette([0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0x999999], 5));
    colorPaletteContainer.addEventListener('click', (e) => {
        if (e.target.dataset.color) {
            this.appState.currentColor.set(parseInt(e.target.dataset.color, 10));
            updateCurrentColorDisplayUI();
            this.log(`色を選択: #${this.appState.currentColor.getHexString()}`);
        }
    });
    updateCurrentColorDisplayUI();

    paintModeButton.addEventListener('click', () => {
        this.appState.isPaintMode = !this.appState.isPaintMode;
        if (this.appState.isPaintMode) {
            paintModeButton.style.backgroundColor = '#2ecc71';
            paintControls.style.display = 'flex';
            if (this.appState.isMultiSelectMode) document.getElementById('multiSelect').click();
            ClipboardFeatures.cancelMirrorCopyMode(this.appContext);
            ClipboardFeatures.cancelPasteMode(this.appContext);
            CsgOperations.cancelSubtractMode(this.appContext);
            this.appState.clearSelection();
            this.log('ペイントモード開始。オブジェクトをクリックして着色します。');
        } else {
            paintModeButton.style.backgroundColor = '#9b59b6';
            paintControls.style.display = 'none';
            document.dispatchEvent(new CustomEvent('setEyedropperMode', { detail: false }));
            this.log('ペイントモード終了。');
        }
    });

    eyedropperButton.addEventListener('click', () => {
        if (!this.appState.isPaintMode) { paintModeButton.click(); }
        document.dispatchEvent(new CustomEvent('setEyedropperMode', { detail: true }));
        this.log('スポイトモード開始。オブジェクトをクリックして色を抽出します。');
    });
  }
}