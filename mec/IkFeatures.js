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
// === 1. IKの準備 (グラフ作成ロジックを分離・修正)
// =====================================================================

// [グラフ1] パーツとパーツを直接接続するグラフ (IKチェインのパス探索用)
function buildPartConnectionGraph(allMechaParts, allJoints) {
    const graph = new Map();
    allMechaParts.forEach(obj => {
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

// [グラフ2] パーツとジョイントをノードとして物理的に接続するグラフ (アンカー探索、剛体追従用)
function buildFullConnectionGraph(allObjectsAndJoints, allJoints) {
    const graph = new Map();
    allObjectsAndJoints.forEach(obj => {
        graph.set(obj.uuid, { object: obj, neighbors: new Set() });
    });

    allJoints.forEach(joint => {
        const jointUUID = joint.uuid;
        const parentUUID = joint.userData.parentObject;
        const childUUIDs = joint.userData.childObjects || [];

        if (graph.has(parentUUID) && graph.has(jointUUID)) {
            graph.get(parentUUID).neighbors.add(jointUUID);
            graph.get(jointUUID).neighbors.add(parentUUID);
        }
        childUUIDs.forEach(childUUID => {
            if (graph.has(childUUID) && graph.has(jointUUID)) {
                graph.get(childUUID).neighbors.add(jointUUID);
                // ★★★ ここが修正されたバグです ★★★
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
    const fullGraph = buildFullConnectionGraph(allObjectsAndJoints, allJoints);
    if (!fullGraph.has(selectedObject.uuid)) return null;

    const validAnchors = pinnedObjects.filter(p => fullGraph.has(p.uuid));
    if (validAnchors.length === 0) return null;

    const root = findClosestAnchor(selectedObject, validAnchors, fullGraph);
    if (!root) return null;

    const allMechaParts = allObjectsAndJoints.filter(o => !o.userData.isJoint);
    const partGraph = buildPartConnectionGraph(allMechaParts, allJoints);
    
    const pathFromRoot = findPath(root, selectedObject, partGraph);
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
        path: pathFromRoot,
        joints: jointChain,
    };
}


// =====================================================================
// === 2. IK操作のメインフロー (変更なし)
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
// === 3. IK実装 (変更なし)
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