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
  const {mechaGroup} = context;
  const sceneData = {objects: []};
  mechaGroup.children.forEach((mesh) => {
    if (mesh.userData.isNonSelectable) return;

    let geometryType = '',
      geometryData = null,
      sides = null;

    if (mesh.geometry instanceof THREE.BoxGeometry) {
      geometryType = 'Box';
    } else if (mesh.geometry instanceof THREE.SphereGeometry) {
      geometryType = 'Sphere';
    } else if (mesh.geometry instanceof THREE.ConeGeometry) {
      geometryType = 'Cone';
    } else if (mesh.geometry instanceof THREE.CylinderGeometry) {
      if (mesh.userData.isPrism) {
        geometryType = 'Prism';
        sides = mesh.geometry.parameters.radialSegments;
      } else {
        geometryType = 'Cylinder';
      }
    } else if (mesh.geometry instanceof THREE.BufferGeometry) {
      geometryType = 'Custom';
      geometryData = mesh.geometry.toJSON();
    }

    if (geometryType) {
      const saveData = {
        geometryType,
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
          direction: spotLight.userData.direction || 'neg-z', // ★ 追加
        };
      }
      if (geometryData) {
        saveData.geometryData = geometryData;
      }
      if (sides) {
        saveData.sides = sides;
      }
      sceneData.objects.push(saveData);
    }
  });
  localStorage.setItem('mechaCreatorAutoSave', JSON.stringify(sceneData));
}

export function loadFromData(context, sceneData) {
  const {mechaGroup, transformControls, log, history} = context;
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
    switch (data.geometryType) {
      case 'Box':
        geometry = new THREE.BoxGeometry(1, 1, 1);
        break;
      case 'Sphere':
        geometry = new THREE.SphereGeometry(0.7, 32, 16);
        break;
      case 'Cone':
        geometry = new THREE.ConeGeometry(0.7, 1.5, 32);
        break;
      case 'Cylinder':
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32);
        break;
      case 'Prism':
        geometry = new THREE.CylinderGeometry(0.7, 0.7, 1.5, data.sides || 6);
        break;
      case 'Custom':
        if (data.geometryData) geometry = loader.parse(data.geometryData);
        break;
      default:
        return;
    }

    if (geometry) {
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
        // ★ 修正
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
