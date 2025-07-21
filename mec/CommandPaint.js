import { command } from './Command.js';
import * as THREE from 'three';

// ★ 追加：方向文字列からVector3を生成するヘルパー関数
function getVectorFromDirection(direction) {
    switch(direction) {
        case 'pos-x': return new THREE.Vector3(1, 0, 0);
        case 'neg-x': return new THREE.Vector3(-1, 0, 0);
        case 'pos-y': return new THREE.Vector3(0, 1, 0);
        case 'neg-y': return new THREE.Vector3(0, -1, 0);
        case 'pos-z': return new THREE.Vector3(0, 0, 1);
        case 'neg-z': return new THREE.Vector3(0, 0, -1);
        default: return new THREE.Vector3(0, 0, -1);
    }
}

/**
 * オブジェクトの塗装（色、材質、発光）を変更するコマンド
 */
export class PaintObjectCommand extends command {
  constructor(object, paintProperties) {
    super();
    this.object = object;
    this.newProps = { ...paintProperties };

    this.oldProps = {
      color: object.material.color.clone(),
      metalness: object.material.metalness,
      emissive: object.material.emissive.clone(),
      emissiveIntensity: object.material.emissiveIntensity,
    };
    
    const existingLight = object.getObjectByProperty('isSpotLight', true);
    if(existingLight) {
        this.oldProps.light = {
            color: existingLight.color.clone(),
            intensity: existingLight.intensity,
            penumbra: existingLight.penumbra,
            direction: existingLight.userData.direction || 'neg-z'
        };
    }

    this.message = 'オブジェクトを塗装';
  }

  execute() {
    this.object.material.color.copy(this.newProps.color);
    this.object.material.metalness = this.newProps.metalness;
    
    if (this.newProps.isEmissive) {
      this.object.material.emissive.copy(this.newProps.emissiveProperties.color);
      this.object.material.emissiveIntensity = 1.0;

      let spotLight = this.object.getObjectByProperty('isSpotLight', true);
      if (!spotLight) {
        spotLight = new THREE.SpotLight(this.newProps.emissiveProperties.color);
        spotLight.name = 'EmissiveLight';
        spotLight.target = new THREE.Object3D();
        spotLight.target.name = 'EmissiveLightTarget';
        this.object.add(spotLight, spotLight.target);
      }
      spotLight.color.copy(this.newProps.emissiveProperties.color);
      spotLight.intensity = this.newProps.emissiveProperties.intensity;
      spotLight.penumbra = this.newProps.emissiveProperties.penumbra;
      // ★ 修正: 方向プロパティに基づいてターゲット位置を設定
      spotLight.userData.direction = this.newProps.lightDirection;
      spotLight.target.position.copy(getVectorFromDirection(this.newProps.lightDirection));

    } else {
      this.object.material.emissive.set(0x000000);
      const spotLight = this.object.getObjectByProperty('isSpotLight', true);
      if (spotLight) {
        this.object.remove(spotLight.target);
        this.object.remove(spotLight);
      }
    }
  }

  undo() {
    this.object.material.color.copy(this.oldProps.color);
    this.object.material.metalness = this.oldProps.metalness;
    this.object.material.emissive.copy(this.oldProps.emissive);
    this.object.material.emissiveIntensity = this.oldProps.emissiveIntensity;

    const currentLight = this.object.getObjectByProperty('isSpotLight', true);
    if (currentLight) {
        this.object.remove(currentLight.target);
        this.object.remove(currentLight);
    }
    
    if(this.oldProps.light) {
        const spotLight = new THREE.SpotLight(this.oldProps.light.color);
        spotLight.name = 'EmissiveLight';
        spotLight.intensity = this.oldProps.light.intensity;
        spotLight.penumbra = this.oldProps.light.penumbra;
        spotLight.target = new THREE.Object3D();
        spotLight.target.name = 'EmissiveLightTarget';
        // ★ 修正: 古い方向プロパティに基づいてターゲット位置を復元
        spotLight.userData.direction = this.oldProps.light.direction;
        spotLight.target.position.copy(getVectorFromDirection(this.oldProps.light.direction));
        this.object.add(spotLight, spotLight.target);
    }
  }
}