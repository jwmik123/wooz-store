"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  FrontSide,
  Frustum,
  MathUtils,
  Matrix4,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  Quaternion,
  Sphere,
  Vector3,
} from "three/webgpu";
import { float, smoothstep, uv, vec3 } from "three/tsl";
import { useGLTFv2 } from "../loaders";
import { setPointerCursor } from "../interactions";
import useMoosStore, { MOOS_ANIMATIONS } from "../../../stores/moosStore";
import collectionStore from "../../../stores/collectionStore";
import useCameraStore from "../../../stores/cameraStore";
import { applyOffset, buildRig, resolvePose, seqToQuat } from "./rig";
import { POSES, RELAXED } from "./poses";

export const MOOS_URL = "/models/v2/moos.glb";

/*
 * Placement (WORLD space, mounted outside <StudioRoot>): front-left of the
 * studio next to the boxes and plants, turned towards the overview camera at
 * (0, 0, 5). Left on purpose: the desktop chat panel opens bottom-right and
 * would cover him there; the racks/hotspots stay free. Studio floor is at
 * y = -1.87 (measured on studio.glb).
 * Moos is authored in metres (1.78 m); studio units are ~1 m (table top 0.67).
 */
export const MOOS_POSITION = [-1.6, -1.87, 1.15];
export const MOOS_ROTATION_Y = 0.55;
// Portrait phones see a much narrower slice of the studio: step in, still left of the table.
export const MOOS_POSITION_MOBILE = [-0.82, -1.87, 1.85];
export const MOOS_ROTATION_Y_MOBILE = 0.35;
export const MOOS_SCALE = 0.92;

const HEAD_PIVOT = new Vector3(0, 1.55, 0); // model space
const LOOK_YAW_MAX = MathUtils.degToRad(55);
const LOOK_PITCH_UP = MathUtils.degToRad(22);
const LOOK_PITCH_DOWN = MathUtils.degToRad(25);

// scratch
const _v = new Vector3();
const _v2 = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _qLook = new Quaternion();
const _frustum = new Frustum();
const _m = new Matrix4();
const _sphere = new Sphere();
const I = new Quaternion();
const damp = (current, target, lambda, dt) => MathUtils.damp(current, target, lambda, dt);

// Built once per loaded GLTF: the bind pose must be captured before any bone
// moves, and the GLTF is cached across remounts/HMR while its bones keep their
// last pose (so the cache lives on the GLTF object, not in this module).
function prepare(gltf) {
  let rig = gltf.userData.moosRig;
  if (rig) return rig;
  rig = buildRig(gltf.scene);
  const src = rig.skinned.material;
  const material = new MeshStandardNodeMaterial({
    map: src.map,
    roughness: 0.82,
    metalness: 0,
    side: FrontSide,
  });
  material.name = "moos";
  rig.skinned.material = material;
  rig.skinned.castShadow = true;
  rig.skinned.receiveShadow = true;
  rig.skinned.raycast = () => {}; // clicks go through the cheap capsule below
  // Bind-pose bounds don't cover a raised arm: use a generous fixed sphere.
  rig.skinned.boundingSphere = new Sphere(new Vector3(0, 0.95, 0), 1.25);
  rig.skinned.computeBoundingSphere = () => {};
  gltf.userData.moosRig = rig;
  return rig;
}

/**
 * Soft contact shadow / ambient-occlusion blob under his feet. Moos has no
 * lightmap, and the sun's shadow map alone leaves his shoes looking like they
 * float when the sun is high or behind him. Multiplies the floor towards a
 * soft dark ellipse (stronger right under the shoes), no lighting cost.
 */
function makeContactShadowMaterial() {
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  m.name = "moosContactShadow";
  const p = uv().sub(0.5).mul(2);
  const r = p.length();
  const soft = smoothstep(1, 0.15, r).mul(0.32);
  const core = smoothstep(0.55, 0.1, r).mul(0.22);
  m.colorNode = vec3(0.09, 0.11, 0.1);
  m.opacityNode = soft.add(core).min(float(0.5));
  return m;
}

function useMoosModel() {
  const gltf = useGLTFv2(MOOS_URL);
  return useMemo(() => {
    const rig = prepare(gltf);
    const poses = {};
    for (const name of MOOS_ANIMATIONS) poses[name] = resolvePose(rig, POSES[name] || {});
    const relaxed = resolvePose(rig, RELAXED);
    return { scene: gltf.scene, rig, poses, relaxed };
  }, [gltf]);
}

