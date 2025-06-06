// グローバル変数
let scene, camera, renderer;
let planeMesh; // 紙飛行機
let terrainMesh; // 地面
let mountains = []; // 山の配列

let velocity = 0.05; // 初期速度
const maxVelocity = 0.2;
const minVelocity = 0.01;
const acceleration = 0.001;
const deceleration = 0.002;

let pitchSpeed = 0; // 機首上げ下げの速度
let rollSpeed = 0;  // ロール速度
const pitchRate = 0.0004; // 機首操作の感度
const rollRate = 0.0004;  // ロール操作の感度
const damping = 0.95;   // 操作の減衰率

let bullets = []; // 発射された弾を格納する配列
const bulletSpeedFactor = 2.5; // 弾の速度（プレイヤーの最大速度の何倍か）
let lastShotTime = 0; // 最後に弾を撃った時間（連射制御用）
const fireRate = 500; // 連射間隔 (ミリ秒) - 1秒間に4発

let enemies = []; // 敵を格納する配列

// const keys の定義に F を追加
const keys = {
  W: false, S: false, A: false, D: false,
  SPACE: false, SHIFT: false,
};

// 初期化関数
function init() {
  // シーン
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // 空色

  // カメラ
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  // レンダラー
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // ライト
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // 環境光
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); //指向性ライト
  directionalLight.position.set(50, 50, 50);
  scene.add(directionalLight);

  // 紙飛行機作成
  createPaperPlane();

  // 地形作成
  createTerrain();

  // 山作成
  createMountains();

  createEnemyPlane(); // 敵を1機作成

  // イベントリスナー
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', onWindowResize);

  // アニメーション開始
  animate();
}

// 紙飛行機モデル作成
function createPaperPlane() {
  const planeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,       // 白色
    side: THREE.DoubleSide,
    metalness: 0.1,        // 金属感を抑えて紙に近づける (元の0.5から変更)
    roughness: 0.8         // 紙の粗さを表現 (元の0.9から微調整)
  });

  planeMesh = new THREE.Group(); // グループとして紙飛行機を扱う

  // 翼と上部胴体（既存の矢じり型）
  const dartShape = new THREE.Shape();
  // 紙飛行機の2D形状を定義（ダーツ型など）
  // XY平面上で(0,0)を中央とし、Y軸プラス方向を機首とする
  dartShape.moveTo(0, 1.2);      // 機首の先端
  dartShape.lineTo(-0.8, -1);  // 左翼後端
  dartShape.lineTo(0, -0.6);   // 胴体後部中央（少しへこませる）
  dartShape.lineTo(0.8, -1);   // 右翼後端
  dartShape.lineTo(0, 1.2);      // 機首の先端に戻る

  const dartExtrudeSettings = {
    steps: 2,            // ユーザー設定値を維持
    depth: 0.02,         // 紙のように非常に薄く
    bevelEnabled: false
  };
  const dartGeometry = new THREE.ExtrudeGeometry(dartShape, dartExtrudeSettings);
  const dartMesh = new THREE.Mesh(dartGeometry, planeMaterial);

  // 翼部分の向きを調整
  // 形状の+Y方向（機首）がグループの-Z方向（前方）を向くようにする
  // 押し出しの厚みがグループのY軸（上下）方向になる
  dartMesh.rotation.x = -Math.PI / 2;
  // 翼部分の底面がグループのXZ平面（y=0）に接するように配置
  dartMesh.position.y = dartExtrudeSettings.depth / 2;

  planeMesh.add(dartMesh);

  // 胴体パーツ（翼の下に追加する箱型の部分）
  const fuselageWidth = 0.025;  // 胴体の幅 (X軸方向)
  const fuselageHeight = 0.25; // 胴体の高さ・厚み (Y軸方向)
  const fuselageLength = 1.5; // 胴体の長さ (Z軸方向) (翼の全長より少し短めに)

  const fuselageGeometry = new THREE.BoxGeometry(fuselageWidth, fuselageHeight, fuselageLength);
  const fuselageMesh = new THREE.Mesh(fuselageGeometry, planeMaterial);

  // 胴体パーツの位置調整
  // 翼パーツの真下に配置されるようにする
  // 翼パーツの底面はy=0なので、胴体パーツの中心がその下に来るようにy位置を調整
  fuselageMesh.position.y = -fuselageHeight / 2;
  // 翼の前後方向の中心（おおよそ）に胴体の中心が合うようにZ位置を微調整
  // 翼形状のY軸方向の中心が (1.2 + (-1.0)) / 2 = 0.1 なので、回転後はZ軸方向に -0.1 のオフセット
  fuselageMesh.position.z = -0.1;

  planeMesh.add(fuselageMesh);

  // 紙飛行機全体のスケール、初期位置、回転順序 (ユーザー設定値を維持)
  planeMesh.scale.set(0.6, 0.6, 0.6);
  planeMesh.position.y = 20;
  planeMesh.rotation.order = 'YXZ';

  scene.add(planeMesh);
}

