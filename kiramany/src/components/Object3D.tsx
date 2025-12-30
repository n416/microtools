import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import { useStore } from '../store';
import { supershape } from '../lib/math';
import type { Params3D } from '../lib/math';

export const Object3D = ({ 
  params, 
  isPreview = false, 
  isSelected = false,
  onSelect 
}: { 
  params: Params3D; 
  isPreview?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const update3DTransform = useStore((s) => s.update3DTransform);
  const transformMode = useStore((s) => s.transformMode);

  const toonGradientMap = useMemo(() => {
    const colors = new Uint8Array([
      100, 100, 100, 255, 
      255, 255, 255, 255, 
    ]);
    const texture = new THREE.DataTexture(colors, 2, 1, THREE.RGBAFormat);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }, []);

  const geometry = useMemo(() => {
    const seg = params.meshResolution ?? 64;
    const geo = new THREE.SphereGeometry(1, seg, seg);
    const pos = geo.attributes.position;
    
    for (let i = 0; i <= seg; i++) {
      const lat = (i / seg) * Math.PI - Math.PI / 2;
      const r2 = supershape(lat, params.m2, params.n1, params.n2, params.n3);
      for (let j = 0; j <= seg; j++) {
        const lon = (j / seg) * Math.PI * 2 - Math.PI;
        const r1 = supershape(lon, params.m1, params.n1, params.n2, params.n3);
        const idx = i * (seg + 1) + j;
        pos.setXYZ(idx, r1 * Math.cos(lon) * r2 * Math.cos(lat), r1 * Math.sin(lon) * r2 * Math.cos(lat), r2 * Math.sin(lat));
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, [params.m1, params.m2, params.n1, params.n2, params.n3, params.meshResolution]);

  const material = useMemo(() => {
    const color = new THREE.Color(params.color);
    if (isSelected) color.offsetHSL(0, 0, 0.1); 

    const flatShading = (params.meshResolution ?? 64) < 20;

    switch (params.matType) {
        case 'wire':
            return new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.5 });
        case 'metal':
            return new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.2, flatShading });
        case 'clay':
            return new THREE.MeshStandardMaterial({ color, metalness: 0.0, roughness: 0.8, flatShading });
        case 'toon': 
            // ★修正: { ... } as any とすることで、型定義にないプロパティ(flatShading)のエラーを回避
            return new THREE.MeshToonMaterial({ 
                color, 
                gradientMap: toonGradientMap,
                flatShading: flatShading 
            } as any);
        case 'normal':
            return new THREE.MeshNormalMaterial({ flatShading });
        case 'glass':
        default:
            return new THREE.MeshPhysicalMaterial({ 
                color, 
                metalness: 0.1, 
                roughness: 0, 
                transmission: params.transmission ?? 0.9,
                transparent: true, 
                thickness: 1.5, 
                clearcoat: 1.0,
                flatShading 
            });
    }
  }, [params.color, params.matType, params.transmission, params.meshResolution, isSelected, toonGradientMap]);

  const occlusionMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({ 
        colorWrite: false, 
        depthWrite: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1, 
        polygonOffsetUnits: 1
    });
  }, []);

  const handleTransformEnd = (e: any) => {
    const o = e.target.object;
    if (o) {
      update3DTransform(
        params.id,
        [o.position.x, o.position.y, o.position.z],
        [o.rotation.x, o.rotation.y, o.rotation.z],
        o.scale.x
      );
    }
  };

  if (!params.visible) return null;

  return (
    <>
      {params.matType === 'wire' && params.wireOcclusion && (
        <mesh 
            geometry={geometry} 
            material={occlusionMaterial}
            position={params.position}
            rotation={params.rotation}
            scale={[params.scale, params.scale, params.scale]}
            raycast={() => null}
            renderOrder={-1} 
        />
      )}

      <mesh 
        ref={meshRef} 
        geometry={geometry} 
        material={material} 
        position={params.position}
        rotation={params.rotation}
        scale={[params.scale, params.scale, params.scale]}
        renderOrder={0}
        onClick={(e) => {
          if (!isPreview && onSelect) {
              e.stopPropagation();
              onSelect();
          }
        }}
      />
      {!isPreview && isSelected && (
        <TransformControls 
            object={meshRef} 
            mode={transformMode}
            onMouseUp={handleTransformEnd}
            space="world"
        />
      )}
    </>
  );
};
