import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- グローバル変数 ---
let scene, camera, renderer, controls;
let fullPointCloud = null;
let lastCalculatedNormals = null;

// --- UI要素 ---
const statusDiv = document.getElementById('status');
const calculateNormalsButton = document.getElementById('calculateNormalsButton');
const kValueSlider = document.getElementById('kValue');
const kValueSpan = document.getElementById('kValueSpan');
const normalLengthSlider = document.getElementById('normalLength');
const normalLengthSpan = document.getElementById('normalLengthSpan');
const poissonReconButton = document.getElementById('poissonReconButton');
const poissonDepthSlider = document.getElementById('poissonDepth');
const poissonDepthSpan = document.getElementById('poissonDepthSpan');
// ★★★ 追加 ★★★
const poissonSamplesSlider = document.getElementById('poissonSamples');
const poissonSamplesSpan = document.getElementById('poissonSamplesSpan');
const poissonScaleSlider = document.getElementById('poissonScale');
const poissonScaleSpan = document.getElementById('poissonScaleSpan');


// --- Web Workerの初期化 ---
let normalWorker = new Worker('./normal-worker.js');
// ★★★ 修正: { type: 'module' } は不要な場合が多いので削除 ★★★
let poissonWorker = new Worker('./poisson-worker.js');


// --- Workerからのメッセージ受信ハンドラ ---

// ★★★ 修正: 新しいpoisson-worker.jsの仕様に合わせる ★★★
poissonWorker.onmessage = (event) => {
    const data = event.data;
    switch (data.type) {
        case 'ready':
            statusDiv.textContent = 'ポアソン法Worker準備完了。';
            poissonReconButton.disabled = false;
            break;
        case 'result':
            statusDiv.textContent = 'メッシュデータをThree.jsジオメトリに変換中...';
            // displayPoissonMeshは { vertices, faces } という形式のオブジェクトを期待
            displayPoissonMesh({ vertices: data.vertices, faces: data.faces });
            statusDiv.textContent = 'ポアソンメッシュ生成完了！';
            poissonReconButton.disabled = false;
            break;
        case 'error': // エラーハンドリングは念の為残す
            statusDiv.textContent = `ポアソン法エラー: ${data.message}`;
            poissonReconButton.disabled = false;
            break;
    }
};


normalWorker.onmessage = function (event) {
    if (event.data.progress) {
        const p = event.data.progress;
        const percentage = ((p.processed / p.total) * 100).toFixed(1);
        statusDiv.textContent = `法線を計算中... ${percentage}% (${p.processed.toLocaleString()} / ${p.total.toLocaleString()})`;
        return;
    }
    if (event.data.error) {
        statusDiv.textContent = `法線計算エラー: ${event.data.error}`;
        calculateNormalsButton.disabled = false;
        return;
    }
    if (event.data.normals) {
        statusDiv.textContent = "法線データを表示します...";
        const { positions, normals } = event.data;

        // 古い法線を削除
        const existingNormals = scene.getObjectByName("normals_visualizer");
        if (existingNormals) scene.remove(existingNormals);

        const normalLength = parseFloat(normalLengthSlider.value);
        const lineVertices = [];
        for (let i = 0; i < positions.length / 3; i++) {
            const i3 = i * 3;
            const p = new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2]);
            const n = new THREE.Vector3(normals[i3], normals[i3 + 1], normals[i3 + 2]);
            lineVertices.push(p.x, p.y, p.z);
            const p2 = p.clone().add(n.multiplyScalar(normalLength));
            lineVertices.push(p2.x, p2.y, p2.z);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(lineVertices, 3));
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const lines = new THREE.LineSegments(geometry, material);
        lines.name = "normals_visualizer";
        lines.position.copy(fullPointCloud.position);
        scene.add(lines);

        statusDiv.textContent = "法線計算完了！";

        lastCalculatedNormals = { positions, normals };
        calculateNormalsButton.disabled = false;
    }
};

// --- メインロジック ---

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
        //const material = new THREE.PointsMaterial({ size: 0.5, vertexColors: true });
        const material = new THREE.PointsMaterial({
            size: 3,          // この基本サイズを調整
            vertexColors: true,
            sizeAttenuation: true // ★★★ これが「遠近法を有効にする」スイッチです ★★★
        });
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

