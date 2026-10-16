import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Box3, Color, Object3D, SpotLight, Vector3 } from "three/webgpu";
import { uLampGlow } from "./interior";

/*
 * Track spots that wash each clothing rack in warm light when the lamps come
 * on at dusk. Module-scope lights so the lightmapped studio + garment materials
 * can include them in their lightsNode (see keyLight.js) — they are always in
 * the scene and only change intensity, so nothing recompiles at dusk.
 * Positions are fitted at runtime to the `clothes-*` groups (world bounds).
 */

const RACKS = ["longsleeve", "polo", "splatter", "hoodie"];
const SPOT_COLOR = new Color().setStyle("#ffcf9a", "srgb"); // same warmth as the lamps
const SPOT_INTENSITY = 22;
const CEILING_Y = 1.15; // just under the roof beams (world)

export const rackSpots = RACKS.map((type) => {
  const s = new SpotLight(SPOT_COLOR, 0, 6, 0.5, 0.95, 2);
  s.name = `rackSpot-${type}`;
  s.castShadow = false;
  s.target = new Object3D();
  return s;
});

const _box = new Box3();
const _c = new Vector3();

export default function RackSpots() {
  const fitted = useRef(false);
  const fixtures = useRef([]);

  useFrame(({ scene }) => {
    if (!fitted.current) {
      let ok = true;
      RACKS.forEach((type, i) => {
        const g = scene.getObjectByName(`clothes-${type}`);
        if (!g) return (ok = false);
        _box.setFromObject(g).getCenter(_c);
        const spot = rackSpots[i];
        spot.target.position.copy(_c);
        // Hang the spot in front of the rack (towards the room centre/camera).
        spot.position.set(_c.x * 0.55, CEILING_Y, _c.z + 1.0);
        spot.target.updateMatrixWorld();
        const f = fixtures.current[i];
        if (f) {
          f.position.copy(spot.position);
          f.lookAt(_c);
        }
      });
      fitted.current = ok;
    }
    const on = uLampGlow.value;
    for (const s of rackSpots) s.intensity = on * SPOT_INTENSITY;
    for (const f of fixtures.current) if (f) f.children[1].material.opacity = on;
  });

  return (
    <>
      {rackSpots.map((s, i) => (
        <group key={s.name}>
          <primitive object={s} />
          <primitive object={s.target} />
          {/* Small black track-light can with a glowing lens (faces +Z → lookAt). */}
          <group ref={(el) => (fixtures.current[i] = el)}>
            <mesh rotation-x={Math.PI / 2} raycast={() => null}>
              <cylinderGeometry args={[0.032, 0.04, 0.11, 16]} />
              <meshStandardMaterial color="#1c1c1c" roughness={0.45} metalness={0.6} />
            </mesh>
            <mesh position-z={0.056} raycast={() => null}>
              <circleGeometry args={[0.03, 16]} />
              <meshBasicMaterial color="#ffe7c4" transparent opacity={0} toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}