// 地形作成
function createTerrain() {
  // 地面 (飛行場 - 緑色の平地)
  const groundGeometry = new THREE.PlaneGeometry(500, 500, 50, 50);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x32CD32, wireframe: false }); // ライムグリーン
  terrainMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  terrainMesh.rotation.x = -Math.PI / 2; // X軸中心に回転して水平にする
  terrainMesh.position.y = 0;
  scene.add(terrainMesh);

  // 滑走路 (地面の上に灰色の長方形)
  const runwayGeometry = new THREE.PlaneGeometry(20, 120); // 幅20、長さ120
  const runwayMaterial = new THREE.MeshStandardMaterial({ color: 0x606060 }); // ダークグレー
  const runwayMesh = new THREE.Mesh(runwayGeometry, runwayMaterial);
  runwayMesh.rotation.x = -Math.PI / 2;
  runwayMesh.position.y = 0.01; // 地面よりわずかに上にしてZファイティングを防ぐ
  runwayMesh.position.z = 0;    // 飛行場の中央に配置
  scene.add(runwayMesh);
}

// 山作成
function createMountains() {
  // もし以前の山があればシーンから削除 (通常initは一度しか呼ばれませんが念のため)
  mountains.forEach(m => scene.remove(m));
  mountains = [];

  const mountainMaterial = new THREE.MeshStandardMaterial({
    color: 0x6B5432, // より土や岩らしい茶色に変更
    roughness: 0.95,  // 表面の粗さ
    metalness: 0.05,  // 金属感をほぼなくす
    flatShading: true // これをtrueにすると、カクカクしたローポリ風の山になり、雰囲気が出ることがあります
  });

  // 山岳地帯用の大きな平面ジオメトリを作成
  const terrainSize = 350; // 山岳地帯全体のサイズ
  const terrainWidthSegments = 50; // 横方向の分割数 (多いほど滑らか、または詳細になる)
  const terrainHeightSegments = 50; // 縦方向の分割数
  const mountainMaxHeight = 55;    // 山の最大高

  const mountainGeometry = new THREE.PlaneGeometry(
    terrainSize,
    terrainSize,
    terrainWidthSegments,
    terrainHeightSegments
  );

  // PlaneGeometryはXY平面に作られるので、頂点のZ値を高さとして操作します。
  // その後、ジオメトリ全体をX軸で-90度回転させると、操作したZ値がY軸（高さ）になります。
  const positions = mountainGeometry.attributes.position;

  for (let i = 0; i < positions.count; i++) {
    const x_plane = positions.getX(i); // 平面上のX座標
    const y_plane = positions.getY(i); // 平面上のY座標 (これが回転後、ワールドのZ座標になる)

    // 複数のサイン波を組み合わせて起伏を生成
    let height = 0;
    height += Math.sin(x_plane / 25 + y_plane / 20) * mountainMaxHeight * 0.4;
    height += Math.cos(x_plane / 15 - y_plane / 30) * mountainMaxHeight * 0.35;
    height += Math.sin(x_plane / 8 + y_plane / 12) * mountainMaxHeight * 0.25;

    // 少しランダムな要素を追加して単調さを減らす
    height += (Math.random() - 0.5) * 8;

    // 高さがマイナスにならないようにし、最大高も制限
    height = Math.max(0, height);
    // height = Math.min(mountainMaxHeight * 1.1, height); // あまりにも高いピークを抑制したい場合

    positions.setZ(i, height); // Z値を設定（これが回転後にY＝高さになる）
  }

  mountainGeometry.computeVertexNormals(); // 法線を再計算して、光の当たり方を正しくする

  const mountainousTerrain = new THREE.Mesh(mountainGeometry, mountainMaterial);

  // X軸で-90度回転させて、XY平面からXZ平面（地面）に配置
  mountainousTerrain.rotation.x = -Math.PI / 2;

  // 山岳地帯の位置を設定
  // 滑走路(z=0付近)を避けて、少し奥まった位置やランダムな位置に配置
  mountainousTerrain.position.set(
    (Math.random() - 0.5) * 150, // X方向に少しランダムにずらす
    0.05,                        // 地面(y=0)や滑走路(y=0.01)との重なりを避けるため、少しだけ上に
    (Math.random() - 0.5) * 150 - 100 // Z方向に少しランダムかつ奥（-Z方向）へ
  );

  scene.add(mountainousTerrain);
  mountains.push(mountainousTerrain); // 配列に追加（もし後で操作する場合）

  // Tips: より広大な山岳風景にするには、上記のような mountainousTerrain を
  //      異なるパラメータや位置で複数作成してシーンに追加することも可能です。
}

