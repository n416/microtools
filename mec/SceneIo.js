import * as THREE from 'three';

// (このファイル内の getVectorFromDirection 関数は変更なし)

export function autoSaveScene(context) {
  const {mechaGroup} = context;
  const sceneData = {objects: []};
  mechaGroup.children.forEach((mesh) => {
    if (mesh.userData.isNonSelectable) return;

    let geometryType = '';
    // ★★★ 修正箇所：ジオメトリのパラメータを保存する変数を追加 ★★★
    let geometryParameters = null;

    // instanceof を使ってジオメトリの型を判定し、パラメータを取得する
    if (mesh.geometry instanceof THREE.BoxGeometry) {
      geometryType = 'Box';
      geometryParameters = mesh.geometry.parameters;
    } else if (mesh.geometry instanceof THREE.SphereGeometry) {
      geometryType = 'Sphere';
      geometryParameters = mesh.geometry.parameters;
    } else if (mesh.geometry instanceof THREE.ConeGeometry) {
      geometryType = 'Cone';
      geometryParameters = mesh.geometry.parameters;
    } else if (mesh.geometry instanceof THREE.CylinderGeometry) {
      // isPrismプロパティで角柱と円柱を区別
      if (mesh.userData.isPrism) {
        geometryType = 'Prism';
      } else {
        geometryType = 'Cylinder';
      }
      geometryParameters = mesh.geometry.parameters;
    } else if (mesh.geometry instanceof THREE.BufferGeometry && !mesh.geometry.parameters) {
      // CSGなどで作られたカスタムジオメトリ
      geometryType = 'Custom';
      geometryParameters = mesh.geometry.toJSON(); // パラメータがない場合はジオメトリ全体をJSON化
    }

    if (geometryType) {
      const saveData = {
        geometryType,
        // ★★★ 修正箇所：取得したパラメータを保存データに追加 ★★★
        geometryParameters,
        position: mesh.position.toArray(),
        rotation: mesh.rotation.toArray().slice(0, 3),
        scale: mesh.scale.toArray(),
        material: {
          color: mesh.material.color.getHex(),
          metalness: mesh.material.metalness,
          emissive: mesh.material.emissive.getHex(),
          emissiveIntensity: mesh.material.emissiveIntensity,
        },
      };
      if (mesh.userData.isPrism) {
        saveData.isPrism = true;
      }
      const spotLight = mesh.getObjectByProperty('isSpotLight', true);
      if (spotLight) {
        saveData.spotLight = {
          color: spotLight.color.getHex(),
          intensity: spotLight.intensity,
          penumbra: spotLight.penumbra,
          direction: spotLight.userData.direction || 'neg-z',
        };
      }
      sceneData.objects.push(saveData);
    }
  });
  localStorage.setItem('mechaCreatorAutoSave', JSON.stringify(sceneData));
}

export function loadFromData(context, sceneData) {
  const {mechaGroup, transformControls, log, history} = context;
  // (既存のオブジェクト削除処理は変更なし)
  while (mechaGroup.children.length > 0) {
    const mesh = mechaGroup.children[0];
    mechaGroup.remove(mesh);
    mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  transformControls.detach();

  const loader = new THREE.BufferGeometryLoader();
  sceneData.objects.forEach((data) => {
    let geometry;
    const params = data.geometryParameters; // 保存されたパラメータを取得

    // ★★★ ここの switch 文を全面的に修正 ★★★
    switch (data.geometryType) {
      case 'Box':
        // 保存されたパラメータを使い、なければデフォルト値(1)で復元
        geometry = new THREE.BoxGeometry(params?.width ?? 1, params?.height ?? 1, params?.depth ?? 1);
        break;
      case 'Sphere':
        geometry = new THREE.SphereGeometry(params?.radius ?? 0.7, params?.widthSegments ?? 32, params?.heightSegments ?? 16);
        break;
      case 'Cone':
        geometry = new THREE.ConeGeometry(params?.radius ?? 0.7, params?.height ?? 1.5, params?.radialSegments ?? 32);
        break;
      case 'Cylinder':
        geometry = new THREE.CylinderGeometry(params?.radiusTop ?? 0.5, params?.radiusBottom ?? 0.5, params?.height ?? 1.5, params?.radialSegments ?? 32);
        break;
      case 'Prism':
        // isPrismフラグがなくても、古いデータとの互換性のためにsidesも見る
        const sides = params?.radialSegments ?? data.sides ?? 6;
        geometry = new THREE.CylinderGeometry(params?.radiusTop ?? 0.7, params?.radiusBottom ?? 0.7, params?.height ?? 1.5, sides);
        break;
      case 'Custom':
        // 以前の geometryData との互換性も維持
        const customGeomData = params ?? data.geometryData;
        if (customGeomData) geometry = loader.parse(customGeomData);
        break;
      default:
        return;
    }

    if (geometry) {
      // (以降のマテリアル設定やオブジェクト配置のコードは変更なし)
      const materialProps = {side: THREE.DoubleSide};
      if (data.material) {
        materialProps.color = data.material.color;
        materialProps.metalness = data.material.metalness;
        materialProps.emissive = data.material.emissive;
        materialProps.emissiveIntensity = data.material.emissiveIntensity;
      } else {
        materialProps.color = data.color;
        materialProps.metalness = 1.0;
        materialProps.emissive = 0x000000;
      }
      const material = new THREE.MeshStandardMaterial(materialProps);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.fromArray(data.position);
      mesh.rotation.fromArray(data.rotation);
      mesh.scale.fromArray(data.scale);

      if (data.isPrism) {
        mesh.userData.isPrism = true;
      }

      if (data.spotLight) {
        const spotLight = new THREE.SpotLight(data.spotLight.color);
        spotLight.intensity = data.spotLight.intensity;
        spotLight.penumbra = data.spotLight.penumbra;
        spotLight.name = 'EmissiveLight';
        spotLight.target = new THREE.Object3D();
        spotLight.target.name = 'EmissiveLightTarget';
        const direction = data.spotLight.direction || 'neg-z';
        spotLight.userData.direction = direction;
        spotLight.target.position.copy(getVectorFromDirection(direction));
        mesh.add(spotLight, spotLight.target);
      }

      mechaGroup.add(mesh);
    }
  });
  log('データ読込完了');
  history.undoStack = [];
  history.redoStack = [];
}