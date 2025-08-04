import * as THREE from 'three';
// ★★★ IkTransformCommand の代わりに JointTransformCommand を使う ★★★
import { JointTransformCommand } from './CommandEdit.js';

let ikDragStartState = null;

/**
 * IK操作のエンドエフェクタを選択し、IKチェーンを特定する
 */
export function selectEndEffector(endEffector, appContext) {
  const {log, state, jointGroup, mechaGroup, selectionBoxes, scene} = appContext;

  state.clearIkSelection();

  scene.updateMatrixWorld(true);
  const ikChain = findIkChain(endEffector, jointGroup.children, mechaGroup.children);

  if (ikChain.length === 0) {
    log('エラー: このパーツからルートへの有効なジョイントチェーンが見つかりません。');
    return;
  }

  state.modes.ik.endEffector = endEffector;
  state.modes.ik.ikChain = ikChain;

  const boxHelper = new THREE.BoxHelper(endEffector, 0x00ff00);
  endEffector.userData.boxHelper = boxHelper;
  selectionBoxes.add(boxHelper);

  ikChain.forEach((joint, index) => {
    const color = index === 0 ? 0xff0000 : 0xffff00;
    joint.material.color.set(color);
  });

  log(`IKエンドエフェクタを選択しました。チェーン長: ${ikChain.length}。ドラッグで操作開始。`);
}

/**
 * エンドエフェクタからルートまでのIKチェーンを探索する
 */
function findIkChain(endEffector, allJoints, allObjects) {
    const chain = [];
    let currentObject = endEffector;

    const childToJointMap = new Map();
    for (const joint of allJoints) {
        if (joint.userData.childObjects) {
            for (const childUuid of joint.userData.childObjects) {
                childToJointMap.set(childUuid, joint);
            }
        }
    }

    for (let i = 0; i < 50; i++) {
        const parentJoint = childToJointMap.get(currentObject.uuid);
        if (!parentJoint) break;
        chain.unshift(parentJoint);

        const parentObject = allObjects.find(o => o.uuid === parentJoint.userData.parentObject);
        if (!parentObject) break;
        currentObject = parentObject;
    }
    return chain;
}

/**
 * あるジョイントが動いたときに、それに追従して動くべき全ての子孫（オブジェクトとジョイント）を取得する
 */
function getChainDescendants(startJoint, allObjects, allJoints) {
    const moveGroup = new Set();
    const queue = [];
    const visited = new Set();

    if (startJoint.userData.childObjects) {
        startJoint.userData.childObjects.forEach(uuid => {
            const childObject = allObjects.find(o => o.uuid === uuid);
            if (childObject) queue.push(childObject);
        });
    }

    while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current.uuid)) continue;
        visited.add(current.uuid);
        moveGroup.add(current);

        const childJoints = allJoints.filter(j => j.userData.parentObject === current.uuid);
        for (const joint of childJoints) {
            moveGroup.add(joint);
            if (joint.userData.childObjects) {
                joint.userData.childObjects.forEach(uuid => {
                    const childObject = allObjects.find(o => o.uuid === uuid);
                    if (childObject) queue.push(childObject);
                });
            }
        }
    }
    return Array.from(moveGroup);
}


/**
 * IKドラッグ操作を開始する (アンドゥ用に状態を保存)
 */
export function startIkDrag(event, appContext) {
  const {state, log, mechaGroup, jointGroup} = appContext;
  if (!state.modes.ik.endEffector || state.modes.ik.ikChain.length === 0) {
    return false;
  }
  state.modes.ik.isDragging = true;

  // ★★★ 操作対象となる全てのオブジェクトの初期状態を保存 ★★★
  const affectedObjects = new Set(state.modes.ik.ikChain);
  state.modes.ik.ikChain.forEach(joint => {
      const descendants = getChainDescendants(joint, mechaGroup.children, jointGroup.children);
      descendants.forEach(desc => affectedObjects.add(desc));
  });

  ikDragStartState = {
    // JointTransformCommandで使えるように、{object, position, rotation}の形式で保存
    initialStates: Array.from(affectedObjects).map(obj => ({
        object: obj,
        position: obj.position.clone(),
        rotation: obj.rotation.clone(),
    })),
    affectedObjects: Array.from(affectedObjects),
  };

  log('IK操作開始...');
  return true;
}

