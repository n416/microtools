import * as THREE from 'three';

function getVectorFromDirection(direction) {
  switch (direction) {
    case 'pos-x':
      return new THREE.Vector3(1, 0, 0);
    case 'neg-x':
      return new THREE.Vector3(-1, 0, 0);
    case 'pos-y':
      return new THREE.Vector3(0, 1, 0);
    case 'neg-y':
      return new THREE.Vector3(0, -1, 0);
    case 'pos-z':
      return new THREE.Vector3(0, 0, 1);
    case 'neg-z':
      return new THREE.Vector3(0, 0, -1);
    default:
      return new THREE.Vector3(0, 0, -1);
  }
}

export function autoSaveScene(context) {
  const { mechaGroup, jointGroup } = context;
  const sceneData = { objects: [], joints: [] };

  mechaGroup.children.forEach((mesh) => {
    if (mesh.userData.isNonSelectable) return;

    let geometryType = '';
    let geometryParameters = null;
    let customUserData = {};

    if (mesh.userData.isImportedOBJ) {
      geometryType = 'ImportedOBJ';
      geometryParameters = null;
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
        uuid: mesh.uuid,
        name: mesh.name,
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
        userData: { ...mesh.userData, ...customUserData, isPinned: !!mesh.userData.isPinned },
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

  jointGroup.children.forEach((joint) => {
    const saveData = {
      uuid: joint.uuid,
      type: joint.userData.type,
      position: joint.position.toArray(),
      rotation: joint.rotation.toArray().slice(0, 3),
      scale: joint.scale.toArray(),
      // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
      // ★★★ ここが親子情報を正しく保存する修正箇所です ★★★
      parentObject: joint.userData.parentObject,
      childObjects: joint.userData.childObjects,
      // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    };
    sceneData.joints.push(saveData);
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
  const { mechaGroup, jointGroup, transformControls, log, history } = context;

  while (mechaGroup.children.length > 0) {
    const mesh = mechaGroup.children[0];
    mechaGroup.remove(mesh);
    mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  while (jointGroup.children.length > 0) {
    const joint = jointGroup.children[0];
    jointGroup.remove(joint);
    joint.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  transformControls.detach();

  const loader = new THREE.BufferGeometryLoader();

  if (sceneData.objects) {
    sceneData.objects.forEach((data) => {
      let geometry;
      const params = data.geometryParameters;

      switch (data.geometryType) {
        case 'ImportedOBJ':
          log(`要再読込: ${data.userData.fileName || '不明なOBJファイル'}`);
          return;
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
        const materialProps = { side: THREE.DoubleSide };
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
        mesh.uuid = data.uuid;
        mesh.name = data.name; 
        mesh.position.fromArray(data.position);
        mesh.rotation.fromArray(data.rotation);
        mesh.scale.fromArray(data.scale);

        if (data.userData) {
          mesh.userData = { ...mesh.userData, ...data.userData };
          // ★★★ isPinned フラグを読み込む ★★★
          if (data.userData.isPinned) {
            mesh.userData.isPinned = true;
          }
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
  }

  if (sceneData.joints) {
    sceneData.joints.forEach((data) => {
      let geometry;
      const size = 0.1;
      const material = new THREE.MeshStandardMaterial({
        color: 0xffa500,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
        wireframe: true,
      });

      switch (data.type) {
        case 'sphere':
          geometry = new THREE.SphereGeometry(size / 2, 16, 8);
          break;
        case 'cylinder':
          geometry = new THREE.CylinderGeometry(size / 3, size / 3, size * 1.5, 16);
          break;
        case 'slide':
          geometry = new THREE.BoxGeometry(size * 2, size / 2, size / 2);
          break;
        default:
          return;
      }
      const joint = new THREE.Mesh(geometry, material);
      joint.uuid = data.uuid;
      joint.userData.isJoint = true;
      joint.userData.type = data.type;
      // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
      // ★★★ ここが親子情報を正しく読み込む修正箇所です ★★★
      joint.userData.parentObject = data.parentObject;
      joint.userData.childObjects = data.childObjects;
      // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

      joint.position.fromArray(data.position);
      joint.rotation.fromArray(data.rotation);
      if (data.scale) {
        joint.scale.fromArray(data.scale);
      }

      jointGroup.add(joint);
    });
  }

  log('データ読込完了');
  history.undoStack = [];
  history.redoStack = [];
  document.dispatchEvent(new CustomEvent('connections-changed'));
}