import * as THREE from 'three';
import { AddJointCommand } from './CommandCreate.js';
import { JointTransformCommand } from './CommandEdit.js';

// --- ジョイント作成 ---

export function requestAddJoint(type, appContext) {
    const { history, jointGroup, selectionManager, log } = appContext;
    const selectedObjects = selectionManager.get();

    if (selectedObjects.length < 2) {
        log('エラー: 親となるオブジェクト1つと、子となるオブジェクトを1つ以上選択してください。');
        return;
    }

    const parentObject = selectedObjects[0];
    const childObjects = selectedObjects.slice(1);

    let geometry;
    const size = 0.1;
    const material = new THREE.MeshStandardMaterial({
        color: 0xffa500,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
        wireframe: true,
    });

    switch (type) {
        case 'sphere':
            geometry = new THREE.SphereGeometry(size / 2, 16, 8);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(size / 3, size / 3, size * 1.5, 16);
            break;
        case 'slide':
            geometry = new THREE.BoxGeometry(size * 2, size / 2, size / 2);
            break;
        default:
            log('不明なジョイントタイプです。');
            return;
    }

    const joint = new THREE.Mesh(geometry, material);
    joint.name = appContext.getNewObjectName(`Joint_${type}`);
    joint.userData.isJoint = true;
    joint.userData.type = type;
    joint.userData.parentObject = parentObject.uuid;
    joint.userData.childObjects = childObjects.map(obj => obj.uuid);

    const parentBox = new THREE.Box3().setFromObject(parentObject);
    const childrenBox = new THREE.Box3();
    childObjects.forEach(obj => childrenBox.expandByObject(obj));
    const parentCenter = parentBox.getCenter(new THREE.Vector3());
    const childrenCenter = childrenBox.getCenter(new THREE.Vector3());
    const newPosition = new THREE.Vector3().lerpVectors(parentCenter, childrenCenter, 0.5);

    joint.position.copy(newPosition);

    history.execute(new AddJointCommand(joint, jointGroup, selectionManager, parentObject, childObjects));
    log(`${type}ジョイントを追加しました。親1個、子${childObjects.length}個を接続。`);
}

// --- ジョイント操作 (FK) ---

let dragStartState = null;

export function startJointDrag(draggedObject, intersectionPoint, event, appContext) {
    const { mechaGroup, jointGroup, viewportManager } = appContext;

    // 1. ドラッグされたオブジェクトに接続されている全てのジョイントをリストアップ
    const connectedJoints = jointGroup.children.filter(j =>
        (j.userData.parentObject === draggedObject.uuid) ||
        (j.userData.childObjects && j.userData.childObjects.includes(draggedObject.uuid))
    );

    if (connectedJoints.length === 0) {
        return null;
    }

    // 2. クリックされた座標から最も遠いジョイントをピボットとして選択
    let farthestJoint = null;
    let maxDistanceSq = -1;
    connectedJoints.forEach(joint => {
        const distanceSq = joint.position.distanceToSquared(intersectionPoint);
        if (distanceSq > maxDistanceSq) {
            maxDistanceSq = distanceSq;
            farthestJoint = joint;
        }
    });

    const activeJoint = farthestJoint;
    if (!activeJoint) {
        return null;
    }

    // 3. ピボット以外の接続を辿って、操作対象となるオブジェクト群を決定する
    const movingGroup = new Set();
    const queue = [draggedObject];
    const visited = new Set([draggedObject.uuid]);
    movingGroup.add(activeJoint); // ピボット自体も動くグループに含める

    while (queue.length > 0) {
        const currentObject = queue.shift();
        movingGroup.add(currentObject);

        // 現オブジェクトに接続された全ジョイントを取得
        const jointsToSearch = jointGroup.children.filter(j =>
            (j.userData.parentObject === currentObject.uuid) ||
            (j.userData.childObjects && j.userData.childObjects.includes(currentObject.uuid))
        );

        for (const joint of jointsToSearch) {
            // ピボットジョイントは通行止め
            if (joint.uuid === activeJoint.uuid) {
                continue;
            }

            if (!visited.has(joint.uuid)) {
                visited.add(joint.uuid);
                queue.push(joint); // ジョイントを探索対象に追加

                // ジョイントから繋がる先のパーツを探索対象に追加
                const parentObject = mechaGroup.getObjectByProperty('uuid', joint.userData.parentObject);
                if (parentObject && !visited.has(parentObject.uuid)) {
                    visited.add(parentObject.uuid);
                    queue.push(parentObject);
                }
                if (joint.userData.childObjects) {
                    joint.userData.childObjects.forEach(childUuid => {
                        const childObject = mechaGroup.getObjectByProperty('uuid', childUuid);
                        if (childObject && !visited.has(childObject.uuid)) {
                            visited.add(childObject.uuid);
                            queue.push(childObject);
                        }
                    });
                }
            }
        }
    }


    // 4. 処理の続行
    const clickedViewportInfo = viewportManager.getViewportFromEvent(event);
    if (!clickedViewportInfo) return null;

    movingGroup.forEach(obj => {
        obj.matrixAutoUpdate = true;
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        obj.matrix.decompose(position, quaternion, scale);
        obj.position.copy(position);
        obj.quaternion.copy(quaternion);
        obj.scale.copy(scale);
    });

    dragStartState = {
        activeJoint: activeJoint,
        movingGroup: Array.from(movingGroup).map(obj => ({
            object: obj,
            startMatrix: obj.matrix.clone(),
        })),
        lastMousePoint: new THREE.Vector2(event.clientX, event.clientY),
    };

    activeJoint.material.color.set(0x00ff00);
    activeJoint.material.wireframe = false;

    return dragStartState;
}


