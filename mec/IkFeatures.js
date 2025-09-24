import * as THREE from 'three';
import { JointTransformCommand } from './CommandEdit.js';

// --- グローバル状態管理 ---
let ikState = {
    isDragging: false,
    draggedObject: null,
    ikChainPath: null,    // [A, B, C]
    jointChain: null,     // [J1, J2]
    // Undo/Redo用
    initialStates: null,
};

// =====================================================================
// === 1. IKの準備 (変更なし)
// =====================================================================

export function prepareIK(selectedObject, allObjects, allJoints, pinnedObjects) {
    const graph = buildJointGraph(allObjects, allJoints);
    if (!graph.has(selectedObject.uuid)) return null;

    const validAnchors = pinnedObjects.filter(p => graph.has(p.uuid));
    if (validAnchors.length === 0) return null;

    const root = findClosestAnchor(selectedObject, validAnchors, graph);
    if (!root) return null;

    const pathFromRoot = findPath(root, selectedObject, graph);
    if (!pathFromRoot) return null;

    const jointChain = [];
    for (let i = 0; i < pathFromRoot.length - 1; i++) {
        const parent = pathFromRoot[i];
        const child = pathFromRoot[i + 1];
        const joint = allJoints.find(j =>
            (j.userData.parentObject === parent.uuid && j.userData.childObjects.includes(child.uuid)) ||
            (j.userData.parentObject === child.uuid && j.userData.childObjects.includes(parent.uuid))
        );
        if (joint) {
            jointChain.push(joint);
        } else {
            console.error("Could not find joint between:", parent.name, "and", child.name);
            return null;
        }
    }

    return {
        root: root,
        path: pathFromRoot, // [A, B, C]
        joints: jointChain, // [J1, J2]
    };
}

function buildJointGraph(allObjects, allJoints) {
    const graph = new Map();
    allObjects.forEach(obj => {
        graph.set(obj.uuid, { object: obj, neighbors: new Set() });
    });
    allJoints.forEach(joint => {
        const parentUUID = joint.userData.parentObject;
        const childUUIDs = joint.userData.childObjects || [];
        if (graph.has(parentUUID)) {
            childUUIDs.forEach(childUUID => {
                if (graph.has(childUUID)) {
                    graph.get(parentUUID).neighbors.add(childUUID);
                    graph.get(childUUID).neighbors.add(parentUUID);
                }
            });
        }
    });
    return graph;
}

function findClosestAnchor(startObject, anchors, graph) {
    const queue = [{ uuid: startObject.uuid }];
    const visited = new Set([startObject.uuid]);
    const anchorUUIDs = new Set(anchors.map(a => a.uuid));
    while (queue.length > 0) {
        const { uuid } = queue.shift();
        if (anchorUUIDs.has(uuid)) return graph.get(uuid).object;
        for (const neighborUUID of graph.get(uuid).neighbors) {
            if (!visited.has(neighborUUID)) {
                visited.add(neighborUUID);
                queue.push({ uuid: neighborUUID });
            }
        }
    }
    return null;
}

function findPath(startObject, endObject, graph) {
    const queue = [[startObject.uuid]];
    const visited = new Set([startObject.uuid]);
    while (queue.length > 0) {
        const path = queue.shift();
        const lastUUID = path[path.length - 1];
        if (lastUUID === endObject.uuid) return path.map(uuid => graph.get(uuid).object);
        for (const neighborUUID of graph.get(lastUUID).neighbors) {
            if (!visited.has(neighborUUID)) {
                visited.add(neighborUUID);
                queue.push([...path, neighborUUID]);
            }
        }
    }
    return null;
}


// =====================================================================
// === 2. IK操作のメインフロー (変更なし)
// =====================================================================

