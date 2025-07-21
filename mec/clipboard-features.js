import * as THREE from 'three';
import {MirrorCopyCommand, AddObjectCommand} from './command-create.js';
import {MacroCommand} from './command-edit.js';

export function startMirrorCopyMode(context) {
  const {log, transformControls, previewGroup, selectionManager, modes} = context;
  const selectedObjects = selectionManager.get();

  if (selectedObjects.length === 0) {
    log('コピーするオブジェクトが選択されていません。');
    return;
  }
  modes.isMirrorCopyMode = true;
  transformControls.detach();
  log('鏡面コピーモード開始。コピー軸をクリックしてください。');
  document.getElementById('mirrorCopy').style.display = 'none';
  document.getElementById('cancelMirrorCopy').style.display = 'inline-block';
  const previewMaterial = new THREE.MeshStandardMaterial({color: 0x00ff00, transparent: true, opacity: 0.5, depthTest: false});
  ['x', 'y', 'z'].forEach((axis) => {
    const axis_preview_group = new THREE.Group();
    axis_preview_group.userData.mirrorAxis = axis;
    selectedObjects.forEach((obj) => {
      const preview = new THREE.Mesh(obj.geometry, previewMaterial);
      preview.position.copy(obj.position);
      preview.scale.copy(obj.scale);
      preview.position[axis] *= -1;
      const reflectedRotation = obj.rotation.clone();
      if (axis === 'x') {
        reflectedRotation.y *= -1;
        reflectedRotation.z *= -1;
      } else if (axis === 'y') {
        reflectedRotation.x *= -1;
        reflectedRotation.z *= -1;
      } else if (axis === 'z') {
        reflectedRotation.x *= -1;
        reflectedRotation.y *= -1;
      }
      preview.rotation.copy(reflectedRotation);
      preview.scale[axis] *= -1;
      axis_preview_group.add(preview);
    });
    previewGroup.add(axis_preview_group);
  });
}

export function performMirrorCopy(clickedPreview, context) {
  const {mechaGroup, history, selectionManager} = context;
  const selectedObjects = selectionManager.get();
  const axis = clickedPreview.parent.userData.mirrorAxis;
  const commands = [],
    newSelection = [];
  clickedPreview.parent.children.forEach((preview, i) => {
    const newObject = new THREE.Mesh(preview.geometry, selectedObjects[i].material.clone());
    newObject.position.copy(preview.position);
    newObject.rotation.copy(preview.rotation);
    newObject.scale.copy(preview.scale);
    commands.push(new MirrorCopyCommand(newObject, mechaGroup, axis));
    newSelection.push(newObject);
  });
  history.execute(new MacroCommand(commands, `${axis.toUpperCase()}軸に${newSelection.length}個のオブジェクトを鏡面コピー`));
  selectionManager.set(newSelection);
  cancelMirrorCopyMode(context);
}

export function cancelMirrorCopyMode(context) {
  const {modes, previewGroup, state, log} = context; // ★ updateSelection の代わりに state を取得
  if (!modes.isMirrorCopyMode) return;
  modes.isMirrorCopyMode = false;
  while (previewGroup.children.length > 0) {
    const group = previewGroup.children[0];
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    previewGroup.remove(group);
  }
  document.getElementById('mirrorCopy').style.display = 'inline-block';
  document.getElementById('cancelMirrorCopy').style.display = 'none';
  // ★★★ 修正: UI更新を直接呼ぶのではなく、状態変更を通知する ★★★
  state.notifySelectionChange();
}