function createEnemyPlane() {
  const enemyMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000, // 赤色
    side: THREE.DoubleSide,
    metalness: 0.1,
    roughness: 0.8
  });

  const enemyPlane = new THREE.Group();

  // 形状はプレイヤー機と同じ (createPaperPlane内の形状定義を再利用または共通化推奨)
  // ここではcreatePaperPlaneの形状定義を簡略化してコピーします
  const dartShape = new THREE.Shape();
  dartShape.moveTo(0, 1.2); dartShape.lineTo(-0.8, -1);
  dartShape.lineTo(0, -0.6); dartShape.lineTo(0.8, -1);
  dartShape.lineTo(0, 1.2);

  const dartExtrudeSettings = { steps: 2, depth: 0.02, bevelEnabled: false };
  const dartGeometry = new THREE.ExtrudeGeometry(dartShape, dartExtrudeSettings);
  const dartMesh = new THREE.Mesh(dartGeometry, enemyMaterial); // 赤いマテリアルを使用
  dartMesh.rotation.x = -Math.PI / 2;
  dartMesh.position.y = dartExtrudeSettings.depth / 2;
  enemyPlane.add(dartMesh);

  const fuselageWidth = 0.25; const fuselageHeight = 0.2; const fuselageLength = 1.9;
  const fuselageGeometry = new THREE.BoxGeometry(fuselageWidth, fuselageHeight, fuselageLength);
  const fuselageMesh = new THREE.Mesh(fuselageGeometry, enemyMaterial); // 赤いマテリアル
  fuselageMesh.position.y = -fuselageHeight / 2;
  fuselageMesh.position.z = -0.1;
  enemyPlane.add(fuselageMesh);

  // スケールや初期位置を設定
  enemyPlane.scale.set(0.6, 0.6, 0.6); // プレイヤーと同じサイズ

  // 初期位置 (プレイヤーから離れた位置に)
  enemyPlane.position.set(
//    (Math.random() - 0.5) * 50, // X: -25 to 25
0,
    20,                         // Y: 高度20
    -100                        // Z: プレイヤーのずっと前方
  );

  // 敵機の向き (最初はプレイヤーの方を向かせるか、特定の方向へ)
  // enemyPlane.lookAt(planeMesh.position); // プレイヤーの方を向く
  enemyPlane.rotation.y = Math.PI; // Z軸負の方向（画面奥から手前）へ進むように

  // 敵機の速度
  enemyPlane.userData.velocity = new THREE.Vector3(0, 0, 0.001); // Z軸正方向へ一定速度で (向いている方向による)
  // rotation.y = PI なので、ローカルの-Zがワールドの+Zになる
  // したがって、ローカルの-Z方向に進ませるには速度を正にするか、
  // ワールド座標で速度ベクトルを設定する。
  // ワールド座標で前進方向の速度ベクトルを設定
  const enemyForward = new THREE.Vector3(0, 0, -1); // ローカルZ軸前方
  enemyForward.applyQuaternion(enemyPlane.quaternion); // ワールド向きに変換
  enemyPlane.userData.velocity = enemyForward.multiplyScalar(0.08); // 速度設定


  enemies.push(enemyPlane);
  scene.add(enemyPlane);
}
// ウィンドウリサイズ処理
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}


