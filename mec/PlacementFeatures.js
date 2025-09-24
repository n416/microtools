import * as THREE from 'three';
import { AddObjectCommand } from './CommandCreate.js';

const previewMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.6,
    depthTest: false,
});

// 意図しない表面接触による衝突を防ぐための、ごくわずかな隙間
const EPSILON = 0.0001;

/**
 * 新しいオブジェクトの追加をリクエストするメイン関数
 */
export function requestAddObject(geometry, appContext) {
    const { mechaGroup, history, log, state } = appContext;

    geometry.computeBoundingBox();
    const newObjectSize = geometry.boundingBox.getSize(new THREE.Vector3());

    const initialPosition = new THREE.Vector3(0, newObjectSize.y / 2, 0);
    const newObjectBox = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
    newObjectBox.translate(initialPosition);

    let isOccupied = false;
    let firstCollidedObject = null;
    for (const child of mechaGroup.children) {
        const childBox = new THREE.Box3().setFromObject(child);
        if (newObjectBox.intersectsBox(childBox)) {
            isOccupied = true;
            firstCollidedObject = child;
            break;
        }
    }

    if (!isOccupied) {
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff }));
        mesh.name = appContext.getNewObjectName(geometry.type.replace('Geometry', ''));
        mesh.position.copy(initialPosition);
        history.execute(new AddObjectCommand(mesh, mechaGroup, appContext.selectionManager));
    } else {
        state.modes.isPlacementPreviewMode = true;
        log('配置先が塞がっています。緑のプレビューから配置場所を選択してください。(Escでキャンセル)');

        const directions = [
            new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
        ];

        directions.forEach(dir => {
            findAndPlacePreview(firstCollidedObject, dir, geometry, appContext);
        });
    }
}

/**
 * 指定された方向で空きスペースを見つけてプレビューを配置する再帰的な関数
 */
function findAndPlacePreview(baseObject, direction, geometry, appContext, depth = 0) {
    const { mechaGroup, previewGroup } = appContext;
    if (depth > 20) return;

    const newObjectSize = geometry.boundingBox.getSize(new THREE.Vector3());
    const baseObjectBox = new THREE.Box3().setFromObject(baseObject);

    const previewPosition = new THREE.Vector3();

    if (direction.x !== 0) {
        previewPosition.x = (direction.x > 0 ? baseObjectBox.max.x : baseObjectBox.min.x) + direction.x * (newObjectSize.x / 2 + EPSILON);
        previewPosition.y = baseObject.position.y;
        previewPosition.z = baseObject.position.z;
    } else if (direction.y !== 0) {
        previewPosition.x = baseObject.position.x;
        previewPosition.y = (direction.y > 0 ? baseObjectBox.max.y : baseObjectBox.min.y) + direction.y * (newObjectSize.y / 2 + EPSILON);
        previewPosition.z = baseObject.position.z;
    } else {
        previewPosition.x = baseObject.position.x;
        previewPosition.y = baseObject.position.y;
        previewPosition.z = (direction.z > 0 ? baseObjectBox.max.z : baseObjectBox.min.z) + direction.z * (newObjectSize.z / 2 + EPSILON);
    }

    const previewBox = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
    previewBox.translate(previewPosition);

    for (const child of mechaGroup.children) {
        if (child === baseObject) continue;

        const childBox = new THREE.Box3().setFromObject(child);
        if (previewBox.intersectsBox(childBox)) {
            findAndPlacePreview(child, direction, geometry, appContext, depth + 1);
            return;
        }
    }

    const previewMesh = new THREE.Mesh(geometry, previewMaterial);
    previewMesh.position.copy(previewPosition);
    previewMesh.userData.isPlacementPreview = true;
    previewGroup.add(previewMesh);
}


/**
 * プレビューがクリックされたときにオブジェクトを確定させる関数
 */
export function confirmPlacement(previewObject, appContext) {
    const { history, mechaGroup } = appContext;
    const finalMesh = new THREE.Mesh(previewObject.geometry, new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff }));
    finalMesh.name = appContext.getNewObjectName(previewObject.geometry.type.replace('Geometry', ''));
    finalMesh.position.copy(previewObject.position);
    history.execute(new AddObjectCommand(finalMesh, mechaGroup, appContext.selectionManager));
    cancelPlacementPreview(appContext);
}

/**
 * プレビューモードをキャンセルする関数
 */
export function cancelPlacementPreview(appContext) {
    const { previewGroup, state, log } = appContext;
    if (!state.modes.isPlacementPreviewMode) return;

    const toRemove = [...previewGroup.children];
    toRemove.forEach(child => previewGroup.remove(child));

    state.modes.isPlacementPreviewMode = false;
    log('プレビュー配置をキャンセルしました。');
}