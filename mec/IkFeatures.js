import * as THREE from 'three';
import { JointTransformCommand } from './CommandEdit.js';

// --- グローバル状態管理 ---
let ikState = {
    isDragging: false,
    draggedObject: null,
    ikChainPath: null,
    jointChain: null,
    initialStates: null,
};

// =====================================================================
// === 1. IKの準備 (ロジックを単一グラフに統一)
// =====================================================================

/**
 * パーツとジョイントをノードとして物理的に接続する単一のグラフを構築する
 * (アンカー探索、経路探索、剛体追従のすべてで使用)
 */
function buildFullConnectionGraph(allObjectsAndJoints, allJoints) {
    const graph = new Map();
    allObjectsAndJoints.forEach(obj => {
        graph.set(obj.uuid, { object: obj, neighbors: new Set() });
    });

    allJoints.forEach(joint => {
        const jointUUID = joint.uuid;
        const parentUUID = joint.userData.parentObject;
        const childUUIDs = joint.userData.childObjects || [];

        // ジョイントと親パーツを相互に接続
        if (graph.has(parentUUID) && graph.has(jointUUID)) {
            graph.get(parentUUID).neighbors.add(jointUUID);
            graph.get(jointUUID).neighbors.add(parentUUID);
        }
        // ジョイントと子パーツを相互に接続
        childUUIDs.forEach(childUUID => {
            if (graph.has(childUUID) && graph.has(jointUUID)) {
                graph.get(childUUID).neighbors.add(jointUUID);
                graph.get(jointUUID).neighbors.add(childUUID);
            }
        });
    });
    return graph;
}

// 汎用的なパス探索 (BFS)
function findPath(startObject, endObject, graph) {
    const queue = [[startObject.uuid]];
    const visited = new Set([startObject.uuid]);
    while (queue.length > 0) {
        const path = queue.shift();
        const lastUUID = path[path.length - 1];
        if (lastUUID === endObject.uuid) return path.map(uuid => graph.get(uuid).object);
        for (const neighborUUID of graph.get(lastUUID)?.neighbors || []) {
            if (!visited.has(neighborUUID)) {
                visited.add(neighborUUID);
                queue.push([...path, neighborUUID]);
            }
        }
    }
    return null;
}

// 汎用的な最近傍アンカー探索 (BFS)
function findClosestAnchor(startObject, anchors, graph) {
    const queue = [{ uuid: startObject.uuid }];
    const visited = new Set([startObject.uuid]);
    const anchorUUIDs = new Set(anchors.map(a => a.uuid));
    while (queue.length > 0) {
        const { uuid } = queue.shift();
        if (anchorUUIDs.has(uuid)) return graph.get(uuid).object;
        for (const neighborUUID of graph.get(uuid)?.neighbors || []) {
            if (!visited.has(neighborUUID)) {
                visited.add(neighborUUID);
                queue.push({ uuid: neighborUUID });
            }
        }
    }
    return null;
}

export function prepareIK(selectedObject, allObjectsAndJoints, allJoints, pinnedObjects) {
    // 1. 物理的な接続を反映した単一のグラフを構築
    const fullGraph = buildFullConnectionGraph(allObjectsAndJoints, allJoints);
    if (!fullGraph.has(selectedObject.uuid)) return null;

    // 2. 有効なアンカー（ピン留めされたオブジェクト）を確認
    const validAnchors = pinnedObjects.filter(p => fullGraph.has(p.uuid));
    if (validAnchors.length === 0) return null;

    // 3. グラフを使って、選択オブジェクトから最も近いアンカー（暫定ルート）を探す
    const provisionalRoot = findClosestAnchor(selectedObject, validAnchors, fullGraph);
    if (!provisionalRoot) return null;

    // 4. 暫定ルートから選択オブジェクトまでの完全なパスを探す
    const provisionalPath = findPath(provisionalRoot, selectedObject, fullGraph);
    if (!provisionalPath) return null;

    // =======================================================
    // ▼▼▼ 原因調査のためのデバッグコードです ▼▼▼
    console.log("--- IK Path Debug ---");
    console.log(`Provisional Path from: "${provisionalRoot.name}" to "${selectedObject.name}"`);
    provisionalPath.forEach(node => {
        const neighborCount = fullGraph.get(node.uuid)?.neighbors.size || 0;
        console.log(`- Node: "${node.name}", Is Joint: ${!!node.userData.isJoint}, Connections: ${neighborCount}`);
    });
    console.log("-----------------------");
    // ▲▲▲ ここまで ▲▲▲
    // =======================================================

    // 5. パスを逆（選択オブジェクト側）から辿り、最初の分岐点（接続数が3以上）を探す
    let newRoot = null;
    for (let i = provisionalPath.length - 2; i > 0; i--) {
        const node = provisionalPath[i];
        if (!node.userData.isJoint && fullGraph.get(node.uuid).neighbors.size >= 3) {
            newRoot = node;
            console.log(`IKルートを分岐点 (${newRoot.name}) に変更しました。`);
            break;
        }
    }

    // 6. 最終的なルートとパスを決定する
    let finalRoot, finalFullPath;
    if (newRoot) {
        finalRoot = newRoot;
        finalFullPath = findPath(finalRoot, selectedObject, fullGraph);
    } else {
        finalRoot = provisionalRoot;
        finalFullPath = provisionalPath;
    }

    if (!finalFullPath) {
        console.error("最終的なIKパスの計算に失敗しました。");
        return null;
    }

    // 7. 完全なパスから、パーツのリストとジョイントのリストをそれぞれ抽出する
    const pathFromRoot = finalFullPath.filter(obj => !obj.userData.isJoint);
    const jointChain = finalFullPath.filter(obj => obj.userData.isJoint);

    // 8. パスが有効か基本的な検証を行う
    if (pathFromRoot.length < 2 || jointChain.length < 1) {
        console.error("Failed to resolve a valid IK chain.", { pathFromRoot, jointChain });
        return null;
    }

    return {
        root: finalRoot,
        path: pathFromRoot,
        joints: jointChain,
    };
}

