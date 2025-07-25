import * as THREE from 'three';

export class OBJLoader {
  parse(text) {
    const vertices = [];
    const faces = [];

    // テキストを行ごとに分割
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      const lineFirstChar = line.charAt(0);

      // コメント行はスキップ
      if (lineFirstChar === '#') continue;
      
      const parts = line.split(/\s+/);
      
      switch (parts[0]) {
        case 'v':
          // 頂点座標 (v x y z)
          vertices.push(
            new THREE.Vector3(
              parseFloat(parts[1]),
              parseFloat(parts[2]),
              parseFloat(parts[3])
            )
          );
          break;
        case 'f':
          // 面情報 (f v1 v2 v3 ...)
          const face = [];
          for (let j = 1; j < parts.length; j++) {
            // "v/vt/vn" のような形式に対応するため、'/'で分割して最初の要素(頂点インデックス)のみ取得
            const vertexIndex = parseInt(parts[j].split('/')[0], 10);
            // OBJは1ベースインデックスなので、-1して0ベースに変換
            face.push(vertexIndex - 1);
          }
          faces.push(face);
          break;
      }
    }

    // Three.jsのジオメトリを生成
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const indices = [];

    // 面情報からポリゴンを三角形に分割してインデックスを生成
    for (const face of faces) {
      if (face.length >= 3) {
        // 最初の頂点を基準に、残りの頂点とで三角形を形成 (Fan Triangulation)
        const v0 = face[0];
        for (let j = 1; j < face.length - 1; j++) {
          const v1 = face[j];
          const v2 = face[j + 1];
          indices.push(v0, v1, v2);
        }
      }
    }

    // 頂点配列をFloat32Arrayに変換
    for (const vertex of vertices) {
      positions.push(vertex.x, vertex.y, vertex.z);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals(); // 法線を自動計算

    return geometry;
  }
}