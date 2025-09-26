/*
 * =======================================================================
 * Position-Based Dynamics IKソルバー (記念保存版)
 * =======================================================================
 *
 * このファイルは、我々が探求した道のりの記念碑である。
 *
 * これは、多点アンカー（複数ピン留め）と物理ベースの挙動を実装することに成功した、
 * 完全に動作するPBDベースのIKソルバーである。
 * しかし、開発を進める中で、我々は根本的な限界に突き当たった。
 * それは、ソルバーが算出した物理的に正しい「位置」と、円柱ジョイントなどが持つ
 * 回転の制約を、矛盾なく両立させることの困難さである。
 *
 * この「ほぼ完璧だった」ソルバーから得られた教訓は、
 * 最終的に完成した、より安定かつ直感的な「経路探索IKシステム」を開発する上で
 * 極めて重要な役割を果たした。
 *
 * このコードは、失敗の証としてではなく、
 * 理想の解を追い求めた、我々の飽くなき探求の証としてここに保存する。
 *
 */
import * as THREE from 'three';
import { JointTransformCommand } from './CommandEdit.js';
// --- グローバル状態管理 ---
let ikState = {
    isDragging: false,
    draggedObject: null,
    initialStates: null, // Map<uuid, {object, position, quaternion}>
    pbd: {
        positions: null,
        constraints: [],
        invMass: null,
        objectMap: new Map(),
        indexMap: new Map(),
        lastTargetPosition: null,
    },
};
// =====================================================================
// === 1. IKの準備 (PBDセットアップ) - 変更なし
// =====================================================================
export function prepareIK(selectedObject, allObjectsAndJoints, allJoints, pinnedObjects) {
    ikState.pbd = {
        positions: [],
        constraints: [],
        invMass: [],
        objectMap: new Map(),
        indexMap: new Map(),
        lastTargetPosition: null,
    };
    const allMovableObjects = new Set(allObjectsAndJoints);
    let index = 0;
    allMovableObjects.forEach(obj => {
        ikState.pbd.objectMap.set(obj.uuid, index);
        ikState.pbd.indexMap.set(index, obj);
        ikState.pbd.positions.push(obj.position.clone());
        const isPinned = pinnedObjects.some(p => p.uuid === obj.uuid);
        ikState.pbd.invMass.push(isPinned ? 0.0 : 1.0);
        index++;
    });
    allJoints.forEach(joint => {
        const jointIndex = ikState.pbd.objectMap.get(joint.uuid);
        if (jointIndex === undefined) return;
        const parentUUID = joint.userData.parentObject;
        const parentIndex = ikState.pbd.objectMap.get(parentUUID);
        if (parentIndex !== undefined) {
            const p1 = ikState.pbd.positions[parentIndex];
            const p2 = ikState.pbd.positions[jointIndex];
            ikState.pbd.constraints.push({
                type: 'distance',
                p1_idx: parentIndex,
                p2_idx: jointIndex,
                dist: p1.distanceTo(p2),
            });
        }
        (joint.userData.childObjects || []).forEach(childUUID => {
            const childIndex = ikState.pbd.objectMap.get(childUUID);
            if (childIndex !== undefined) {
                const p1 = ikState.pbd.positions[childIndex];
                const p2 = ikState.pbd.positions[jointIndex];
                ikState.pbd.constraints.push({
                    type: 'distance',
                    p1_idx: childIndex,
                    p2_idx: jointIndex,
                    dist: p1.distanceTo(p2),
                });
            }
        });
    });
    return { isValid: ikState.pbd.constraints.length > 0 };
}
// =====================================================================
// === 2. IK操作のメインフロー - 変更なし
// =====================================================================
export function startIKDrag(draggedObject, ikInfo, appContext) {
    if (!ikInfo || !ikInfo.isValid) return false;
    const initialStates = new Map();
    ikState.pbd.indexMap.forEach((obj) => {
        initialStates.set(obj.uuid, {
            object: obj,
            position: obj.position.clone(),
            quaternion: obj.quaternion.clone(),
        });
    });
    ikState.isDragging = true;
    ikState.draggedObject = draggedObject;
    ikState.initialStates = initialStates;
    ikState.pbd.lastTargetPosition = draggedObject.position.clone();
    appContext.log('PBD IK操作開始...');
    return true;
}
export function solveIK(event, appContext) {
    if (!ikState.isDragging) return;
    const { pbd } = ikState;
    const draggedIndex = pbd.objectMap.get(ikState.draggedObject.uuid);
    if (draggedIndex === undefined) return;
    const targetPosition = getMouseWorldPosition(event, ikState.draggedObject, appContext);
    if (!targetPosition) return;
    pbd.positions[draggedIndex].copy(targetPosition);
    const solverIterations = 20;
    for (let i = 0; i < solverIterations; i++) {
        pbd.constraints.forEach(c => {
            if (c.type === 'distance') {
                solveDistanceConstraint(c.p1_idx, c.p2_idx, c.dist, pbd);
            }
        });
    }
    pbd.indexMap.forEach((obj, index) => {
        obj.position.copy(pbd.positions[index]);
    });
    updateRotations(pbd, appContext);
}
export function endIKDrag(appContext) {
    if (!ikState.isDragging) return;
    const { history, log } = appContext;
    const finalizationIterations = 100;
    for (let i = 0; i < finalizationIterations; i++) {
        ikState.pbd.constraints.forEach(c => {
            if (c.type === 'distance') {
                solveDistanceConstraint(c.p1_idx, c.p2_idx, c.dist, ikState.pbd);
            }
        });
    }
    ikState.pbd.indexMap.forEach((obj, index) => {
        obj.position.copy(ikState.pbd.positions[index]);
    });
    updateRotations(ikState.pbd, appContext);
    const finalStates = [];
    ikState.initialStates.forEach(state => {
        finalStates.push({
            object: state.object,
            position: state.object.position.clone(),
            quaternion: state.object.quaternion.clone(),
        });
    });
    const initialStatesForCommand = Array.from(ikState.initialStates.values());
    const hasChanged = initialStatesForCommand.some((initial, index) => {
        const final = finalStates[index];
        return !initial.position.equals(final.position) || !initial.quaternion.equals(final.quaternion);
    });
    if (hasChanged) {
        const command = new JointTransformCommand(initialStatesForCommand, finalStates);
        history.execute(command);
    }
    log('IK操作完了');
    ikState = {};
}
// =====================================================================
// === 3. PBDソルバーと回転計算の実装
// =====================================================================
function solveDistanceConstraint(p1_idx, p2_idx, dist, pbd) {
    const { positions, invMass } = pbd;
    const p1 = positions[p1_idx];
    const p2 = positions[p2_idx];
    const w1 = invMass[p1_idx];
    const w2 = invMass[p2_idx];
    const w_sum = w1 + w2;
    if (w_sum === 0) return;
    const delta = new THREE.Vector3().subVectors(p2, p1);
    const currentDist = delta.length();
    if (currentDist === 0) return;
    const error = currentDist - dist;
    const correction = delta.multiplyScalar(error / currentDist / w_sum);
    if (w1 > 0) p1.add(correction.clone().multiplyScalar(w1));
    if (w2 > 0) p2.sub(correction.clone().multiplyScalar(w2));
}
// ========================================================================
// ================== ここからが修正された関数です ==================
// ========================================================================
function updateRotations(pbd, appContext) {
    const { mechaGroup, jointGroup } = appContext;
    const { objectMap, positions, invMass } = pbd;
    const { initialStates } = ikState;
    const getInitialState = (obj) => initialStates.get(obj.uuid);
    // --- ステップ1: 全てのパーツの「理想の回転」を計算し、適用する ---
    mechaGroup.children.forEach(part => {
        const partInitialState = getInitialState(part);
        if (!partInitialState) return;
        const partIndex = objectMap.get(part.uuid);
        // ピン留めされたパーツは回転を初期状態にロック
        if (partIndex !== undefined && invMass[partIndex] === 0) {
            part.quaternion.copy(partInitialState.quaternion);
            return;
        }
        // 接続されたジョイントを探す
        const connectedJoints = [];
        jointGroup.children.forEach(joint => {
            if (joint.userData.parentObject === part.uuid || (joint.userData.childObjects && joint.userData.childObjects.includes(part.uuid))) {
                connectedJoints.push(joint);
            }
        });
        if (connectedJoints.length === 0) return;
        // 接続ジョイントの初期位置と現在位置から、パーツの回転を導出 (Shape Matching)
        let v_initial, v_current;
        if (connectedJoints.length >= 2) {
            const j1 = connectedJoints[0], j2 = connectedJoints[1];
            const j1Initial = getInitialState(j1), j2Initial = getInitialState(j2);
            const j1CurrentPos = positions[objectMap.get(j1.uuid)], j2CurrentPos = positions[objectMap.get(j2.uuid)];
            if (!j1Initial || !j2Initial || !j1CurrentPos || !j2CurrentPos) return;
            v_initial = new THREE.Vector3().subVectors(j2Initial.position, j1Initial.position);
            v_current = new THREE.Vector3().subVectors(j2CurrentPos, j1CurrentPos);
        } else {
            const j1 = connectedJoints[0];
            const j1Initial = getInitialState(j1);
            const partCurrentPos = positions[objectMap.get(part.uuid)], j1CurrentPos = positions[objectMap.get(j1.uuid)];
            if (!j1Initial || !partCurrentPos || !j1CurrentPos) return;
            v_initial = new THREE.Vector3().subVectors(j1Initial.position, partInitialState.position);
            v_current = new THREE.Vector3().subVectors(j1CurrentPos, partCurrentPos);
        }
        // 回転を計算して適用
        if (v_initial.lengthSq() > 0.0001 && v_current.lengthSq() > 0.0001) {
            const q_delta = new THREE.Quaternion().setFromUnitVectors(v_initial.normalize(), v_current.normalize());
            part.quaternion.multiplyQuaternions(q_delta, partInitialState.quaternion);
        } else {
            part.quaternion.copy(partInitialState.quaternion);
        }
    });
    // --- ステップ2: ジョイントを更新し、回転制約を適用する ---
    jointGroup.children.forEach(joint => {
        const parent = mechaGroup.getObjectByProperty('uuid', joint.userData.parentObject);
        if (!parent) return;
        // ジョイントは常に親パーツの回転に追従する
        joint.quaternion.copy(parent.quaternion);
        // 円柱ジョイントの場合、接続されている子パーツの回転を制約する
        if (joint.userData.type === 'cylinder') {
            (joint.userData.childObjects || []).forEach(childUUID => {
                const child = mechaGroup.getObjectByProperty('uuid', childUUID);
                if (!child) return;
                // 1. 親から見た子の「理想の相対回転」を計算
                const q_relative_goal = parent.quaternion.clone().invert().multiply(child.quaternion);
                // 2. 制約軸（円柱ジョイントのローカルY軸）を定義
                const axis = new THREE.Vector3(0, 1, 0);
                // 3. 正しい方法でツイスト成分を抽出する
                // クォータニオンのベクトル部と制約軸でドット積を計算
                const dot = axis.x * q_relative_goal.x + axis.y * q_relative_goal.y + axis.z * q_relative_goal.z;
                // ドット積の結果を使って、軸周りの回転成分（ツイスト）だけを持つクォータニオンを作成
                const twist = new THREE.Quaternion(
                    axis.x * dot,
                    axis.y * dot,
                    axis.z * dot,
                    q_relative_goal.w
                ).normalize(); // 必ず正規化する
                // 4. 子パーツの最終的な回転を「親の回転」＋「許可されたツイスト回転」で再構成
                child.quaternion.multiplyQuaternions(parent.quaternion, twist);
            });
        }
    });
}
// ========================================================================
// ================== 修正された関数のここまで ==================
// ========================================================================
function getMouseWorldPosition(event, draggedObject, appContext) {
    const { viewportManager } = appContext;
    const clickedViewportInfo = viewportManager.getViewportFromEvent(event);
    if (!clickedViewportInfo) return null;
    const pointer = new THREE.Vector2(
        ((event.clientX - clickedViewportInfo.rect.left) / clickedViewportInfo.rect.width) * 2 - 1,
        -((event.clientY - clickedViewportInfo.rect.top) / clickedViewportInfo.rect.height) * 2 + 1
    );
    const camera = viewportManager.viewports[clickedViewportInfo.key].camera;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new THREE.Vector3()),
        draggedObject.position
    );
    const targetPosition = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, targetPosition);
    return targetPosition;
}