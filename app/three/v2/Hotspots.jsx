"use client";

import collectionStore from "../../stores/collectionStore";
import { Book } from "./Book";
import { openCollection, openTablePiece, setPointerCursor } from "./interactions";
import { TABLE_SPOTS } from "./signs/signLayout";
import { finePointer, setSpotHover, useRackHover } from "./signs/signState";

/** Hover glow (studio shell material, signs/spotGlow.js) + cursor chip. */
function spotOver(key) {
  if (!finePointer()) return;
  setSpotHover(TABLE_SPOTS[key]);
  useRackHover.setState({ label: TABLE_SPOTS[key].label });
}
function spotOut() {
  setSpotHover(null);
  useRackHover.setState({ label: null });
}

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
  const setSelectedCollection = collectionStore((s) => s.setSelectedCollection);

  return (
    <>
      {/* Totebag */}
      <HitBox
        size={[0.3, 0.2, 0.3]}
        position={[3.4, 0.9, -0.55]}
        onOver={() => {
          setSelectedCollection("totebag");
          spotOver("totebag");
        }}
        onOut={() => {
          setSelectedCollection(null);
          spotOut();
        }}
        onClick={() => {
          spotOut();
          openCollection("totebag");
        }}
      />

      {/* Coffee cup -> looping cinematic reel with credits (until clicked away) */}
      <HitBox
        size={[0.1, 0.1, 0.1]}
        position={[2.9, 0.75, 0.5]}
        onOver={() => spotOver("coffee")}
        onOut={spotOut}
        onClick={(e) => {
          e.stopPropagation();
          setPointerCursor(false);
          spotOut();
          openTablePiece("coffee");
        }}
      />

      {/* Lookbook (desktop only) */}
      {!isMobile && (
        <>
          <HitBox
            size={[0.3, 0.3, 0.5]}
            position={[3, 0.75, 0]}
            hover={!bookVisible}
            onOver={() => !bookVisible && spotOver("lookbook")}
            onOut={spotOut}
            onClick={() => {
              if (bookVisible) return;
              spotOut();
              openTablePiece("lookbook");
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
