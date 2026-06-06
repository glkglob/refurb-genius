"use client";

import { Suspense, useEffect, useRef, useCallback, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Grid, Line } from "@react-three/drei";
import * as THREE from "three";
import { getSignedModelUrl } from "@/lib/floorplan";
import { FloorplanModel } from "./FloorplanModel";
import type { Tables } from "@repo/supabase";

type FloorplanModelRow = Tables<"floorplan_models">;
type FloorplanAnnotationRow = Tables<"floorplan_annotations">;
type FloorplanMeasurementRow = Tables<"floorplan_measurements">;

interface FloorplanSceneProps {
  model: FloorplanModelRow;
  annotations: FloorplanAnnotationRow[];
  measurements: FloorplanMeasurementRow[];
  mode: "view" | "tag" | "measure";
  onAddTagPoint: (position: { x: number; y: number; z: number }) => void;
  onMeasurePoint: (position: { x: number; y: number; z: number }) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  estimateRooms?: Array<{ id: string; name: string }>;
}

function SceneInternals({
  model,
  annotations,
  measurements,
  mode,
  onAddTagPoint,
  onMeasurePoint,
  onCanvasReady,
}: Omit<FloorplanSceneProps, "model"> & { model: FloorplanModelRow }) {
  const { camera, gl, scene } = useThree();
  const modelGroupRef = useRef<THREE.Group>(null);
  const [loadableUrl, setLoadableUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Notify parent of canvas for screenshots
  useEffect(() => {
    if (onCanvasReady) {
      onCanvasReady(gl.domElement);
    }
  }, [gl.domElement, onCanvasReady]);

  // Load signed URL for private storage (critical for private bucket)
  useEffect(() => {
    let cancelled = false;
    if (!model?.model_url) {
      setLoadError("Model has no file path");
      return;
    }
    getSignedModelUrl(model.model_url)
      .then((url) => {
        if (!cancelled) {
          setLoadableUrl(url);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.message || "Failed to load model");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [model?.model_url]);

  // Click / pointer handling for tagging and measuring
  const handlePointerDown = useCallback(
    (event: import("@react-three/fiber").ThreeEvent<MouseEvent>) => {
      // Only react in interactive modes. event.stopPropagation() to avoid orbit conflict on drag.
      if (mode === "view") return;

      // We use the event from fiber which gives us the intersection when attached to the model group
      // For simplicity and reliability we also support canvas-level clicks via raycast here.
      event.stopPropagation?.();

      // If the click came through the model (preferred), use the point
      let point: THREE.Vector3 | null = null;

      if (event.point) {
        point = event.point.clone();
      } else {
        // Fallback raycast from mouse if no direct intersection
        const rect = gl.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        const targets: THREE.Object3D[] = [];
        scene.traverse((obj: unknown) => {
          const o = obj as { isMesh?: boolean; isGroup?: boolean };
          if (o.isMesh || o.isGroup) targets.push(obj as THREE.Object3D);
        });
        const intersects = raycaster.intersectObjects(targets, true);
        if (intersects.length > 0) {
          point = intersects[0].point.clone();
        }
      }

      if (!point) return;

      const serialized = { x: point.x, y: point.y, z: point.z };

      if (mode === "tag") {
        onAddTagPoint(serialized);
      } else if (mode === "measure") {
        onMeasurePoint(serialized);
      }
    },
    [mode, onAddTagPoint, onMeasurePoint, camera, gl, scene],
  );

  // Visual annotations (spheres + HTML labels)
  const AnnotationMarkers = () => (
    <>
      {annotations.map((ann) => {
        const data = (ann.data as Record<string, unknown>) || {};
        const posArr = (data.position as number[]) || [0, 0, 0];
        const pos = new THREE.Vector3(posArr[0] || 0, posArr[1] || 0, posArr[2] || 0);
        const label = (data.label as string) || "Tag";
        return (
          <group key={ann.id} position={pos}>
            {/* Visual marker */}
            <mesh>
              <sphereGeometry args={[0.08]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
            {/* Label */}
            <Html distanceFactor={8} style={{ pointerEvents: "none" }} position={[0, 0.25, 0]}>
              <div className="rounded bg-background/90 px-2 py-0.5 text-[10px] font-medium shadow text-foreground border border-border whitespace-nowrap">
                {label}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );

  // Measurement lines (only live in-progress points are shown in 3D for now,
  // because the measurements table stores scalar value+unit, not geometry.
  // Persisted measurements are visible in the sidebar list.)
  const MeasurementLines = () => null;

  if (loadError) {
    return (
      <Html center>
        <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {loadError}
        </div>
      </Html>
    );
  }

  if (!loadableUrl) {
    return (
      <Html center>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="animate-pulse">Loading 3D model…</span>
        </div>
      </Html>
    );
  }

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-10, -5, -10]} intensity={0.3} />

      {/* Reference grid (common for floor plans) */}
      <Grid
        position={[0, -0.01, 0]}
        args={[20, 20]}
        cellSize={1}
        cellColor="#334155"
        sectionColor="#475569"
        fadeDistance={30}
      />

      {/* The actual interactive model */}
      <group ref={modelGroupRef} onPointerDown={handlePointerDown}>
        <Suspense
          fallback={
            <Html center>
              <div className="text-xs text-muted-foreground">Parsing model…</div>
            </Html>
          }
        >
          <FloorplanModel url={loadableUrl} />
        </Suspense>
      </group>

      {/* Annotations & Measurements overlays */}
      <AnnotationMarkers />
      <MeasurementLines />

      {/* Controls - always available */}
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        minDistance={0.5}
        maxDistance={50}
        enablePan
        enableZoom
        enableRotate
      />

      {/* Small helper text in 3D when in interactive mode */}
      {mode !== "view" && (
        <Html position={[0, 3.5, 0]} style={{ pointerEvents: "none" }}>
          <div className="rounded bg-primary/90 px-3 py-1 text-xs font-medium text-primary-foreground shadow">
            {mode === "tag" ? "Click surface to tag room" : "Click two points to measure"}
          </div>
        </Html>
      )}
    </>
  );
}

export function FloorplanScene(props: FloorplanSceneProps) {
  return (
    <Canvas
      camera={{ position: [4, 4, 6], fov: 50, near: 0.1, far: 1000 }}
      style={{ background: "transparent", width: "100%", height: "100%", minHeight: "520px" }}
      gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
    >
      <SceneInternals {...props} />
    </Canvas>
  );
}
