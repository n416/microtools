import * as THREE from 'three';

export function autoSaveScene(context) {
  const { mechaGroup } = context;
  const sceneData = { objects: [] };
  mechaGroup.children.forEach((mesh) => {
    let geometryType = '', geometryData = null, sides = null;

    if (mesh.geometry instanceof THREE.BoxGeometry) {
      geometryType = 'Box';
    } else if (mesh.geometry instanceof THREE.SphereGeometry) {
      geometryType = 'Sphere';
    } else if (mesh.geometry instanceof THREE.ConeGeometry) {
      geometryType = 'Cone';
    } else if (mesh.geometry instanceof THREE.CylinderGeometry) {
      if (mesh.geometry.parameters.radialSegments >= 32) {
        geometryType = 'Cylinder';
      } else {
        geometryType = 'Prism';
        sides = mesh.geometry.parameters.radialSegments;
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
        color: mesh.material.color.getHex(),
      };
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
  const { mechaGroup, transformControls, log, history } = context;
  while (mechaGroup.children.length > 0) {
    const mesh = mechaGroup.children[0];
    mechaGroup.remove(mesh);
    mesh.geometry.dispose();
    if (mesh.material.dispose) mesh.material.dispose();
  }
  transformControls.detach();

  const loader = new THREE.BufferGeometryLoader();
  sceneData.objects.forEach((data) => {
    let geometry;
    switch (data.geometryType) {
      case 'Box': geometry = new THREE.BoxGeometry(1, 1, 1); break;
      case 'Sphere': geometry = new THREE.SphereGeometry(0.7, 32, 16); break;
      case 'Cone': geometry = new THREE.ConeGeometry(0.7, 1.5, 32); break;
      case 'Cylinder': geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32); break;
      case 'Prism': geometry = new THREE.CylinderGeometry(0.7, 0.7, 1.5, data.sides || 6); break;
      case 'Custom': if (data.geometryData) geometry = loader.parse(data.geometryData); break;
      default: return;
    }

    if (geometry) {
      const material = new THREE.MeshStandardMaterial({ color: data.color, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.fromArray(data.position);
      mesh.rotation.fromArray(data.rotation);
      mesh.scale.fromArray(data.scale);
      mechaGroup.add(mesh);
    }
  });
  log('データ読込完了');
  history.undoStack = [];
  history.redoStack = [];
}