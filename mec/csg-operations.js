import * as THREE from 'three';
import { Brush, Evaluator, ADDITION, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';
import { DeleteObjectCommand, MacroCommand } from './command-edit.js';
import { AddObjectCommand } from './command-create.js';

function performCSG(operation, operationName, context) {
  const { scene, mechaGroup, selectionManager, history, log } = context;
  const selectedObjects = selectionManager.get();

  if (selectedObjects.length < 2) {
    log(`${operationName}するにはオブジェクトを2つ以上選択してください。`);
    return;
  }

  scene.updateMatrixWorld(true);
  const evaluator = new Evaluator();
  let baseMesh = selectedObjects[0];
  const finalMaterial = baseMesh.material.clone();

  for (let i = 1; i < selectedObjects.length; i++) {
    const geometryA = baseMesh.geometry.toNonIndexed().clone().applyMatrix4(baseMesh.matrixWorld);
    const geometryB = selectedObjects[i].geometry.toNonIndexed().clone().applyMatrix4(selectedObjects[i].matrixWorld);
    const brushA = new Brush(geometryA);
    const brushB = new Brush(geometryB);
    const resultMesh = evaluator.evaluate(brushA, brushB, operation);

    if (!resultMesh.geometry.attributes.position || resultMesh.geometry.attributes.position.count === 0) {
      log(`エラー: オブジェクトの${operationName}に失敗しました。` + (operation === INTERSECTION ? '重なっている部分がありません。' : ''));
      return;
    }
    baseMesh = resultMesh;
  }

  const newMesh = baseMesh;
  newMesh.material = finalMaterial;
  newMesh.geometry.computeVertexNormals();
  newMesh.material.side = THREE.DoubleSide;

  const commands = [];
  selectedObjects.forEach((obj) => {
    commands.push(new DeleteObjectCommand(obj, mechaGroup));
  });
  commands.push(new AddObjectCommand(newMesh, mechaGroup, selectionManager, true));
  history.execute(new MacroCommand(commands, `${selectedObjects.length}個のオブジェクトを${operationName}`));
  selectionManager.set([newMesh]);
}

export function performUnion(context) {
  performCSG(ADDITION, '合体', context);
}

export function performIntersect(context) {
  performCSG(INTERSECTION, '交差', context);
}

export function startSubtractMode(context) {
  const { log, selectionManager, highlightMaterial, originalMaterials, modes } = context;
  const selectedObjects = selectionManager.get();

  if (selectedObjects.length < 2) {
    log('掘削するにはオブジェクトを2つ以上選択してください。');
    return;
  }
  modes.isSubtractMode = true;
  modes.subtractTargets = [...selectedObjects];

  originalMaterials.clear();
  modes.subtractTargets.forEach((obj) => {
    originalMaterials.set(obj, obj.material);
    obj.material = highlightMaterial;
  });

  document.getElementById('subtractObjects').style.display = 'none';
  document.getElementById('cancelSubtract').style.display = 'inline-block';

  selectionManager.clear();
  log('掘削モード: 掘削に使うオブジェクト（ドリル）を1つクリックしてください。Escキーでキャンセル。');
}

export function cancelSubtractMode(context) {
  const { modes, log, originalMaterials } = context;
  if (!modes.isSubtractMode) return;
  
  modes.subtractTargets.forEach((obj) => {
    if (originalMaterials.has(obj)) {
      obj.material = originalMaterials.get(obj);
    }
  });
  originalMaterials.clear();

  modes.isSubtractMode = false;
  modes.subtractTargets = [];

  document.getElementById('subtractObjects').style.display = 'inline-block';
  document.getElementById('cancelSubtract').style.display = 'none';
  log('掘削モードをキャンセルしました。');
}

export function performSubtract(baseObjects, drillObject, context) {
  const { scene, mechaGroup, selectionManager, history, log, originalMaterials, modes } = context;

  modes.subtractTargets.forEach((obj) => {
    if (originalMaterials.has(obj)) {
      obj.material = originalMaterials.get(obj);
    }
  });
  originalMaterials.clear();

  scene.updateMatrixWorld(true);
  const evaluator = new Evaluator();

  let baseMesh = baseObjects[0];
  const finalMaterial = baseMesh.material.clone();

  if (baseObjects.length > 1) {
    let combinedMesh = baseObjects[0];
    for (let i = 1; i < baseObjects.length; i++) {
      const geomA = combinedMesh.geometry.toNonIndexed().clone().applyMatrix4(combinedMesh.matrixWorld);
      const geomB = baseObjects[i].geometry.toNonIndexed().clone().applyMatrix4(baseObjects[i].matrixWorld);
      const brushA = new Brush(geomA);
      const brushB = new Brush(geomB);
      combinedMesh = evaluator.evaluate(brushA, brushB, ADDITION);
      combinedMesh.updateMatrixWorld(true);
    }
    baseMesh = combinedMesh;
  }

  const finalBaseGeometry = baseMesh.geometry.toNonIndexed().clone().applyMatrix4(baseMesh.matrixWorld);
  const drillGeometry = drillObject.geometry.toNonIndexed().clone().applyMatrix4(drillObject.matrixWorld);

  const baseBrush = new Brush(finalBaseGeometry);
  const drillBrush = new Brush(drillGeometry);

  const resultMesh = evaluator.evaluate(baseBrush, drillBrush, SUBTRACTION);

  if (!resultMesh.geometry.attributes.position || resultMesh.geometry.attributes.position.count === 0) {
    log('エラー: 掘削に失敗しました。完全にくり抜かれたか、形状が複雑すぎる可能性があります。');
    cancelSubtractMode(context);
    return;
  }

  const newMesh = resultMesh;
  newMesh.material = finalMaterial;
  newMesh.geometry.computeVertexNormals();
  newMesh.material.side = THREE.DoubleSide;

  const commands = [];
  modes.subtractTargets.forEach((obj) => {
    commands.push(new DeleteObjectCommand(obj, mechaGroup));
  });
  commands.push(new AddObjectCommand(newMesh, mechaGroup, selectionManager, true));

  history.execute(new MacroCommand(commands, 'オブジェクトを掘削'));

  selectionManager.set([newMesh]);
  cancelSubtractMode(context);
}