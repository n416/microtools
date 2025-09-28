// poisson.js をインポート
importScripts('poisson.js');

let poissonModule;
let processMesh;

// Wasmモジュールの初期化が完了したときのコールバック
Module.onRuntimeInitialized = () => {
    poissonModule = Module;
    console.log('PoissonRecon Wasm module initialized.');

    // C++のprocess関数をcwrapでJavaScriptから呼び出せるようにする
    // 戻り値はポインタ('number')、引数の型も指定
    processMesh = poissonModule.cwrap(
        'process', 
        'number', 
        ['number', 'number', 'number', 'number', 'number', 'number', 'number']
    );

    // メインスレッドに初期化完了を通知
    postMessage({ type: 'ready' });
};

// メインスreadからのメッセージを受け取る
self.onmessage = (e) => {
    if (!poissonModule) {
        console.error("Wasm module is not initialized yet.");
        return;
    }

    const { points, depth, samples_per_node, scale } = e.data;
    const num_points = points.length / 6;

    console.log(`Received ${num_points} points. Starting Poisson Reconstruction...`);
    console.log(`Params: depth=${depth}, samples_per_node=${samples_per_node}, scale=${scale}`);

    // --- 1. Wasmのメモリ空間に点群データをコピー ---
    // 必要なメモリ量を計算 (floatは4バイト)
    const pointsBytes = points.length * Float32Array.BYTES_PER_ELEMENT;
    // メモリを確保し、ポインタを取得
    const pointsPtr = poissonModule._malloc(pointsBytes);
    // 확보したメモリにJavaScriptの配列(points)の内容を書き込む
    poissonModule.HEAPF32.set(points, pointsPtr / Float32Array.BYTES_PER_ELEMENT);

    // --- 2. C++の処理結果を受け取るための変数のポインタを準備 ---
    const numVerticesPtr = poissonModule._malloc(4); // int型(4バイト)のメモリを確保
    const numFacesPtr = poissonModule._malloc(4);    // int型(4バイト)のメモリを確保

    // --- 3. Wasm関数(process)の実行 ---
    const resultPtr = processMesh(
        pointsPtr,
        num_points,
        depth,
        samples_per_node,
        scale,
        numVerticesPtr,
        numFacesPtr
    );

    // --- 4. 結果の読み取り ---
    // ポインタからC++側で計算された頂点数と面数を取得
    const numVertices = poissonModule.getValue(numVerticesPtr, 'i32');
    const numFaces = poissonModule.getValue(numFacesPtr, 'i32');

    console.log(`Processing finished. Vertices: ${numVertices}, Faces: ${numFaces}`);
    
    let vertices = null;
    let faces = null;

    if (resultPtr !== 0 && numVertices > 0 && numFaces > 0) {
        // 頂点データをWasmのメモリからJavaScriptの配列にコピー
        const verticesOffset = resultPtr / Float32Array.BYTES_PER_ELEMENT;
        vertices = new Float32Array(poissonModule.HEAPF32.buffer, resultPtr, numVertices * 3);

        // 面データをWasmのメモリからJavaScriptの配列にコピー
        // 頂点データのすぐ後ろに格納されている
        const facesOffset = resultPtr + (numVertices * 3 * 4); // (頂点数 * 3座標 * 4バイト)
        faces = new Int32Array(poissonModule.HEAP32.buffer, facesOffset, numFaces * 3);
    }


    // --- 5. メモリ解放 ---
    poissonModule._free(pointsPtr);
    poissonModule._free(numVerticesPtr);
    poissonModule._free(numFacesPtr);
    if(resultPtr !== 0) poissonModule._free(resultPtr);

    // --- 6. メインスレッドに結果を送信 ---
    // Float32ArrayとInt32Arrayはそのまま送れないので、コピーして通常の配列にする
    postMessage({
        type: 'result',
        vertices: vertices ? Array.from(vertices) : [],
        faces: faces ? Array.from(faces) : []
    });
};