function displayPoissonMesh({ vertices, faces }) {
    const existingMesh = scene.getObjectByName("poisson_mesh");
    if (existingMesh) scene.remove(existingMesh);

    // Workerから来たデータが空でないか確認
    if (!vertices || vertices.length === 0 || !faces || faces.length === 0) {
        console.warn("Poisson Recon returned empty mesh.");
        return;
    }

    const geometry = new THREE.BufferGeometry();
    // ★★★ Workerから来るデータはArrayなので、Float32Array/Uint32Arrayに変換 ★★★
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(faces), 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        color: 0x88aaff, side: THREE.DoubleSide, flatShading: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "poisson_mesh";
    mesh.position.copy(fullPointCloud.position);
    scene.add(mesh);
}


// --- イベントハンドラ ---
function handleCalculateNormals(event) {
    if (!fullPointCloud) return;
    event.preventDefault();
    statusDiv.textContent = `約 ${(fullPointCloud.geometry.attributes.position.count).toLocaleString()} 点の法線計算を依頼...`;
    lastCalculatedNormals = null;
    calculateNormalsButton.disabled = true;

    const k = parseInt(kValueSlider.value, 10);
    const cameraWorldPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraWorldPosition);

    normalWorker.postMessage({
        positions: fullPointCloud.geometry.attributes.position.array,
        cameraPosition: cameraWorldPosition.toArray(),
        k: k
    });
}

// ★★★ 修正: Workerに渡すデータ形式を完全に変更 ★★★
function handlePoissonReconstruct() {
    if (!lastCalculatedNormals) {
        statusDiv.textContent = '先にステップ1の法線計算を実行してください。';
        return;
    }
    statusDiv.textContent = 'ポアソン法用データを作成・転送中...';
    poissonReconButton.disabled = true;

    const { positions, normals } = lastCalculatedNormals;
    const numPoints = positions.length / 3;

    // C++モジュールが期待する「位置, 法線, 位置, 法線...」と並んだ配列を作成
    const interleavedPoints = new Float32Array(numPoints * 6);
    for (let i = 0; i < numPoints; i++) {
        const i3 = i * 3;
        const i6 = i * 6;
        // Position (x, y, z)
        interleavedPoints[i6 + 0] = positions[i3 + 0];
        interleavedPoints[i6 + 1] = positions[i3 + 1];
        interleavedPoints[i6 + 2] = positions[i3 + 2];
        // Normal (x, y, z)
        interleavedPoints[i6 + 3] = normals[i3 + 0];
        interleavedPoints[i6 + 4] = normals[i3 + 1];
        interleavedPoints[i6 + 5] = normals[i3 + 2];
    }

    // UIからパラメータを取得
    const depth = parseInt(poissonDepthSlider.value, 10);
    const samples_per_node = parseFloat(poissonSamplesSlider.value);
    const scale = parseFloat(poissonScaleSlider.value);

    // 新しいWorkerの仕様に合わせたオブジェクトを送信
    poissonWorker.postMessage({
        points: interleavedPoints,
        depth: depth,
        samples_per_node: samples_per_node,
        scale: scale
    });
}


// --- 初期化とアニメーションループ ---
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

    calculateNormalsButton.addEventListener('click', handleCalculateNormals);
    poissonReconButton.addEventListener('click', handlePoissonReconstruct);
    poissonReconButton.disabled = true;

    kValueSlider.addEventListener('input', () => kValueSpan.textContent = kValueSlider.value);
    normalLengthSlider.addEventListener('input', () => normalLengthSpan.textContent = normalLengthSlider.value);
    poissonDepthSlider.addEventListener('input', () => poissonDepthSpan.textContent = poissonDepthSlider.value);
    // ★★★ 追加 ★★★
    poissonSamplesSlider.addEventListener('input', () => poissonSamplesSpan.textContent = poissonSamplesSlider.value);
    poissonScaleSlider.addEventListener('input', () => poissonScaleSpan.textContent = poissonScaleSlider.value);

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