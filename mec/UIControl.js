import {AddObjectCommand, ImportObjectCommand} from './CommandCreate.js';
import {MacroCommand, DeleteObjectCommand} from './CommandEdit.js';
import {PaintObjectCommand} from './CommandPaint.js';
import * as CsgOperations from './CsgOperations.js';
import * as SceneIO from './SceneIo.js';
import * as ClipboardFeatures from './ClipboardFeatures.js';
import {createColorPalette} from './Paint.js';
import * as THREE from 'three';
import * as PlacementFeatures from './PlacementFeatures.js'; // ★ 新しいファイルをインポート
import {OBJLoader} from './OBJLoader.js'; // 新しく作成したOBJLoaderをインポート

function getVectorFromDirection(direction) {
  switch (direction) {
    case 'pos-x':
      return new THREE.Vector3(1, 0, 0);
    case 'neg-x':
      return new THREE.Vector3(-1, 0, 0);
    case 'pos-y':
      return new THREE.Vector3(0, 1, 0);
    case 'neg-y':
      return new THREE.Vector3(0, -1, 0);
    case 'pos-z':
      return new THREE.Vector3(0, 0, 1);
    case 'neg-z':
      return new THREE.Vector3(0, 0, -1);
    default:
      return new THREE.Vector3(0, 0, -1);
  }
}

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
    this.setupGlobalCancel();
    this.setupGhostControls(); // ★ 新しいメソッド呼び出しを追加
    this.setupViewControls(); // ★★★ この行を追加 ★★★
  }
  // ★★★ この関数を丸ごと追加 ★★★
  setupViewControls() {
    const wireframeToggle = document.getElementById('wireframeToggle');
    // アプリの状態をチェックボックスに反映
    wireframeToggle.checked = this.appState.isWireframeOverlay;

    // チェックボックスが変更されたら、アプリの状態を更新
    wireframeToggle.addEventListener('change', (event) => {
      this.appState.isWireframeOverlay = event.target.checked;
    });
  }
  setupGlobalCancel() {
    const escapeButton = document.getElementById('escapeButton');
    escapeButton.addEventListener('click', () => {
      // ★★★ 修正箇所: { bubbles: true } を追加 ★★★
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    });
  }
  // ★★★ この関数を丸ごと置き換え ★★★
  setupObjectCreation() {
    const defaultSize = 0.125;

    // 立方体
    document.getElementById('addCube').addEventListener('click', () => {
      const geometry = new THREE.BoxGeometry(defaultSize, defaultSize, defaultSize);
      PlacementFeatures.requestAddObject(geometry, this.appContext); // ★ 呼び出しを変更
    });

    // 球体
    document.getElementById('addSphere').addEventListener('click', () => {
      const radius = defaultSize / 2;
      const geometry = new THREE.SphereGeometry(radius, 32, 16);
      PlacementFeatures.requestAddObject(geometry, this.appContext); // ★ 呼び出しを変更
    });

    // 円錐
    document.getElementById('addCone').addEventListener('click', () => {
      const radius = defaultSize / 2;
      const geometry = new THREE.ConeGeometry(radius, defaultSize, 32);
      PlacementFeatures.requestAddObject(geometry, this.appContext); // ★ 呼び出しを変更
    });

    // 円柱
    document.getElementById('addCylinder').addEventListener('click', () => {
      const radius = defaultSize / 2;
      const geometry = new THREE.CylinderGeometry(radius, radius, defaultSize, 32);
      PlacementFeatures.requestAddObject(geometry, this.appContext); // ★ 呼び出しを変更
    });

    // 多角形柱
    document.getElementById('addPrism').addEventListener('click', () => {
      document.getElementById('prismModal').style.display = 'flex';
    });
    document.getElementById('cancelPrism').addEventListener('click', () => {
      document.getElementById('prismModal').style.display = 'none';
    });
    document.getElementById('confirmPrism').addEventListener('click', () => {
      const sidesInput = document.getElementById('sidesInput');
      let sides = parseInt(sidesInput.value, 10);
      sides = Math.max(3, Math.min(64, sides || 6));
      sidesInput.value = sides;
      const radius = defaultSize / 2;
      const geometry = new THREE.CylinderGeometry(radius, radius, defaultSize, sides);
      PlacementFeatures.requestAddObject(geometry, this.appContext); // ★ 呼び出しを変更
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
      this.history.execute(
        new MacroCommand(
          selected.map((obj) => new DeleteObjectCommand(obj, this.mechaGroup)),
          `選択した ${selected.length} 個のオブジェクトを削除`
        )
      );
      this.appState.clearSelection();
    });
  }

  setupFileIO() {
    const fileInput = document.getElementById('fileInput');
    document.getElementById('save').addEventListener('click', () => {
      SceneIO.autoSaveScene(this.appContext);
      const dataString = localStorage.getItem('mechaCreatorAutoSave');
      if (!dataString) return this.log('保存データなし');
      const blob = new Blob([dataString], {type: 'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'mecha-data.json';
      a.click();
      URL.revokeObjectURL(a.href);
      this.log('データ保存');
    });
    document.getElementById('load').addEventListener('click', () => fileInput.click());
    // ★★★ ここからOBJインポート処理を追加 ★★★
    document.getElementById('importObj').addEventListener('click', () => objFileInput.click());

    // ★★★ ここから修正 ★★★
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        const fileContent = re.target.result;
        // ファイル内容がJSON形式で始まっているか簡易的にチェック
        if (!fileContent.trim().startsWith('{')) {
          this.log('エラー: このファイルは有効なシーンデータではありません。OBJモデルは「OBJ読込」ボタンからインポートしてください。');
          return;
        }
        try {
          SceneIO.loadFromData(this.appContext, JSON.parse(fileContent));
        } catch (err) {
          this.log('ファイル読込失敗: ファイルが破損しているか、形式が正しくありません。');
          console.error(err);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
    // ★★★ 修正はここまで ★★★
    
    // OBJファイルが選択されたときの処理
    objFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        try {
          const loader = new OBJLoader();
          const geometry = loader.parse(re.target.result);

          // ジオメトリが正常に生成されたかチェック
          if (geometry.attributes.position.count === 0) {
            this.log('OBJファイルの解析に失敗しました。対応していない形式の可能性があります。');
            return;
          }

          const material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geometry, material);

          // オブジェクトをシーンの中央に配置
          mesh.position.set(0, 0, 0);

          // ★★★ 修正箇所 ★★★
          // 2つのフラグ/データをuserDataに保存する
          mesh.userData.isImportedOBJ = true;
          mesh.userData.fileName = file.name; // ファイル名を保存

          // 新しいコマンドを使ってオブジェクトをシーンに追加
          this.history.execute(new ImportObjectCommand(mesh, this.mechaGroup, this.appContext.selectionManager, file.name));
        } catch (err) {
          this.log('OBJファイルの読み込み中にエラーが発生しました。');
          console.error(err);
        }
      };
      reader.readAsText(file);
      e.target.value = ''; // 同じファイルを連続で選択できるようにする
    });
    // ★★★ OBJインポート処理ここまで ★★★

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        try {
          SceneIO.loadFromData(this.appContext, JSON.parse(re.target.result));
        } catch (err) {
          this.log('ファイル読込失敗');
          console.error(err);
        }
      };
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
      this.log(this.appState.isMultiSelectMode ? '複数選択モード開始。' : '複数選択モード終了。');
      if (!this.appState.isMultiSelectMode) this.appState.clearSelection();
    });

    panModeButton.addEventListener('click', () => {
      const isPanModeActive = !this.appContext.isPanModeActive;
      document.dispatchEvent(new CustomEvent('setPanMode', {detail: isPanModeActive}));
      panModeButton.style.backgroundColor = isPanModeActive ? '#2ecc71' : '#3498db';
      this.appContext.orbitControls.mouseButtons.LEFT = isPanModeActive ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
      this.log(isPanModeActive ? 'パンモード開始。' : 'パンモード終了。');
    });

    document.addEventListener('setMultiSelectMode', (e) => {
      this.appState.isMultiSelectMode = e.detail;
      multiSelectButton.style.backgroundColor = e.detail ? '#2ecc71' : '#f39c12';
      if (!e.detail) this.log('複数選択モード終了。');
    });
  }

  setupPaintControls() {
    const paintModeButton = document.getElementById('paintModeButton');
    const eyedropperButton = document.getElementById('eyedropperButton');
    const paintControls = document.getElementById('paint-controls');
    const paintConfirmButtons = document.getElementById('paint-confirm-buttons');
    const confirmPaintButton = document.getElementById('confirmPaint');
    const cancelPaintButton = document.getElementById('cancelPaint');

    const currentColorDisplay = document.getElementById('currentColorDisplay');
    const colorPalette = document.getElementById('colorPalette');
    const metalnessSlider = document.getElementById('metalnessSlider');
    const emissiveCheckbox = document.getElementById('emissiveCheckbox');
    const emissiveControls = document.getElementById('emissive-controls');
    const emissiveColorInput = document.getElementById('emissiveColor');
    const emissiveIntensityInput = document.getElementById('emissiveIntensity');
    const emissivePenumbraInput = document.getElementById('emissivePenumbra');

    // スポイトモードのON/OFFをアプリケーションの状態に反映させる
    document.addEventListener('setEyedropperMode', (e) => {
      this.appState.isEyedropperMode = e.detail;
      const cursor = e.detail ? 'crosshair' : 'default';
      for (const key in this.appContext.viewportManager.viewports) {
        this.appContext.viewportManager.viewports[key].element.style.cursor = cursor;
      }
    });

    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    // ★★★ ここからが修正箇所です ★★★
    // ライブペイント編集中のスポイト操作を処理する (修正)
    document.addEventListener('livePaintEyedrop', (e) => {
      if (!this.appState.isLivePaintPreviewMode) return;
      // 受け取った全プロパティでUIを更新
      updateUIFromProps(e.detail);
      // プレビューを適用
      applyLivePreview();
    });

    // ブラシ設定が更新されたときにUIに反映する (新規追加)
    document.addEventListener('updatePaintUIFromBrush', () => {
      if (this.appState.isPaintMode) {
        updateUIFromProps(this.appState.brushProperties);
      }
    });
    // ★★★ 修正箇所はここまでです ★★★
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

    colorPalette.appendChild(createColorPalette([0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0x999999], 5));

    const allInteractiveElements = [colorPalette, metalnessSlider, emissiveColorInput, emissiveIntensityInput, emissivePenumbraInput, ...document.querySelectorAll('input[name="lightDirection"]')];

    const updateUIFromProps = (props) => {
      currentColorDisplay.style.backgroundColor = `#${props.color.getHexString()}`;
      metalnessSlider.value = props.metalness;
      emissiveCheckbox.checked = props.isEmissive;
      emissiveControls.style.display = props.isEmissive ? 'block' : 'none';
      emissiveColorInput.value = `#${props.emissiveProperties.color.getHexString()}`;
      emissiveIntensityInput.value = props.emissiveProperties.intensity;
      emissivePenumbraInput.value = props.emissiveProperties.penumbra;
      const radio = document.querySelector(`input[name="lightDirection"][value="${props.lightDirection}"]`);
      if (radio) radio.checked = true;
    };

    const applyLivePreview = () => {
      if (!this.appState.isLivePaintPreviewMode) return;
      const currentProps = {
        color: new THREE.Color(currentColorDisplay.style.backgroundColor),
        metalness: parseFloat(metalnessSlider.value),
        isEmissive: emissiveCheckbox.checked,
        lightDirection: document.querySelector('input[name="lightDirection"]:checked').value,
        emissiveProperties: {color: new THREE.Color(emissiveColorInput.value), intensity: parseFloat(emissiveIntensityInput.value), penumbra: parseFloat(emissivePenumbraInput.value)},
      };
      this.appState.selectedObjects.forEach((obj) => {
        obj.material.color.copy(currentProps.color);
        obj.material.metalness = currentProps.metalness;
        if (currentProps.isEmissive) {
          obj.material.emissive.copy(currentProps.emissiveProperties.color);
          obj.material.emissiveIntensity = 1.0;
          let spotLight = obj.getObjectByProperty('isSpotLight', true);
          if (!spotLight) {
            spotLight = new THREE.SpotLight();
            spotLight.name = 'EmissiveLight';
            spotLight.target = new THREE.Object3D();
            spotLight.target.name = 'EmissiveLightTarget';
            obj.add(spotLight, spotLight.target);
          }
          spotLight.color.copy(currentProps.emissiveProperties.color);
          spotLight.intensity = currentProps.emissiveProperties.intensity;
          spotLight.penumbra = currentProps.emissiveProperties.penumbra;
          spotLight.userData.direction = currentProps.lightDirection;
          spotLight.target.position.copy(getVectorFromDirection(currentProps.lightDirection));
        } else {
          obj.material.emissive.set(0x000000);
          const spotLight = obj.getObjectByProperty('isSpotLight', true);
          if (spotLight) obj.remove(spotLight.target, spotLight);
        }
      });
    };

    const exitAllPaintModes = () => {
      this.appState.isPaintMode = false;
      this.appState.isLivePaintPreviewMode = false;
      paintControls.style.display = 'none';
      paintModeButton.style.backgroundColor = '#9b59b6';
      document.dispatchEvent(new CustomEvent('setEyedropperMode', {detail: false}));
      allInteractiveElements.forEach((el) => el.removeEventListener('input', applyLivePreview));
      emissiveCheckbox.removeEventListener('change', applyLivePreview);
      colorPalette.removeEventListener('click', applyLivePreview);
    };

    confirmPaintButton.addEventListener('click', () => {
      // 新しい塗装プロパティをUIから取得
      const paintProps = {
        color: new THREE.Color(currentColorDisplay.style.backgroundColor),
        metalness: parseFloat(metalnessSlider.value),
        isEmissive: emissiveCheckbox.checked,
        lightDirection: document.querySelector('input[name="lightDirection"]:checked').value,
        emissiveProperties: {color: new THREE.Color(emissiveColorInput.value), intensity: parseFloat(emissiveIntensityInput.value), penumbra: parseFloat(emissivePenumbraInput.value)},
      };

      this.appState.brushProperties = {...paintProps, color: paintProps.color.clone(), emissiveProperties: {...paintProps.emissiveProperties, color: paintProps.emissiveProperties.color.clone()}};

      const commands = [];
      // ライブプレビュー開始時に保存した「元の状態(originalState)」を使ってコマンドを生成
      this.appState.livePaintOriginalStates.forEach((originalState, obj) => {
        // 第3引数に originalState を渡す
        commands.push(new PaintObjectCommand(obj, paintProps, originalState));
      });

      if (commands.length > 0) {
        this.history.execute(new MacroCommand(commands, `選択中の ${commands.length} 個のオブジェクトを塗装`));
      }

      exitAllPaintModes();
    });

    cancelPaintButton.addEventListener('click', () => {
      this.appState.livePaintOriginalStates.forEach((originalState, obj) => {
        obj.material.color.copy(originalState.color);
        obj.material.metalness = originalState.metalness;
        obj.material.emissive.copy(originalState.emissive);
        obj.material.emissiveIntensity = originalState.emissiveIntensity;
        const currentLight = obj.getObjectByProperty('isSpotLight', true);
        if (currentLight) obj.remove(currentLight.target, currentLight);
        if (originalState.light) {
          const spotLight = new THREE.SpotLight(originalState.light.color, originalState.light.intensity, 0, undefined, originalState.light.penumbra);
          spotLight.name = 'EmissiveLight';
          spotLight.target = new THREE.Object3D();
          spotLight.target.name = 'EmissiveLightTarget';
          spotLight.userData.direction = originalState.light.direction;
          spotLight.target.position.copy(getVectorFromDirection(originalState.light.direction));
          obj.add(spotLight, spotLight.target);
        }
      });
      exitAllPaintModes();
      this.log('ペイント編集をキャンセルしました。');
    });

    paintModeButton.addEventListener('click', () => {
      if (this.appState.isLivePaintPreviewMode) {
        exitAllPaintModes();
        this.log('ペイント編集を終了しました。');
        return;
      }
      if (this.appState.selectedObjects.length > 0) {
        this.appState.isLivePaintPreviewMode = true;
        this.appState.livePaintOriginalStates.clear();
        const firstObject = this.appState.selectedObjects[0];
        const propsToLoad = {
          color: firstObject.material.color,
          metalness: firstObject.material.metalness,
          isEmissive: firstObject.material.emissive.getHex() > 0,
          emissiveProperties: {color: firstObject.material.emissive, intensity: 1.0, penumbra: 0.2},
          lightDirection: 'neg-z',
        };
        const existingLight = firstObject.getObjectByProperty('isSpotLight', true);
        if (existingLight) {
          propsToLoad.emissiveProperties.intensity = existingLight.intensity;
          propsToLoad.emissiveProperties.penumbra = existingLight.penumbra;
          propsToLoad.lightDirection = existingLight.userData.direction || 'neg-z';
        }
        updateUIFromProps(propsToLoad);
        this.appState.selectedObjects.forEach((obj) => {
          const originalState = {color: obj.material.color.clone(), metalness: obj.material.metalness, emissive: obj.material.emissive.clone(), emissiveIntensity: obj.material.emissiveIntensity};
          const light = obj.getObjectByProperty('isSpotLight', true);
          if (light) originalState.light = {color: light.color.clone(), intensity: light.intensity, penumbra: light.penumbra, direction: light.userData.direction || 'neg-z'};
          this.appState.livePaintOriginalStates.set(obj, originalState);
        });
        paintControls.style.display = 'block';
        paintConfirmButtons.style.display = 'block';
        paintModeButton.style.backgroundColor = '#2ecc71';
        allInteractiveElements.forEach((el) => el.addEventListener('input', applyLivePreview));
        emissiveCheckbox.addEventListener('change', () => {
          emissiveControls.style.display = emissiveCheckbox.checked ? 'block' : 'none';
          applyLivePreview();
        });
        colorPalette.addEventListener('click', applyLivePreview);
        this.log(`選択中の ${this.appState.selectedObjects.length} 個をペイント編集中...`);
        return;
      }
      this.appState.isPaintMode = !this.appState.isPaintMode;
      if (this.appState.isPaintMode) {
        updateUIFromProps(this.appState.brushProperties);
        paintModeButton.style.backgroundColor = '#2ecc71';
        paintControls.style.display = 'block';
        paintConfirmButtons.style.display = 'none';
        if (this.appState.isMultiSelectMode) document.getElementById('multiSelect').click();
        this.appState.clearSelection();
        this.log('ペイントモード開始。');
      } else {
        exitAllPaintModes();
        this.log('ペイントモード終了。');
      }
    });

    eyedropperButton.addEventListener('click', () => {
      if (!this.appState.isPaintMode && !this.appState.isLivePaintPreviewMode) {
        document.getElementById('paintModeButton').click();
      }
      document.dispatchEvent(new CustomEvent('setEyedropperMode', {detail: true}));
      this.log('スポイトモード開始。');
    });

    const updateBrushFromUI = () => {
      if (this.appState.isPaintMode) {
        this.appState.brushProperties.color.set(currentColorDisplay.style.backgroundColor);
        this.appState.brushProperties.metalness = parseFloat(metalnessSlider.value);
        this.appState.brushProperties.isEmissive = emissiveCheckbox.checked;
        this.appState.brushProperties.lightDirection = document.querySelector('input[name="lightDirection"]:checked').value;
        this.appState.brushProperties.emissiveProperties.color.set(emissiveColorInput.value);
        this.appState.brushProperties.emissiveProperties.intensity = parseFloat(emissiveIntensityInput.value);
        this.appState.brushProperties.emissiveProperties.penumbra = parseFloat(emissivePenumbraInput.value);
      }
    };
    allInteractiveElements.forEach((el) => el.addEventListener('input', updateBrushFromUI));
    emissiveCheckbox.addEventListener('change', updateBrushFromUI);

    colorPalette.addEventListener('click', (e) => {
      if (e.target.dataset.color) {
        const selectedColor = parseInt(e.target.dataset.color, 10);

        currentColorDisplay.style.backgroundColor = `#${new THREE.Color(selectedColor).getHexString()}`;

        if (this.appState.isPaintMode) updateBrushFromUI();

        // ライブペイント編集中にもプレビューが即時反映されるようにする
        if (this.appState.isLivePaintPreviewMode) applyLivePreview();
      }
    });

    document.addEventListener('updateCurrentColorDisplay', () => {
      currentColorDisplay.style.backgroundColor = `#${this.appState.brushProperties.color.getHexString()}`;
      if (this.appState.isPaintMode) updateBrushFromUI();
      if (this.appState.isLivePaintPreviewMode) applyLivePreview();
    });
  }
  // ★★★ ゴースト制御用のメソッドを丸ごと追加 ★★★
  setupGhostControls() {
    const guideControlsDiv = document.getElementById('guide-controls');

    guideControlsDiv.addEventListener('change', (event) => {
      // イベントがチェックボックスから発生した場合のみ処理
      if (event.target.type === 'checkbox') {
        const guideName = event.target.dataset.guideName;
        const isVisible = event.target.checked;

        // AppContext経由で対応するガイドを取得
        const guideObject = this.appContext.guides[guideName];

        if (guideObject) {
          guideObject.visible = isVisible;
          this.log(`ゴースト [${guideName}] を${isVisible ? '表示' : '非表示'}にしました。`);
        }
      }
    });
  }
}