// =====================================================================
// === 2. IK操作のメインフロー
// =====================================================================

export function startIKDrag(draggedObject, ikInfo, appContext) {
    if (!ikInfo) return false;

    console.log("--- IK Start Debug ---");
    console.log("ドラッグしたオブジェクト:", draggedObject.name);
    console.log("IKチェインのパス:", ikInfo.path.map(obj => obj.name));
    console.log("IKチェインのジョイント:", ikInfo.joints.map(j => j.name));

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
// === 3. IK実装
// =====================================================================
function solveCCD_IK() {
    const chain = ikState.ikChainPath;
    const joints = ikState.jointChain;
    const target = ikState.targetPosition;
    const effector = chain[chain.length - 1];

    ikState.initialStates.forEach(state => {
        state.object.position.copy(state.position);
        state.object.quaternion.copy(state.quaternion);
    });

    const iterations = 10;
    const tolerance = 0.01;

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

    const draggedObject = ikState.draggedObject;
    const initialState = ikState.initialStates.find(s => s.object === draggedObject);

    if (initialState) {
        const invInitialQuat = initialState.quaternion.clone().invert();
        const deltaQuat = draggedObject.quaternion.clone().multiply(invInitialQuat);

        const allObjectsFromState = ikState.initialStates.map(s => s.object);
        const allJointsFromState = allObjectsFromState.filter(o => o.userData.isJoint);
        const graph = buildFullConnectionGraph(allObjectsFromState, allJointsFromState);
        
        const descendants = new Set();
        const queue = [draggedObject.uuid];
        
        const visited = new Set([draggedObject.uuid]);
        const draggedIndexInChain = chain.indexOf(draggedObject);
        for (let i = 0; i < draggedIndexInChain; i++) {
            visited.add(chain[i].uuid);
            if(joints[i]) visited.add(joints[i].uuid);
        }
        
        const allObjectsMap = new Map(ikState.initialStates.map(s => [s.object.uuid, s.object]));

        while (queue.length > 0) {
            const currentUuid = queue.shift();
            const neighbors = graph.get(currentUuid)?.neighbors || [];
            
            for (const neighborUuid of neighbors) {
                if (!visited.has(neighborUuid)) {
                    visited.add(neighborUuid);
                    const neighborObject = allObjectsMap.get(neighborUuid);
                    if (neighborObject) {
                        descendants.add(neighborObject);
                        queue.push(neighborUuid);
                    }
                }
            }
        }
        
        descendants.forEach(descendant => {
            const descInitialState = ikState.initialStates.find(s => s.object === descendant);
            if (descInitialState) {
                descendant.quaternion.copy(descInitialState.quaternion).premultiply(deltaQuat);
                const newPos = descInitialState.position.clone()
                    .sub(initialState.position)
                    .applyQuaternion(deltaQuat)
                    .add(draggedObject.position);
                descendant.position.copy(newPos);
            }
        });
    }

    const root = chain[0];
    const initialRootState = ikState.initialStates.find(s => s.object === root);
    if (initialRootState) {
        root.position.copy(initialRootState.position);
        root.quaternion.copy(initialRootState.quaternion);
    }
}