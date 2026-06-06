"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";
import * as THREE from "three";

/**
 * Loads and displays a GLB/GLTF model.
 * Centers and lightly scales the model on first load for better UX.
 * The parent group receives pointer events for tagging/measuring.
 */
export function FloorplanModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, true);

  useEffect(() => {
    // Compute bounding box and center the model
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Center
    scene.position.sub(center);

    // Gentle auto-scale so very large or tiny models are usable out of the box
    // Target roughly 5-8 units across
    if (maxDim > 0.1) {
      const targetSize = 6;
      const scale = targetSize / maxDim;
      // Only scale down large models or up tiny ones modestly
      if (scale < 1 || scale > 5) {
        scene.scale.setScalar(Math.min(Math.max(scale, 0.2), 8));
      }
    }

    // Make sure materials are visible and meshes receive raycasts
    scene.traverse((child: unknown) => {
      const c = child as {
        isMesh?: boolean;
        castShadow?: boolean;
        receiveShadow?: boolean;
        material?: THREE.Material | THREE.Material[];
      };
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
        if (c.material) {
          // Ensure double sided for floor plans that may have backfaces
          if (Array.isArray(c.material)) {
            c.material.forEach((m) => {
              (m as THREE.Material).side = THREE.DoubleSide;
            });
          } else {
            (c.material as THREE.Material).side = THREE.DoubleSide;
          }
        }
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}

// Preload helper is automatically handled by useGLTF from drei when the component mounts.