export default function Moos({ isMobile = false }) {
  const position = isMobile ? MOOS_POSITION_MOBILE : MOOS_POSITION;
  const { scene, rig, poses, relaxed } = useMoosModel();
  const group = useRef();
  const blob = useRef();
  const camera = useThree((s) => s.camera);
  const pointer = useThree((s) => s.pointer);
  const contactShadowMaterial = useMemo(makeContactShadowMaterial, []);

  // Animation state lives in refs: the store is read imperatively each frame.
  const state = useRef({
    t: 0,
    weights: Object.fromEntries(MOOS_ANIMATIONS.map((n) => [n, n === "idle" ? 1 : 0])),
    yaw: 0,
    pitch: 0,
    talkEnergy: 0,
    hop: 0,
    localWaveUntil: 0,
    hovered: false,
    greeted: false,
  }).current;

  const targets = useMemo(() => {
    const t = {};
    for (const name of rig.order) t[name] = new Quaternion();
    return t;
  }, [rig]);

  // Say hi once when the intro screen goes away (local cue, does not touch the store).
  useEffect(() => {
    const greet = (s) => {
      if (!s.introScreen && !state.greeted) {
        state.greeted = true;
        state.localWaveUntil = state.t + 3.2;
      }
    };
    greet(collectionStore.getState());
    return collectionStore.subscribe(greet);
  }, [state]);

  useEffect(() => () => setPointerCursor(false), []);

  // #debug: poke Moos from the console, e.g. __moos.store.getState().setAnimation('think')
  useEffect(() => {
    if (!window.location.hash.includes("debug")) return;
    window.__moos = { store: useMoosStore, camera: useCameraStore, state, rig, group };
    return () => delete window.__moos;
  }, [state, rig]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    state.t += dt;
    const t = state.t;
    const g = group.current;
    if (!g) return;

    // ---- visibility: skip all bone work when Moos is off-screen ----------
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_m);
    _sphere.center.set(0, 0.95, 0).applyMatrix4(g.matrixWorld);
    _sphere.radius = 1.25 * MOOS_SCALE;
    if (!_frustum.intersectsSphere(_sphere)) return;

    // ---- state weights (exponential damping => smooth cross-fades) --------
    const store = useMoosStore.getState();
    let active = store.currentAnimation;
    if (active === "idle" && (t < state.localWaveUntil)) active = "wave";
    for (const name of MOOS_ANIMATIONS) {
      state.weights[name] = damp(state.weights[name], name === active ? 1 : 0, 5, dt);
    }
    const w = state.weights;
    state.talkEnergy = damp(state.talkEnergy, store.isTalking ? 1 : 0, 3, dt);
    const talk = Math.max(w.talk, state.talkEnergy * 0.6);

    // ---- key poses: relaxed base, slerp towards every weighted state -------
    for (const name of rig.order) {
      const q = targets[name].copy(relaxed[name] || I);
      for (const anim of MOOS_ANIMATIONS) {
        const p = poses[anim][name];
        if (p && w[anim] > 0.001) q.slerp(p, w[anim]);
      }
    }

    // ---- procedural layers (model-space axes, premultiplied) --------------
    const add = (bone, seq, weight = 1) => {
      if (weight < 0.001 || !targets[bone]) return;
      seqToQuat(seq.map(([a, d]) => [a, d * weight]), _q);
      targets[bone].premultiply(_q);
    };

    // idle: breathing, weight shift, sway (always on, a bit calmer while posing)
    const breath = Math.sin(t * 1.55);
    const shift = Math.sin(t * 0.42);
    const sway = Math.sin(t * 0.23 + 1.3);
    add("spine1", [["x", breath * 1.1]]);
    add("spine2", [["x", breath * 0.9]]);
    add("neck", [["x", -breath * 1.4]]);
    add("shoulder_L", [["z", breath * 0.9]]);
    add("shoulder_R", [["z", -breath * 0.9]]);
    add("hips", [["z", shift * 1.8], ["y", sway * 3]]);
    add("spine", [["z", -shift * 1.4]]);
    add("thigh_L", [["z", -shift * 1.8]]);
    add("thigh_R", [["z", -shift * 1.8]]);

    // wave: forearm swings in the frontal plane, hand follows a beat later
    add("forearm_R", [["z", Math.sin(t * 11) * 24]], w.wave);
    add("hand_R", [["z", Math.sin(t * 11 - 0.6) * 12]], w.wave);

    // talk: nods + small beat gestures
    if (talk > 0.001) {
      add("neck", [["x", (Math.sin(t * 4.3) * 2.5 + Math.sin(t * 7.7) * 1.2)]], talk);
      add("head", [["z", Math.sin(t * 1.3) * 3], ["y", Math.sin(t * 0.9) * 4]], talk);
      add("forearm_L", [["x", Math.sin(t * 2.6) * 12 - 4]], talk);
      add("forearm_R", [["x", Math.sin(t * 2.1 + 1.2) * 12 - 4]], talk);
      add("hand_L", [["z", Math.sin(t * 3.1) * 10]], talk);
      add("hand_R", [["z", Math.sin(t * 2.7 + 0.5) * 10]], talk);
      add("spine2", [["y", Math.sin(t * 0.8) * 3]], talk);
    }

    // think: slow head drift
    add("head", [["z", Math.sin(t * 0.7) * 3]], w.think);

    // happy: bounce (whole body hop + knees)
    const hopPhase = Math.abs(Math.sin(t * Math.PI * 1.7));
    state.hop = hopPhase * 0.035 * w.happy;
    add("spine2", [["x", -hopPhase * 3]], w.happy);

    // ---- look-at: cursor around the camera (or up-left while thinking) ----
    if (w.think > 0.5) {
      _v.set(0.6, 2.4, 1.6); // model space, up-left
    } else {
      _v.copy(camera.position);
      _v2.set(pointer.x * 1.2, pointer.y * 0.8, 0).applyQuaternion(camera.quaternion);
      _v.add(_v2);
      rig.armature.worldToLocal(_v);
    }
    _v.sub(HEAD_PIVOT);
    let yaw = Math.atan2(_v.x, _v.z);
    let pitch = -Math.atan2(_v.y, Math.hypot(_v.x, _v.z));
    if (Math.abs(yaw) > MathUtils.degToRad(110)) {
      yaw = 0; // target behind him: look ahead
      pitch = 0;
    }
    yaw = MathUtils.clamp(yaw, -LOOK_YAW_MAX, LOOK_YAW_MAX);
    pitch = MathUtils.clamp(pitch, -LOOK_PITCH_UP, LOOK_PITCH_DOWN);
    state.yaw = damp(state.yaw, yaw, 4, dt);
    state.pitch = damp(state.pitch, pitch, 4, dt);
    const lookW = 1 - w.wave * 0.4;
    _qLook.setFromAxisAngle(_v2.set(0, 1, 0), state.yaw * 0.55 * lookW);
    _q2.setFromAxisAngle(_v2.set(1, 0, 0), state.pitch * 0.55 * lookW);
    targets.head.premultiply(_q2).premultiply(_qLook);
    _qLook.setFromAxisAngle(_v2.set(0, 1, 0), state.yaw * 0.3 * lookW);
    _q2.setFromAxisAngle(_v2.set(1, 0, 0), state.pitch * 0.3 * lookW);
    targets.neck.premultiply(_q2).premultiply(_qLook);
    _qLook.setFromAxisAngle(_v2.set(0, 1, 0), state.yaw * 0.12 * lookW);
    targets.spine2.premultiply(_qLook);

    // ---- write bones ------------------------------------------------------
    for (const name of rig.order) applyOffset(rig.info[name], targets[name]);
    g.position.y = position[1] + state.hop;
    // Contact shadow stays on the floor while he hops (and fades a little).
    if (blob.current) {
      blob.current.position.y = 0.004 - state.hop / MOOS_SCALE;
      const k = 1 - state.hop * 6;
      blob.current.scale.set(0.78 * k, 0.5 * k, 1);
    }
  });

  return (
    <group
      ref={group}
      name="moos"
      position={position}
      rotation-y={isMobile ? MOOS_ROTATION_Y_MOBILE : MOOS_ROTATION_Y}
      scale={MOOS_SCALE}
    >
      <primitive object={scene} />
      <mesh
        ref={blob}
        name="moosContactShadow"
        rotation-x={-Math.PI / 2}
        position={[0, 0.004, 0.02]}
        scale={[0.78, 0.5, 1]}
        renderOrder={1}
        material={contactShadowMaterial}
        raycast={() => null}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
      {/* cheap click/hover target instead of raycasting the skinned mesh */}
      <mesh
        position={[0, 0.9, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setPointerCursor(true);
          if (!state.hovered && useMoosStore.getState().currentAnimation === "idle") {
            state.localWaveUntil = state.t + 1.6;
          }
          state.hovered = true;
        }}
        onPointerOut={() => {
          state.hovered = false;
          setPointerCursor(false);
        }}
        onClick={(e) => {
          e.stopPropagation();
          useMoosStore.getState().setOpen(true);
        }}
      >
        <cylinderGeometry args={[0.3, 0.3, 1.8, 10]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
