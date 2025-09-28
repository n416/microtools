import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- グローバル変数 ---
let scene, camera, renderer, controls;
let pointCloud = null;
let lastCalculatedNormals = null;
const SAMPLE_POINTS = 50000; // ★★★ サンプルする点群の数 ★★★

// --- UI要素 ---
const statusDiv = document.getElementById('status');
const viewerDiv = document.getElementById('viewer');
const calculateNormalsButton = document.getElementById('calculateNormalsButton');
const kValueSlider = document.getElementById('kValue');
const kValueSpan = document.getElementById('kValueSpan');
const normalLengthSlider = document.getElementById('normalLength');
const normalLengthSpan = document.getElementById('normalLengthSpan');
const poissonReconButton = document.getElementById('poissonReconButton');
const poissonDepthSlider = document.getElementById('poissonDepth');
const poissonDepthSpan = document.getElementById('poissonDepthSpan');
const poissonSamplesSlider = document.getElementById('poissonSamples');
const poissonSamplesSpan = document.getElementById('poissonSamplesSpan');
const poissonScaleSlider = document.getElementById('poissonScale');
const poissonScaleSpan = document.getElementById('poissonScaleSpan');

// --- Web Worker ---
let normalWorker = new Worker('./normal-worker.js');
let poissonWorker = new Worker('./poisson-worker.js');

// --- Workerハンドラ ---
poissonWorker.onmessage = (event) => {
    const data = event.data;
    if (data.type === 'ready') {
        statusDiv.textContent = '準備完了';
        calculateNormalsButton.disabled = false;
    } else if (data.type === 'result') {
        statusDiv.textContent = 'メッシュを生成中...';
        displayPoissonMesh(data);
        statusDiv.textContent = 'メッシュ生成完了！';
        poissonReconButton.disabled = false;
    }
};

normalWorker.onmessage = function(event) {
    if (event.data.progress) return; // 進捗は無視
    statusDiv.textContent = "法線データを表示中...";
    const { positions, normals } = event.data;
    displayNormals(positions, normals);
    statusDiv.textContent = "法線計算完了！";
    lastCalculatedNormals = { positions, normals };
    calculateNormalsButton.disabled = false;
    poissonReconButton.disabled = false;
};

// --- 3D表示関連 ---
function displayNormals(positions, normals) {
    scene.remove(scene.getObjectByName("normals_visualizer"));
    const normalLength = parseFloat(normalLengthSlider.value);
    const lines = [];
    for (let i = 0; i < positions.length / 3; i++) {
        const p = new THREE.Vector3().fromArray(positions, i * 3);
        const n = new THREE.Vector3().fromArray(normals, i * 3);
        lines.push(p.x, p.y, p.z);
        const p2 = p.clone().add(n.multiplyScalar(normalLength));
        lines.push(p2.x, p2.y, p2.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    const lineSegments = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
    lineSegments.name = "normals_visualizer";
    lineSegments.position.copy(pointCloud.position);
    scene.add(lineSegments);
}

function displayPoissonMesh({ vertices, faces }) {
    scene.remove(scene.getObjectByName("poisson_mesh"));
    if (!vertices || vertices.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(faces), 1));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: 0x88aaff, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "poisson_mesh";
    mesh.position.copy(pointCloud.position);
    scene.add(mesh);
}


// --- イベントハンドラ ---
function handleCalculateNormals() {
    if (!pointCloud) return;
    statusDiv.textContent = `${SAMPLE_POINTS.toLocaleString()}点の法線を計算中...`;
    lastCalculatedNormals = null;
    calculateNormalsButton.disabled = true;
    poissonReconButton.disabled = true;
    scene.remove(scene.getObjectByName("normals_visualizer"));
    scene.remove(scene.getObjectByName("poisson_mesh"));

    const k = parseInt(kValueSlider.value, 10);
    const cameraWorldPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraWorldPosition);
    
    normalWorker.postMessage({
        positions: pointCloud.geometry.attributes.position.array,
        cameraPosition: cameraWorldPosition.toArray(),
        k: k
    });
}

function handlePoissonReconstruct() {
    if (!lastCalculatedNormals) {
        alert('先に「法線を計算」ボタンを押してください。');
        return;
    }
    statusDiv.textContent = 'メッシュ化を実行中...';
    poissonReconButton.disabled = true;

    const { positions, normals } = lastCalculatedNormals;
    const interleavedPoints = new Float32Array(positions.length * 2);
    for (let i = 0; i < positions.length / 3; i++) {
        interleavedPoints.set(positions.slice(i * 3, i * 3 + 3), i * 6);
        interleavedPoints.set(normals.slice(i * 3, i * 3 + 3), i * 6 + 3);
    }
    
    poissonWorker.postMessage({
        points: interleavedPoints,
        depth: parseInt(poissonDepthSlider.value, 10),
        samples_per_node: parseFloat(poissonSamplesSlider.value),
        scale: parseFloat(poissonScaleSlider.value)
    });
}


// --- 初期化 ---
async function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    camera = new THREE.PerspectiveCamera(75, viewerDiv.clientWidth / viewerDiv.clientHeight, 0.1, 5000);
    camera.position.set(0, 10, 30);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 1, 1);
    scene.add(dirLight);
    
    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(viewerDiv.clientWidth, viewerDiv.clientHeight);
    viewerDiv.appendChild(renderer.domElement);
    
    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    
    // Event listeners
    calculateNormalsButton.addEventListener('click', handleCalculateNormals);
    poissonReconButton.addEventListener('click', handlePoissonReconstruct);
    kValueSlider.addEventListener('input', () => kValueSpan.textContent = kValueSlider.value);
    normalLengthSlider.addEventListener('input', () => normalLengthSpan.textContent = normalLengthSlider.value);
    poissonDepthSlider.addEventListener('input', () => poissonDepthSpan.textContent = poissonDepthSlider.value);
    poissonSamplesSlider.addEventListener('input', () => poissonSamplesSpan.textContent = poissonSamplesSlider.value);
    poissonScaleSlider.addEventListener('input', () => poissonScaleSpan.textContent = poissonScaleSlider.value);
    window.addEventListener('resize', () => {
        camera.aspect = viewerDiv.clientWidth / viewerDiv.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(viewerDiv.clientWidth, viewerDiv.clientHeight);
    });

    // Load data
    statusDiv.textContent = "サンプル点群を読み込み中...";
    try {
        const response = await fetch('./points_textured.bin');
        const arrayBuffer = await response.arrayBuffer();
        
        // ★★★ 最初のN点だけを切り出して使用 ★★★
        const positions = new Float32Array(arrayBuffer, 0, SAMPLE_POINTS * 3);
        const colors = new Uint8Array(arrayBuffer, arrayBuffer.byteLength - ( (arrayBuffer.byteLength / 15) * 3), SAMPLE_POINTS * 3);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
        pointCloud = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.1, vertexColors: true }));
        
        geometry.computeBoundingBox();
        const center = geometry.boundingBox.getCenter(new THREE.Vector3());
        pointCloud.position.sub(center); // 中心を原点に移動
        scene.add(pointCloud);

    } catch (error) {
        statusDiv.textContent = `エラー: ${error.message}`;
        console.error(error);
    }
    
    // Start loop
    animate();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

init();