import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Box3, Raycaster, Vector3 } from "three/webgpu";
import useCameraStore from "../../../stores/cameraStore";

/*
 * Autofocus for the depth of field.
 *
 * Every time the camera rig gets a new destination (cameraStore) we pick what
 * the shot is about and keep that world point as the focus point:
 *  - destination outside the studio (intro, overview): the studio's centre;
 *  - inside (rack close-ups, cinematic): ONE ray from the destination along
 *    its look direction against the studio + clothes;
 *  - a preset with an explicit `focus` (cameraStore, e.g. the Moos chat shot)
 *    uses that point.
 * Each frame the focus distance is the focus point's depth along the *current*
 * view direction, eased, so focus pulls smoothly during the camera tween and
 * the mouse parallax never refocuses.
 */

const MIN_FOCUS = 0.6;
const MAX_FOCUS = 40;

const raycaster = new Raycaster();
const _dir = new Vector3();
const _fwd = new Vector3();

const isFocusable = (o) =>
  o.isMesh &&
  o.visible &&
  !o.userData?.isCloud &&
  o.material &&
  o.material.visible !== false;

const _box = new Box3();

function findFocusPoint(scene, studio, from, to, out) {
  // Outside the studio (intro, overview): focus on the studio itself.
  studio.updateWorldMatrix(true, false);
  _box.setFromObject(studio);
  if (!_box.containsPoint(from)) return _box.getCenter(out);
  _dir.subVectors(to, from);
  const lookDistance = _dir.length();
  if (lookDistance < 1e-4) return null;
  _dir.divideScalar(lookDistance);
  raycaster.set(from, _dir);
  raycaster.far = MAX_FOCUS;
  const targets = [];
  scene.traverseVisible((o) => isFocusable(o) && targets.push(o));
  const hit = raycaster.intersectObjects(targets, false)[0];
  const d = hit ? hit.distance : Math.min(lookDistance, MAX_FOCUS);
  return out.copy(from).addScaledVector(_dir, d);
}

/**
 * @param {{ value: number }} focusUniform  written every frame (world units)
 * @returns ref with { point: Vector3, distance: number }
 */
export default function useAutoFocus(focusUniform, { smoothing = 3.5 } = {}) {
  const scene = useThree((s) => s.scene);
  const state = useRef({
    point: new Vector3(0, -0.5, 0),
    distance: 5,
    pending: true,
    first: true,
  });

  useEffect(() => {
    const update = () => (state.current.pending = true);
    update();
    return useCameraStore.subscribe((s, prev) => {
      if (
        s.targetCameraPosition !== prev.targetCameraPosition ||
        s.targetCameraTarget !== prev.targetCameraTarget
      )
        update();
    });
  }, []);

  useFrame(({ camera }, delta) => {
    const s = state.current;
    if (s.pending) {
      const { targetCameraPosition: from, targetCameraTarget: to, targetFocus } =
        useCameraStore.getState();
      // Wait until the studio is loaded (otherwise the ray only finds the sky).
      const studio = scene.getObjectByName("studio");
      if (targetFocus) {
        // The shot names its subject (e.g. Moos: his skinned mesh is not raycastable).
        s.point.copy(targetFocus);
        s.pending = false;
      } else if (studio && findFocusPoint(scene, studio, from, to, s.point)) s.pending = false;
    }
    camera.getWorldDirection(_fwd);
    const target = Math.min(
      MAX_FOCUS,
      Math.max(MIN_FOCUS, _fwd.dot(_dir.subVectors(s.point, camera.position)))
    );
    if (s.first && !s.pending) {
      s.first = false;
      s.distance = target; // no focus pull on the very first frame
    }
    s.distance += (target - s.distance) * (1 - Math.exp(-delta * smoothing));
    focusUniform.value = s.distance;
  });

  return state;
}
