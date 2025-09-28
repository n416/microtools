// normal-worker.js - 伝播フリップ方式

importScripts('./kdTree.js');

// PCA法で法線の「軸」を計算する関数（向きは問わない）
function getMinorEigenvector(C) {
    const c00 = C[0], c01 = C[1], c02 = C[2], c11 = C[3], c12 = C[4], c22 = C[5];
    const m = c00 + c11 + c22;
    const c_xx = c11 * c22 - c12 * c12;
    const c_yy = c00 * c22 - c02 * c02;
    const c_zz = c00 * c11 - c01 * c01;
    const det = c00 * c_xx + c01 * (c01 * c12 - c02 * c11) + c02 * (c02 * c11 - c01 * c12);
    const half_m = 0.5 * m;
    const p = half_m * half_m - (c_xx + c_yy + c_zz);
    const q = (c_xx * c00 + c_yy * c11 + c_zz * c22) - half_m * (c_xx + c_yy + c_zz) - det;
    const r = Math.sqrt(Math.max(0, p));
    const phi = Math.atan2(q, r) / 3;
    const lambda = half_m + 2 * r * Math.cos(phi);
    const ex = c01 * (c22 - lambda) - c02 * c12;
    const ey = c02 * (c11 - lambda) - c01 * c12;
    const ez = c01 * c01 - (c00 - lambda) * (c11 - lambda);
    const norm = Math.sqrt(ex*ex + ey*ey + ez*ez);
    return norm > 1e-6 ? [ex/norm, ey/norm, ez/norm] : [1, 0, 0];
}

self.onmessage = function(event) {
    const { positions, cameraPosition, k } = event.data;
    const cam_x = cameraPosition[0], cam_y = cameraPosition[1], cam_z = cameraPosition[2];
    const numPoints = positions.length / 3;
    const normals = new Float32Array(numPoints * 3);
    const points = [];
    for(let i=0; i<numPoints; i++) {
        const i3 = i * 3;
        points.push({ x: positions[i3], y: positions[i3+1], z: positions[i3+2], idx: i });
    }

    const distance = (a, b) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
    const tree = new kdTree(points, distance, ['x', 'y', 'z']);

    // --- ステップA: まず全点の法線の「軸」を計算（向きはバラバラ） ---
    for(let i=0; i<numPoints; i++) {
        const neighbors = tree.nearest(points[i], k);
        let mean_x = 0, mean_y = 0, mean_z = 0;
        for (const [neighbor, dist] of neighbors) { mean_x += neighbor.x; mean_y += neighbor.y; mean_z += neighbor.z; }
        mean_x /= neighbors.length; mean_y /= neighbors.length; mean_z /= neighbors.length;

        let c00=0, c01=0, c02=0, c11=0, c12=0, c22=0;
        for (const [neighbor, dist] of neighbors) {
            const dx = neighbor.x - mean_x, dy = neighbor.y - mean_y, dz = neighbor.z - mean_z;
            c00 += dx * dx; c01 += dx * dy; c02 += dx * dz;
            c11 += dy * dy; c12 += dy * dz; c22 += dz * dz;
        }
        const normal = getMinorEigenvector([c00, c01, c02, c11, c12, c22]);
        const i3 = i * 3;
        normals[i3] = normal[0]; normals[i3+1] = normal[1]; normals[i3+2] = normal[2];
    }
    
    // --- ステップB: 法線の向きを伝播させて揃える ---
    const visited = new Array(numPoints).fill(false);
    const queue = [0]; // 最初の点からスタート
    visited[0] = true;

    while(queue.length > 0) {
        const currentIdx = queue.shift();
        const currentPoint = points[currentIdx];
        const i3 = currentIdx * 3;
        const nx1 = normals[i3], ny1 = normals[i3+1], nz1 = normals[i3+2];

        // 近傍点を調べて、未訪問ならキューに追加
        const neighbors = tree.nearest(currentPoint, k);
        for(const [neighbor, dist] of neighbors) {
            const neighborIdx = neighbor.idx;
            if(!visited[neighborIdx]) {
                visited[neighborIdx] = true;
                const j3 = neighborIdx * 3;
                const nx2 = normals[j3], ny2 = normals[j3+1], nz2 = normals[j3+2];

                // もし隣の法線と逆を向いていたら（ドット積が負なら）、ひっくり返す
                const dot = nx1 * nx2 + ny1 * ny2 + nz1 * nz2;
                if(dot < 0) {
                    normals[j3] = -nx2;
                    normals[j3+1] = -ny2;
                    normals[j3+2] = -nz2;
                }
                queue.push(neighborIdx);
            }
        }
    }

    // --- ステップC: 全体の向きをカメラ基準で最終調整 ---
    // （１点だけチェックすれば全体が揃う）
    const p = points[0];
    const i3 = 0;
    const view_x = cam_x - p.x, view_y = cam_y - p.y, view_z = cam_z - p.z;
    const dot = normals[i3] * view_x + normals[i3+1] * view_y + normals[i3+2] * view_z;
    if(dot > 0) { // もし最終的な向きがカメラ側を向いていたら、全体を反転
        for(let i=0; i<normals.length; i++) normals[i] *= -1;
    }

    self.postMessage({ positions: positions, normals: normals });
};