/**
 * IK計算を実行し、モデルのポーズを更新する
 */
export function solveIk(event, appContext) {
    const { state, viewportManager, scene, mechaGroup, jointGroup } = appContext;
    const { ikChain, endEffector } = state.modes.ik;
    if (!ikChain || !endEffector || !state.modes.ik.isDragging) return;

    const clickedViewportInfo = viewportManager.getViewportFromEvent(event);
    if (!clickedViewportInfo) return;

    const pointer = new THREE.Vector2(
        ((event.clientX - clickedViewportInfo.rect.left) / clickedViewportInfo.rect.width) * 2 - 1,
        -((event.clientY - clickedViewportInfo.rect.top) / clickedViewportInfo.rect.height) * 2 + 1
    );

    const camera = viewportManager.viewports[clickedViewportInfo.key].camera;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);

    const endEffectorPos = new THREE.Vector3();
    endEffector.getWorldPosition(endEffectorPos);
    
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), endEffectorPos);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    if(!target) return;

    const iterations = 15;
    const tolerance = 0.01;

    scene.updateMatrixWorld(true);

    for (let i = 0; i < iterations; i++) {
        const effectorPos = new THREE.Vector3();
        endEffector.getWorldPosition(effectorPos);
        if (effectorPos.distanceTo(target) < tolerance) break;

        for (let j = ikChain.length - 1; j >= 0; j--) {
            const joint = ikChain[j];
            
            const jointWorldPos = new THREE.Vector3();
            joint.getWorldPosition(jointWorldPos);

            const effectorWorldPos = new THREE.Vector3();
            endEffector.getWorldPosition(effectorWorldPos);

            const toEffectorVec = new THREE.Vector3().subVectors(effectorWorldPos, jointWorldPos).normalize();
            const toTargetVec = new THREE.Vector3().subVectors(target, jointWorldPos).normalize();
            
            const deltaRotation = new THREE.Quaternion().setFromUnitVectors(toEffectorVec, toTargetVec);
            
            const moveGroup = getChainDescendants(joint, mechaGroup.children, jointGroup.children);
            // ★★★ ジョイント自身も回転対象に含める ★★★
            moveGroup.push(joint);
            
            for (const obj of moveGroup) {
                const relativePos = new THREE.Vector3().subVectors(obj.position, jointWorldPos);
                relativePos.applyQuaternion(deltaRotation);
                obj.position.copy(jointWorldPos).add(relativePos);
                obj.quaternion.premultiply(deltaRotation);
            }
            
            scene.updateMatrixWorld(true);
        }
    }
}


/**
 * IKドラッグ操作を終了し、履歴にコマンドを登録する (アンドゥ対応)
 */
export function endIkDrag(appContext) {
  const {state, history, log} = appContext;
  if (!state.modes.ik.isDragging || !ikDragStartState) return;

  // ★★★ 影響を受けた全てのオブジェクトの最終状態を取得 ★★★
  const finalStates = ikDragStartState.affectedObjects.map(obj => ({
      object: obj,
      position: obj.position.clone(),
      rotation: obj.rotation.clone(),
  }));

  const hasChanged = ikDragStartState.initialStates.some((initial, index) => {
      const final = finalStates[index];
      return !initial.position.equals(final.position) || !initial.rotation.equals(final.rotation);
  });

  if(hasChanged) {
      // ★★★ 既存のJointTransformCommandを再利用してアンドゥを実現 ★★★
      const command = new JointTransformCommand(ikDragStartState.initialStates, finalStates);
      command.message = 'IK操作'; // メッセージを上書き
      history.execute(command);
  }

  state.modes.ik.isDragging = false;
  ikDragStartState = null;
  log('IK操作完了');
}