export function startPastePreview(context) {
  const {log, transformControls, previewGroup, selectionManager, modes} = context;
  const selectedObjects = selectionManager.get();
  if (selectedObjects.length === 0) {
    log('貼り付け先のオブジェクトを選択してください。');
    return;
  }
  if (!modes.clipboard || modes.clipboard.length === 0) {
    log('クリップボードが空です。');
    return;
  }
  modes.isPasteMode = true;
  transformControls.detach();
  const targetBox = new THREE.Box3();
  selectedObjects.forEach((obj) => targetBox.expandByObject(obj));
  const targetSize = targetBox.getSize(new THREE.Vector3());
  const sourceBox = new THREE.Box3();
  const sourceGroup = new THREE.Group();
  modes.clipboard.forEach((clip) => {
    const tempMesh = new THREE.Mesh(clip.geometry);
    tempMesh.scale.copy(clip.source.scale);
    tempMesh.position.copy(clip.source.position);
    sourceGroup.add(tempMesh);
  });
  sourceBox.setFromObject(sourceGroup);
  const sourceSize = sourceBox.getSize(new THREE.Vector3());
  const previewMaterial = new THREE.MeshStandardMaterial({color: 0x00ff00, transparent: true, opacity: 0.5, depthTest: false});
  const directions = [
    {axis: 'x', sign: 1},
    {axis: 'x', sign: -1},
    {axis: 'y', sign: 1},
    {axis: 'y', sign: -1},
    {axis: 'z', sign: 1},
    {axis: 'z', sign: -1},
  ];
  directions.forEach((dir) => {
    const offsetValue = targetSize[dir.axis] / 2 + sourceSize[dir.axis] / 2 + 0.2;
    const offset = new THREE.Vector3();
    offset[dir.axis] = offsetValue * dir.sign;
    const axis_preview_group = new THREE.Group();
    axis_preview_group.userData.offset = offset;
    modes.clipboard.forEach((clip) => {
      const previewObject = new THREE.Mesh(clip.geometry, previewMaterial);
      previewObject.scale.copy(clip.source.scale);
      previewObject.rotation.copy(clip.source.rotation);
      previewObject.position.copy(clip.source.position).add(offset);
      axis_preview_group.add(previewObject);
    });
    previewGroup.add(axis_preview_group);
  });
  log('ペースト先のプレビューをクリックして位置を確定してください。');
}

export function confirmPaste(clickedPreview, context) {
  const {mechaGroup, history, selectionManager, modes} = context;
  const offset = clickedPreview.parent.userData.offset;
  const commands = [];
  const newPastedObjects = [];
  modes.clipboard.forEach((clip) => {
    const newObject = new THREE.Mesh(clip.geometry, clip.material.clone());
    newObject.scale.copy(clip.source.scale);
    newObject.rotation.copy(clip.source.rotation);
    newObject.position.copy(clip.source.position).add(offset);
    commands.push(new AddObjectCommand(newObject, mechaGroup, selectionManager, true));
    newPastedObjects.push(newObject);
  });
  history.execute(new MacroCommand(commands, `${newPastedObjects.length}個のオブジェクトをペースト`));
  modes.lastPasteInfo = {objects: newPastedObjects, offset: offset};
  selectionManager.set(newPastedObjects);
  cancelPasteMode(context);
}

export function performDirectPaste(context) {
  const {mechaGroup, history, selectionManager, modes} = context;
  const offset = modes.lastPasteInfo.offset;
  const commands = [];
  const newPastedObjects = [];
  modes.lastPasteInfo.objects.forEach((lastObj) => {
    const newObject = new THREE.Mesh(lastObj.geometry, lastObj.material.clone());
    newObject.scale.copy(lastObj.scale);
    newObject.rotation.copy(lastObj.rotation);
    newObject.position.copy(lastObj.position).add(offset);
    commands.push(new AddObjectCommand(newObject, mechaGroup, selectionManager, true));
    newPastedObjects.push(newObject);
  });
  history.execute(new MacroCommand(commands, `${newPastedObjects.length}個のオブジェクトをペースト`));
  modes.lastPasteInfo.objects = newPastedObjects;
  selectionManager.set(newPastedObjects);
}

export function cancelPasteMode(context) {
  const {modes, previewGroup, state} = context; // ★ updateSelection の代わりに state を取得
  modes.isPasteMode = false;
  while (previewGroup.children.length > 0) {
    const group = previewGroup.children[0];
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    previewGroup.remove(group);
  }
  // ★★★ 修正: UI更新を直接呼ぶのではなく、状態変更を通知する ★★★
  state.notifySelectionChange();
}