export function startIKDrag(draggedObject, ikInfo, appContext) {
    if (!ikInfo) return false;
    // --- ▼▼▼ このブロックを貼り付けてください ▼▼▼ ---
    console.log("--- IK Start Debug ---");
    console.log("ドラッグしたオブジェクト:", draggedObject.name);
    console.log("IKチェインのパス:", ikInfo.path.map(obj => obj.name));
    console.log("IKチェインのジョイント:", ikInfo.joints.map(j => j.name));
    // --- ▲▲▲ ここまで ▲▲▲ ---

    // 修正後：シーン上のすべてのオブジェクトとジョイントを対象にする
    const allMovableObjects = [...appContext.mechaGroup.children, ...appContext.jointGroup.children];

    const initialStates = allMovableObjects.map(obj => ({
        object: obj,
        position: obj.position.clone(),
        quaternion: obj.quaternion.clone(),
    }));

    ikState = {
        isDragging: true,
        draggedObject: draggedObject,
        ikChainPath: ikInfo.path,
        jointChain: ikInfo.joints,
        targetPosition: new THREE.Vector3(),
        initialStates: initialStates,
    };

    appContext.log('IK操作開始...');
    return true;
}


export function solveIK(event, appContext) {
    if (!ikState.isDragging) return;

    const { viewportManager } = appContext;
    const clickedViewportInfo = viewportManager.getViewportFromEvent(event);
    if (!clickedViewportInfo) return;
    const pointer = new THREE.Vector2(
        ((event.clientX - clickedViewportInfo.rect.left) / clickedViewportInfo.rect.width) * 2 - 1,
        -((event.clientY - clickedViewportInfo.rect.top) / clickedViewportInfo.rect.height) * 2 + 1
    );
    const camera = viewportManager.viewports[clickedViewportInfo.key].camera;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new THREE.Vector3()),
        ikState.draggedObject.position
    );

    raycaster.ray.intersectPlane(dragPlane, ikState.targetPosition);

    if (ikState.targetPosition) {
        solveCCD_IK();
    }
}


export function endIKDrag(appContext) {
    if (!ikState.isDragging) return;
    const { history, log } = appContext;

    const finalStates = ikState.initialStates.map(state => ({
        object: state.object,
        position: state.object.position.clone(),
        quaternion: state.object.quaternion.clone(),
    }));

    const hasChanged = ikState.initialStates.some((initial, index) => {
        const final = finalStates[index];
        return !initial.position.equals(final.position) || !initial.quaternion.equals(final.quaternion);
    });

    if (hasChanged) {
        const command = new JointTransformCommand(ikState.initialStates, finalStates);
        history.execute(command);
    }

    log('IK操作完了');
    ikState = {};
}


