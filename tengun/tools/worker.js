import Delaunator from 'https://cdn.skypack.dev/delaunator';

self.onmessage = function(event) {
    try {
        // ★★★ 最小角度(minAngle)も受け取る ★★★
        const { positions, colors, maxLength, minAngle } = event.data;
        const maxLengthSq = maxLength * maxLength;
        // 角度をラジアンに変換
        const minAngleRad = minAngle * Math.PI / 180;
        const minCos = Math.cos(minAngleRad); // 比較用のcos値

        if (!positions || positions.length < 9) throw new Error('点が少なすぎます');

        const points2D = [];
        for (let i = 0; i < positions.length; i += 3) {
            points2D.push([positions[i], positions[i + 2]]);
        }

        let delaunay = Delaunator.from(points2D);
        const triangles = delaunay.triangles;
        
        const filteredIndices = [];
        console.log(`[Worker] ${triangles.length / 3} 個の三角形をフィルタリングします...`);

        for (let i = 0; i < triangles.length; i += 3) {
            const i0 = triangles[i], i1 = triangles[i + 1], i2 = triangles[i + 2];
            
            const p0_x = positions[i0*3], p0_y = positions[i0*3+1], p0_z = positions[i0*3+2];
            const p1_x = positions[i1*3], p1_y = positions[i1*3+1], p1_z = positions[i1*3+2];
            const p2_x = positions[i2*3], p2_y = positions[i2*3+1], p2_z = positions[i2*3+2];
            
            // --- 辺の長さフィルター ---
            const d01_sq = (p1_x-p0_x)**2 + (p1_y-p0_y)**2 + (p1_z-p0_z)**2;
            const d12_sq = (p2_x-p1_x)**2 + (p2_y-p1_y)**2 + (p2_z-p1_z)**2;
            const d20_sq = (p0_x-p2_x)**2 + (p0_y-p2_y)**2 + (p0_z-p2_z)**2;
            if (d01_sq > maxLengthSq || d12_sq > maxLengthSq || d20_sq > maxLengthSq) continue;

            // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
            // ★★★ ここからが角度フィルター ★★★
            const d01 = Math.sqrt(d01_sq), d12 = Math.sqrt(d12_sq), d20 = Math.sqrt(d20_sq);
            
            // 余弦定理を使って、各角度のcosを計算 (角度が鋭いほどcosは1に近くなる)
            const cos0 = (d20_sq + d01_sq - d12_sq) / (2 * d20 * d01);
            const cos1 = (d01_sq + d12_sq - d20_sq) / (2 * d01 * d12);
            const cos2 = (d12_sq + d20_sq - d01_sq) / (2 * d12 * d20);
            
            // 全ての角度が、設定された最小角度より大きいかチェック
            if (cos0 < minCos && cos1 < minCos && cos2 < minCos) {
                filteredIndices.push(i0, i1, i2);
            }
            // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
        }
        
        console.log(`[Worker] フィルタリング後の三角形の数: ${filteredIndices.length / 3}`);
        if (filteredIndices.length === 0) throw new Error('有効な三角形がありませんでした。');

        self.postMessage({
            success: true,
            positions: positions,
            indices: filteredIndices,
            colors: colors
        });
    } catch (error) {
        self.postMessage({ error: error.message });
    }
};