// onKeyDown に F キーの処理を追加
function onKeyDown(event) {
  switch (event.code) {
    case 'KeyW': keys.W = true; break;
    case 'KeyS': keys.S = true; break;
    case 'KeyA': keys.A = true; break;
    case 'KeyD': keys.D = true; break;
    case 'Space': keys.SPACE = true; break;
    case 'ShiftLeft': keys.SHIFT = true; break;
    case 'KeyF': keys.F = true; break; // Fキーの押下状態を記録
  }
}

// キーアップイベント
function onKeyUp(event) {
  switch (event.code) {
    case 'KeyW': keys.W = false; break;
    case 'KeyS': keys.S = false; break;
    case 'KeyA': keys.A = false; break;
    case 'KeyD': keys.D = false; break;
    case 'Space': keys.SPACE = false; break;
    case 'ShiftLeft': keys.SHIFT = false; break;
    case 'KeyF': keys.F = false; break;

  }
}
function fireBullet() {
  const now = performance.now();
  if (now - lastShotTime < fireRate) {
    return; // 連射間隔に達していない場合は発射しない
  }
  lastShotTime = now;

  const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffFFFF }); // 赤い弾
  // 弾の形状 (小さな球体や細長い箱など)
  //const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8); // 半径0.1の球
  const bulletGeometry = new THREE.BoxGeometry(1, 0.1, 20); // 細長い箱型

  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

  // 弾の初期位置と向きをプレイヤーに合わせる
  // 飛行機の少し前から発射
  const offset = new THREE.Vector3(0, 0, -12); // 機首方向の少し前
  offset.applyQuaternion(planeMesh.quaternion); // 飛行機の向きに合わせる
  bullet.position.copy(planeMesh.position).add(offset); // 位置をコピーしてオフセットを加える

  bullet.quaternion.copy(planeMesh.quaternion); // 弾の向きを飛行機に合わせる

  // 弾の速度ベクトルを設定
  const bulletVelocity = new THREE.Vector3(0, 0, -(maxVelocity * bulletSpeedFactor)); // プレイヤーの最大速度の3倍
  bulletVelocity.applyQuaternion(planeMesh.quaternion); // 飛行機の向きに変換
  bullet.userData.velocity = bulletVelocity; // userDataに速度ベクトルを保存

  bullets.push(bullet);
  scene.add(bullet);
}

// 紙飛行機の状態更新
function updatePlane() {
  // 加速・減速
  if (keys.SPACE) {
    velocity += acceleration;
    if (velocity > maxVelocity) velocity = maxVelocity;
  }
  if (keys.SHIFT) {
    velocity -= deceleration;
    if (velocity < minVelocity) velocity = minVelocity;
  }
  if (keys.F) {
    fireBullet();
  }

  // 機首上げ下げ・ロールの入力処理
  if (keys.W) pitchSpeed -= pitchRate; // W: 機首上げ (ローカルX軸負回転)
  if (keys.S) pitchSpeed += pitchRate; // S: 機首下げ (ローカルX軸正回転)
  if (keys.A) rollSpeed += rollRate;  // A: 左ロール (ローカルZ軸正回転 -> 左翼下げ)
  if (keys.D) rollSpeed -= rollRate;  // D: 右ロール (ローカルZ軸負回転 -> 右翼下げ)

  // 減衰を適用
  pitchSpeed *= damping;
  rollSpeed *= damping;

  // 紙飛行機の回転を更新 (ローカル軸周り)
  planeMesh.rotateX(pitchSpeed); // 機首上げ下げ
  planeMesh.rotateZ(rollSpeed);  // ロール

  // 紙飛行機を現在の向きに前進させる
  const forwardDirection = new THREE.Vector3(0, 0, -1); // ローカル空間での前方を指すベクトル
  forwardDirection.applyQuaternion(planeMesh.quaternion); // ワールド空間の向きに変換
  planeMesh.position.addScaledVector(forwardDirection, velocity);

  // カメラ追従
  const cameraOffset = new THREE.Vector3(0, 1.8, 4.5); // 紙飛行機からのカメラの相対位置 (後ろ、少し上)
  const cameraPosition = cameraOffset.clone().applyQuaternion(planeMesh.quaternion);
  cameraPosition.add(planeMesh.position);

  camera.position.lerp(cameraPosition, 0.1); // カメラ位置を滑らかに補間
  camera.lookAt(planeMesh.position);         // 常に紙飛行機を見る

  // 簡単な地面衝突判定
  if (planeMesh.position.y < (planeMesh.scale.y * 0.2)) { // 地面(y=0)より少し上で判定
    planeMesh.position.y = (planeMesh.scale.y * 0.2);
    velocity = 0; // 停止
    // TODO: ゲームオーバー処理やリセット機能などをここに追加可能
    // console.log("墜落しました！");
  }


  // 1. Raycasterの準備
  const raycaster = new THREE.Raycaster();
  const planeDirection = new THREE.Vector3();
  planeMesh.getWorldDirection(planeDirection); // 飛行機の進行方向

  const pointsToTest = [
    new THREE.Vector3(0, 0, -0.5), // 機首少し前 (ローカル座標)
    new THREE.Vector3(0, -0.1, 0), // 機体下部 (ローカル座標)
    // 必要に応じて翼端なども追加
  ];

  let collisionDetected = false;

  for (const point of pointsToTest) {
    const localPoint = point.clone();
    const worldPoint = localPoint.applyMatrix4(planeMesh.matrixWorld); // ローカル座標をワールド座標に変換

    let rayDirection;
    if (point.z < 0) { // 前方へのレイ
      rayDirection = planeDirection;
    } else { // 下方へのレイ
      rayDirection = new THREE.Vector3(0, -1, 0);
    }

    raycaster.set(worldPoint, rayDirection);
    raycaster.far = 1.0; // 衝突を検知する距離 (紙飛行機のサイズに合わせて調整)

    const intersects = raycaster.intersectObjects(mountains, true); // mountains 配列に山岳メッシュが入っている想定

    if (intersects.length > 0) {
      // レイが非常に近い距離で何かに衝突した場合
      if (intersects[0].distance < 0.5) { // この距離も調整
        collisionDetected = true;
        break;
      }
    }
  }
}