// =====================================================================
// === 3. 正常に動作していたIK実装
// =====================================================================
function solveCCD_IK() {
    const chain = ikState.ikChainPath; // 今回の例では [A, B]
    const joints = ikState.jointChain;   // 今回の例では [J1]
    const target = ikState.targetPosition;
    const effector = chain[chain.length - 1]; // 今回の例では B

    // 1. 計算前に初期状態に戻す
    ikState.initialStates.forEach(state => {
        state.object.position.copy(state.position);
        state.object.quaternion.copy(state.quaternion);
    });

    const iterations = 10;
    const tolerance = 0.01;

    // --- ここからがIK計算のメインループ（変更なし） ---
    for (let iter = 0; iter < iterations; iter++) {
        if (effector.position.distanceTo(target) < tolerance) break;
        for (let i = joints.length - 1; i >= 0; i--) {
            const joint = joints[i];
            const pivot = joint.position.clone();
            const jointAxisLocal = joint.userData.axis || new THREE.Vector3(0, 1, 0);
            const jointAxisWorld = jointAxisLocal.clone().applyQuaternion(joint.quaternion).normalize();
            const toEffector = new THREE.Vector3().subVectors(effector.position, pivot);
            const toTarget = new THREE.Vector3().subVectors(target, pivot);
            const toEffectorProjected = toEffector.clone().projectOnPlane(jointAxisWorld).normalize();
            const toTargetProjected = toTarget.clone().projectOnPlane(jointAxisWorld).normalize();
            let angle = Math.acos(toEffectorProjected.dot(toTargetProjected));
            const cross = new THREE.Vector3().crossVectors(toEffectorProjected, toTargetProjected);
            if (cross.dot(jointAxisWorld) < 0) {
                angle = -angle;
            }
            if (isNaN(angle) || Math.abs(angle) < 0.001) {
                continue;
            }
            const constrainedDeltaQuat = new THREE.Quaternion().setFromAxisAngle(jointAxisWorld, angle);
            for (let j = i; j < joints.length; j++) {
                const currentJoint = joints[j];
                const currentObject = chain[j + 1];
                currentObject.position.sub(pivot);
                currentObject.position.applyQuaternion(constrainedDeltaQuat);
                currentObject.position.add(pivot);
                currentObject.quaternion.premultiply(constrainedDeltaQuat);
                currentJoint.position.sub(pivot);
                currentJoint.position.applyQuaternion(constrainedDeltaQuat);
                currentJoint.position.add(pivot);
                currentJoint.quaternion.premultiply(constrainedDeltaQuat);
            }
        }
    }
    // --- IK計算のメインループここまで ---


    // --- ▼▼▼ ここからが追加した「後続オブジェクト追従」の処理 ▼▼▼ ---

    // 2. ドラッグされたオブジェクト（B）の計算前後の状態を取得
    const draggedObject = ikState.draggedObject; // B
    const initialState = ikState.initialStates.find(s => s.object === draggedObject);

    if (initialState) {
        // 3. Bがどれだけ回転したかの差分を計算
        const invInitialQuat = initialState.quaternion.clone().invert();
        const deltaQuat = draggedObject.quaternion.clone().multiply(invInitialQuat);

        // 4. Bより先にあるオブジェクトを全て見つける (幅優先探索)
        const allObjectsAndJoints = new Map(ikState.initialStates.map(s => [s.object.uuid, s.object]));
        const graph = buildJointGraph(Array.from(allObjectsAndJoints.values()), ikState.jointChain);
        
        const descendants = new Set();
        const queue = [draggedObject.uuid];
        const visited = new Set([draggedObject.uuid]);

        // IKチェーンの根本側（A）には遡らないように、親を訪問済みリストに入れる
        if (chain.length > 1) {
           const parentInChain = chain[chain.indexOf(draggedObject) - 1];
           if(parentInChain) visited.add(parentInChain.uuid);
        }

        while (queue.length > 0) {
            const currentUuid = queue.shift();
            const neighbors = graph.get(currentUuid)?.neighbors || [];
            
            for (const neighborUuid of neighbors) {
                if (!visited.has(neighborUuid)) {
                    visited.add(neighborUuid);
                    const neighborObject = allObjectsAndJoints.get(neighborUuid);
                    if (neighborObject) {
                        descendants.add(neighborObject);
                        queue.push(neighborUuid);
                    }
                }
            }
        }

        // 5. 見つけた後続オブジェクト（J2, C）に差分の変形を適用
        descendants.forEach(descendant => {
            const descInitialState = ikState.initialStates.find(s => s.object === descendant);
            if (descInitialState) {
                // 回転を適用
                descendant.quaternion.copy(descInitialState.quaternion).premultiply(deltaQuat);
                
                // 位置を適用 (Bの初期位置を基点に回転させる)
                descendant.position.copy(descInitialState.position)
                    .sub(initialState.position) // Bの初期位置からの相対位置ベクトル
                    .applyQuaternion(deltaQuat)   // Bの回転に合わせる
                    .add(draggedObject.position); // Bの新しい位置に平行移動
            }
        });
    }

    // --- ▲▲▲ 追加処理ここまで ▲▲▲ ---


    // ルートの状態を初期状態に戻す（変更なし）
    const root = chain[0];
    const initialRootState = ikState.initialStates.find(s => s.object === root);
    if (initialRootState) {
        root.position.copy(initialRootState.position);
        root.quaternion.copy(initialRootState.quaternion);
    }
}