import * as THREE from 'three';
import { command } from './Command.js';

// 炎エフェクトオブジェクトをシーンに追加するコマンド (変更なし)
export class AddFireEffectCommand extends command {
  constructor(effect, mechaGroup, selectionManager) {
    super();
    this.object = effect;
    this.mechaGroup = mechaGroup;
    this.selectionManager = selectionManager;
    this.message = '噴射エフェクトを追加';
  }

  execute() {
    this.mechaGroup.add(this.object);
    this.selectionManager.set([this.object]);
  }

  undo() {
    this.mechaGroup.remove(this.object);
  }
}

// 炎エフェクト本体のクラス (噴射用に変更)
export class FireEffect extends THREE.Group {
  constructor() {
    super();

    const selectionHelper = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    selectionHelper.position.y = 0.5;
    this.add(selectionHelper);

    this.name = 'FireEffect';
    this.userData.isFireEffect = true;
    this.particleCount = 200; // パーティクルを増量

    const particleGeometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = []; // 色情報を格納する配列を追加
    this.particleData = []; // 速度や寿命などをまとめて管理

    const startColor = new THREE.Color(0x88aaff); // 噴射の根元の色（青白い）

    // 噴射の根元となる円盤状の領域にパーティクルを生成
    for (let i = 0; i < this.particleCount; i++) {
        const r = Math.random() * 0.1; // 半径0.1の円内
        const theta = Math.random() * 2 * Math.PI;
        positions.push(
            r * Math.cos(theta), // x
            0,                   // y (最初はすべてy=0から)
            r * Math.sin(theta)  // z
        );

        // 各パーティクルの初期速度と寿命を設定
        const speed = Math.random() * 0.5 + 2.5; // 初速を上げる
        this.particleData.push({
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.3, // 少しだけ横に広がる
                speed, // 主に上方向への強い力
                (Math.random() - 0.5) * 0.3
            ),
            lifetime: Math.random() * 0.8 + 0.2, // 寿命を短くして、速い流れを表現
            age: 0,
        });
        
        // 初期色を設定
        colors.push(startColor.r, startColor.g, startColor.b);
    }
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); // ジオメトリに色属性を設定

    // パーティクルのマテリアル設定
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.15,
        map: this.createCanvasTexture(),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        vertexColors: true, // 頂点ごとの色を有効にする
    });

    this.points = new THREE.Points(particleGeometry, particleMaterial);
    this.add(this.points);
  }

  // 円形のテクスチャを生成 (よりシャープな見た目に変更)
  createCanvasTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,200,100,0.8)');
    gradient.addColorStop(1, 'rgba(255,100,0,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return new THREE.CanvasTexture(canvas);
  }

  // アニメーションループで呼び出される更新処理
  update(deltaTime) {
    const positions = this.points.geometry.attributes.position.array;
    const colors = this.points.geometry.attributes.color.array;
    const startColor = new THREE.Color(0x88aaff); // 根元の色
    const endColor = new THREE.Color(0xff4500);   // 先端の色

    for (let i = 0; i < this.particleCount; i++) {
        const data = this.particleData[i];
        data.age += deltaTime;

        // 寿命が尽きたら初期状態に戻す
        if (data.age > data.lifetime) {
            const r = Math.random() * 0.1;
            const theta = Math.random() * 2 * Math.PI;
            positions[i * 3] = r * Math.cos(theta);
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = r * Math.sin(theta);
            data.age = 0; // 年齢リセット
        }

        // パーティクルを速度に応じて移動 (重力のような効果を追加)
        data.velocity.y -= 1.0 * deltaTime; // 少しずつ上昇力が弱まる
        positions[i * 3] += data.velocity.x * deltaTime;
        positions[i * 3 + 1] += data.velocity.y * deltaTime;
        positions[i * 3 + 2] += data.velocity.z * deltaTime;

        // 寿命に応じて色と透明度を変化させる
        const lifeRatio = data.age / data.lifetime;
        
        // 色を補間
        const currentColor = new THREE.Color().lerpColors(startColor, endColor, lifeRatio);
        colors[i * 3] = currentColor.r;
        colors[i * 3 + 1] = currentColor.g;
        colors[i * 3 + 2] = currentColor.b;
    }

    // ジオメトリの更新を通知
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true; // 色属性の更新も通知
  }
}