export function applyJointTransform(event, appContext) {
    if (!dragStartState) return;

    const { activeJoint, movingGroup, lastMousePoint } = dragStartState;
    const { viewportManager } = appContext;
    const jointPosition = activeJoint.position;

    const clickedViewportInfo = viewportManager.getViewportFromEvent(event);
    if (!clickedViewportInfo) return;

    const currentMousePoint = new THREE.Vector2(event.clientX, event.clientY);

    const view = viewportManager.viewports[clickedViewportInfo.key];
    const rect = view.element.getBoundingClientRect();

    const jointScreenPos = jointPosition.clone().project(view.camera);
    const jointScreenCenter = new THREE.Vector2(
        (jointScreenPos.x * 0.5 + 0.5) * rect.width + rect.left,
        (-jointScreenPos.y * 0.5 + 0.5) * rect.height + rect.top
    );
    const lastVec = new THREE.Vector2().subVectors(lastMousePoint, jointScreenCenter);
    const currentVec = new THREE.Vector2().subVectors(currentMousePoint, jointScreenCenter);

    if (lastVec.lengthSq() === 0 || currentVec.lengthSq() === 0) {
        dragStartState.lastMousePoint.copy(currentMousePoint);
        return;
    }

    let angle = currentVec.angle() - lastVec.angle();

    if (angle > Math.PI) angle -= 2 * Math.PI;
    if (angle < -Math.PI) angle += 2 * Math.PI;

    let axis = new THREE.Vector3();

    switch (clickedViewportInfo.key) {
        case 'top': axis.set(0, 1, 0); angle *= -1; break;
        case 'front': axis.set(0, 0, 1); angle *= -1; break;
        case 'side': axis.set(1, 0, 0); angle *= -1; break;
        default: axis.set(0, 1, 0); angle *= -1;
    }

    const incrementalRotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);

    movingGroup.forEach(state => {
        const obj = state.object;
        const vec = new THREE.Vector3().subVectors(obj.position, jointPosition);
        vec.applyQuaternion(incrementalRotation);
        obj.position.copy(jointPosition).add(vec);
        obj.quaternion.premultiply(incrementalRotation);
    });

    dragStartState.lastMousePoint.copy(currentMousePoint);
}

export function endJointDrag(appContext) {
    if (!dragStartState) return;
    const { history } = appContext;

    dragStartState.activeJoint.material.color.set(0xffa500);
    dragStartState.activeJoint.material.wireframe = true;

    // ★★★ エラー修正： 'quaternion' を使用するように統一 ★★★
    const finalTransforms = dragStartState.movingGroup.map(state => ({
        object: state.object,
        position: state.object.position.clone(),
        quaternion: state.object.quaternion.clone(),
    }));

    const initialTransforms = dragStartState.movingGroup.map(state => {
        const tempMatrix = state.startMatrix.clone();
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        tempMatrix.decompose(position, quaternion, scale);
        return { object: state.object, position, quaternion };
    });

    history.execute(new JointTransformCommand(initialTransforms, finalTransforms));

    dragStartState = null;
}