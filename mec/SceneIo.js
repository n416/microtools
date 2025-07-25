import * as THREE from 'three';
export function autoSaveScene(context) {
  const {mechaGroup} = context;
  const sceneData = {objects: []};
  mechaGroup.children.forEach((mesh) => {
    // isNonSelectableなオブジェクトは引き続き保存しない
    if (mesh.userData.isNonSelectable) return;

    let geometryType = '';
    let geometryParameters = null;
    let customUserData = {}; // ★ userDataを保存するための変数を追加

    // ★★★ 修正箇所: インポートされたOBJかどうかを最初に判定 ★★★
    if (mesh.userData.isImportedOBJ) {
      geometryType = 'ImportedOBJ';
      // 巨大なジオメトリは保存しない
      geometryParameters = null;
      // ファイル名などの必要なuserDataを保存対象に含める
      customUserData.fileName = mesh.userData.fileName;
      customUserData.isImportedOBJ = true;
    } else if (mesh.geometry instanceof THREE.BoxGeometry) {
      geometryType = 'Box';
      geometryParameters = mesh.geometry.parameters;
    } else if (mesh.geometry instanceof THREE.SphereGeometry) {
      geometryType = 'Sphere';
      geometryParameters = mesh.geometry.parameters;
    } else if (mesh.geometry instanceof THREE.ConeGeometry) {
      geometryType = 'Cone';
      geometryParameters = mesh.geometry.parameters;
    } else if (mesh.geometry instanceof THREE.CylinderGeometry) {
      if (mesh.userData.isPrism) {
        geometryType = 'Prism';
      } else {
        geometryType = 'Cylinder';
      }
      geometryParameters = mesh.geometry.parameters;
    } else if (mesh.geometry instanceof THREE.BufferGeometry && !mesh.geometry.parameters) {
      geometryType = 'Custom';
      geometryParameters = mesh.geometry.toJSON();
    }

    if (geometryType) {
      const saveData = {
        geometryType,
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
        // ★ isPrismやインポートされたファイル名などのuserDataを保存
        userData: {...mesh.userData, ...customUserData},
      };

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

  try {
    const jsonString = JSON.stringify(sceneData);
    if (jsonString.length > 4.8 * 1024 * 1024) {
      console.warn('自動保存データが大きすぎるため、保存をスキップしました。');
      context.log('自動保存データが大きすぎるため、保存をスキップしました。');
      return;
    }
    localStorage.setItem('mechaCreatorAutoSave', jsonString);
  } catch (e) {
    console.error('シーンの自動保存に失敗しました。', e);
    context.log('シーンの自動保存に失敗しました。');
  }
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
    const params = data.geometryParameters;

    switch (data.geometryType) {
      // ★★★ 修正箇所: ImportedOBJのケースを追加 ★★★
      case 'ImportedOBJ':
        // ジオメトリは復元できないので、ユーザーに再インポートを促す
        log(`要再読込: ${data.userData.fileName || '不明なOBJファイル'}`);
        return; // このオブジェクトの読み込みはここで終了
      case 'Box':
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
        const sides = params?.radialSegments ?? data.sides ?? 6;
        geometry = new THREE.CylinderGeometry(params?.radiusTop ?? 0.7, params?.radiusBottom ?? 0.7, params?.height ?? 1.5, sides);
        break;
      case 'Custom':
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

      // ★★★ 修正箇所: 保存されたuserDataを復元 ★★★
      if (data.userData) {
        mesh.userData = {...mesh.userData, ...data.userData};
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