// アニメーションループ
function animate() {
  requestAnimationFrame(animate);
  updatePlane();


  // --- 弾の更新処理 ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.position.add(bullet.userData.velocity);

    // 弾が一定距離以上進んだらシーンから削除 (適当な距離で)
    // (もっと良いのは、カメラの描画範囲外に出たらなど)
    if (bullet.position.length() > 500) { // 原点からの距離で判定
      scene.remove(bullet);
      bullet.geometry.dispose(); // メモリ解放
      bullet.material.dispose(); // メモリ解放
      bullets.splice(i, 1); // 配列から削除
    }
  }
  // --- ここまで弾の更新処理 ---

  // --- 敵の更新処理 ---
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.position.add(enemy.userData.velocity); // 設定された速度で直進

    // 敵が一定範囲外に出たら削除 (またはループさせるなど)
    if (enemy.position.z > 100 || enemy.position.length() > 500) { // Z軸正方向に大きく外れたか、原点から遠すぎたら
      scene.remove(enemy);
      // メモリ解放 (ジオメトリやマテリアルは共通化していれば不要な場合もある)
      // enemy.traverse(child => { // グループ内の全メッシュに対して
      //    if (child.isMesh) {
      //        child.geometry.dispose();
      //        child.material.dispose();
      //    }
      // });
      enemies.splice(i, 1);
    }
  }
  // --- ここまで敵の更新処理 ---


  // --- 衝突判定 (弾と敵) ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    let bulletHit = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];

      // 簡単な距離ベースの衝突判定
      const distance = bullet.position.distanceTo(enemy.position);
      if (distance < 1.5) { // 衝突距離 (敵と弾のサイズに合わせて調整)
        // 衝突！
        scene.remove(enemy); // 敵を消す
        // TODO: 敵のジオメトリ、マテリアルのdispose処理 (共通化されていなければ)
        enemies.splice(j, 1);

        scene.remove(bullet); // 弾を消す
        bullet.geometry.dispose();
        bullet.material.dispose();
        bullets.splice(i, 1);

        bulletHit = true;
        console.log("敵に命中！");
        break; // この弾は消えたので、これ以上他の敵との判定は不要
      }
    }
    if (bulletHit) continue; // この弾は処理済みなので次の弾へ
  }
  // --- ここまで衝突判定 ---
  renderer.render(scene, camera);
}

// 初期化関数を呼び出してゲーム開始
init();