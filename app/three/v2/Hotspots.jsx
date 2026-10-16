"use client";

import { Vector3 } from "three/webgpu";
import collectionStore from "../../stores/collectionStore";
import useCameraStore from "../../stores/cameraStore";
import { Book } from "./Book";
import { openCollection, setPointerCursor } from "./interactions";

// Invisible click targets in STUDIO-LOCAL coordinates (render inside <StudioRoot>).
function HitBox({ size, position, onClick, hover = true, onOver, onOut }) {
  return (
    <mesh
      position={position}
      onPointerOver={() => {
        if (hover) setPointerCursor(true);
        onOver?.();
      }}
      onPointerOut={() => {
        if (hover) setPointerCursor(false);
        onOut?.();
      }}
      onClick={onClick}
    >
      <boxGeometry args={size} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

export default function Hotspots({ isMobile }) {
  const bookVisible = collectionStore((s) => s.bookVisible);
  const setBookVisible = collectionStore((s) => s.setBookVisible);
  const setSelectedCollection = collectionStore((s) => s.setSelectedCollection);

  return (
    <>
      {/* Totebag */}
      <HitBox
        size={[0.3, 0.2, 0.3]}
        position={[3.4, 0.9, -0.55]}
        onOver={() => setSelectedCollection("totebag")}
        onOut={() => setSelectedCollection(null)}
        onClick={() => openCollection("totebag")}
      />

      {/* Coffee cup -> looping cinematic reel with credits (until clicked away) */}
      <HitBox
        size={[0.1, 0.1, 0.1]}
        position={[2.9, 0.75, 0.5]}
        onClick={(e) => {
          e.stopPropagation();
          setPointerCursor(false);
          useCameraStore.getState().setCinematic(true);
        }}
      />

      {/* Lookbook (desktop only) */}
      {!isMobile && (
        <>
          <HitBox
            size={[0.3, 0.3, 0.5]}
            position={[3, 0.75, 0]}
            hover={!bookVisible}
            onClick={() => {
              if (bookVisible) return;
              const camera = useCameraStore.getState();
              camera.setCameraPosition(new Vector3(0, -0.5, 1.9));
              camera.setCameraTarget(new Vector3(0, -5, 0));
              setBookVisible(true);
            }}
          />
          <group
            visible={bookVisible}
            scale={0.2}
            position={[3, 0.85, 0]}
            rotation-x={-Math.PI / 2}
            rotation-y={Math.PI * 0.2}
            rotation-z={Math.PI / 2}
          >
            <Book />
          </group>
        </>
      )}
    </>
  );
}
