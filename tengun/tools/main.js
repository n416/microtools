import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;

function init() {
    scene = new THREE.Scene();
    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    // ★★★ 変更点 1: 背景を明るいグレーに ★★★
    scene.background = new THREE.Color(0xaaaaaa); 
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 50, 100); 
    camera.lookAt(0, 0, 0);

    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    // ★★★ 変更点 2: シーン全体を照らす環境光を追加 ★★★
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // 0.7は光の強さ
    scene.add(ambientLight);
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);

    const axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);

    loadPointCloud('./points_textured.bin');

    window.addEventListener('resize', onWindowResize);
}

async function loadPointCloud(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`ファイル読込失敗: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();

        const numPoints = arrayBuffer.byteLength / 15;
        console.log(`読み込む点の数: ${numPoints.toLocaleString()}`);

        const positions = new Float32Array(arrayBuffer, 0, numPoints * 3);
        const colors = new Uint8Array(arrayBuffer, numPoints * 12, numPoints * 3);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));

        const material = new THREE.PointsMaterial({
            // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
            // ★★★ 変更点 3: 点のサイズを大きくする ★★★
            // この数字を 1.0 や 1.5 などに変えて、見栄えを調整してみてください
            size: 1.0, 
            // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
            vertexColors: true
        });

        const points = new THREE.Points(geometry, material);
        
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        points.position.x = -center.x;
        points.position.z = -center.z;

        scene.add(points);
        console.log("テクスチャ付き点群をシーンに追加しました。");

    } catch (error) {
        console.error("点群データの処理中にエラー:", error);
    }
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
animate();