import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- デバッグモードのスイッチ ---
// trueにすると、メッシュが黄色のワイヤーフレームで表示されます。
const DEBUG_MODE = false; 

// --- グローバル変数 ---
let scene, camera, renderer, controls;
let fullPointCloud = null;

// --- UI要素 ---
const reconstructButton = document.getElementById('reconstructButton');
const statusDiv = document.getElementById('status');
const distanceLimitSlider = document.getElementById('distanceLimit');
const distanceValueSpan = document.getElementById('distanceValue');
const maxLengthSlider = document.getElementById('maxLength');
const maxLengthValueSpan = document.getElementById('maxLengthValue');
const minAngleSlider = document.getElementById('minAngle');
const minAngleValueSpan = document.getElementById('minAngleValue');

// --- Web Workerの初期化 ---
let meshWorker = new Worker('./worker.js', { type: 'module' });

// --- メインの関数たち ---

async function loadInitialPointCloud(filePath) {
    statusDiv.textContent = "点群データを読み込み中...";
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`ファイル読込失敗`);
        const arrayBuffer = await response.arrayBuffer();
        const numPoints = arrayBuffer.byteLength / 15;
        const positions = new Float32Array(arrayBuffer, 0, numPoints * 3);
        const colors = new Uint8Array(arrayBuffer, numPoints * 12, numPoints * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
        const material = new THREE.PointsMaterial({ size: 0.5, vertexColors: true });
        fullPointCloud = new THREE.Points(geometry, material);
        geometry.computeBoundingBox();
        const center = geometry.boundingBox.getCenter(new THREE.Vector3());
        fullPointCloud.position.x = -center.x;
        fullPointCloud.position.z = -center.z;
        scene.add(fullPointCloud);
        statusDiv.textContent = "準備完了。";
    } catch (error) {
        statusDiv.textContent = `エラー: ${error.message}`;
    }
}

function handleReconstructVisible(event) {
    event.preventDefault();
    if (!fullPointCloud) return;

    statusDiv.textContent = "見える範囲の点を抽出中...";
    const frustum = new THREE.Frustum();
    const cameraViewProjectionMatrix = new THREE.Matrix4();
    camera.updateMatrixWorld(); 
    cameraViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(cameraViewProjectionMatrix);

    const originalPositions = fullPointCloud.geometry.attributes.position.array;
    const originalColors = fullPointCloud.geometry.attributes.color.array;
    
    const visiblePoints_positions = [];
    const visiblePoints_colors = [];
    const point = new THREE.Vector3();
    const distanceLimit = parseFloat(distanceLimitSlider.value);

    for (let i = 0; i < originalPositions.length / 3; i++) {
        const i3 = i * 3;
        point.set(originalPositions[i3], originalPositions[i3+1], originalPositions[i3+2]);
        point.applyMatrix4(fullPointCloud.matrixWorld);

        if (frustum.containsPoint(point) && camera.position.distanceTo(point) < distanceLimit) {
            visiblePoints_positions.push(originalPositions[i3], originalPositions[i3+1], originalPositions[i3+2]);
            visiblePoints_colors.push(originalColors[i3], originalColors[i3+1], originalColors[i3+2]);
        }
    }
    
    if (visiblePoints_positions.length === 0) {
        statusDiv.textContent = "対象の点が見つかりません。";
        return;
    }
    
    statusDiv.textContent = `${(visiblePoints_positions.length / 3).toLocaleString()} 点のメッシュ化を依頼...`;
    
    const positionsArray = new Float32Array(visiblePoints_positions);
    const colorsArray = new Uint8Array(visiblePoints_colors);
    const maxLength = parseFloat(maxLengthSlider.value);
    const minAngle = parseFloat(minAngleSlider.value);
    
    meshWorker.postMessage({
        positions: positionsArray,
        colors: colorsArray,
        maxLength: maxLength,
        minAngle: minAngle
    });
}

meshWorker.onmessage = function(event) {
    if (event.data.error) {
        statusDiv.textContent = `エラー: ${event.data.error}`;
        return;
    }

    if (event.data.success) {
        const { positions, indices, colors } = event.data;

        if (!indices || indices.length === 0) {
            statusDiv.textContent = "メッシュを生成できませんでした。フィルタ値を調整してください。";
            return;
        }

        statusDiv.textContent = "メッシュデータを表示します...";
        
        const existingMesh = scene.getObjectByName("partial_mesh");
        if(existingMesh) {
            existingMesh.geometry.dispose();
            existingMesh.material.dispose();
            scene.remove(existingMesh);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
        const indexArray = positions.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
        geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
        geometry.computeVertexNormals();

        let material;
        if (DEBUG_MODE) {
            statusDiv.textContent = "処理完了！(デバッグ表示)";
            material = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
        } else {
            statusDiv.textContent = "処理完了！";
            material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, vertexColors: true });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = "partial_mesh";
        mesh.position.copy(fullPointCloud.position);
        mesh.quaternion.copy(fullPointCloud.quaternion);
        mesh.scale.copy(fullPointCloud.scale);
        
        scene.add(mesh);
    }
};

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xaaaaaa);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(0, 50, 150);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    
    loadInitialPointCloud('./points_textured.bin');

    reconstructButton.addEventListener('click', handleReconstructVisible);
    distanceLimitSlider.addEventListener('input', () => {
        distanceValueSpan.textContent = distanceLimitSlider.value;
    });
    maxLengthSlider.addEventListener('input', () => {
        maxLengthValueSpan.textContent = maxLengthSlider.value;
    });
    minAngleSlider.addEventListener('input', () => {
        minAngleValueSpan.textContent = minAngleSlider.value;
    });
    
    animate();
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

init();