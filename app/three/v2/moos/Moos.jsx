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
import { float, mix, smoothstep, texture, uv, vec3 } from "three/tsl";
import { uNightFactor } from "../uniforms";
import { useGLTFv2 } from "../loaders";
import { setPointerCursor } from "../interactions";
import useMoosStore from "../../../stores/moosStore";
import collectionStore from "../../../stores/collectionStore";
import useCameraStore from "../../../stores/cameraStore";
import { CLIPS, LOOK_BONES, buildRig, rotateBoneWorld } from "./rig";
import { MOOS_FLOOR_Y, MOOS_HOME, MOOS_HOME_MOBILE, moosBody } from "./moosBody";
import { STOPS, Walker, buildPath, nearestStop, pickStop, turnTowards } from "./locomotion";

export const MOOS_URL = "/models/v2/moos.glb";

/*
 * Moos: Meshy mesh + UAL-compatible skeleton + baked Quaternius UAL clips
 * (CC0), see docs/MOOS.md. WORLD space (mounted outside <StudioRoot>).
 * Authored in metres (1.78 m); studio units are ~1 m (table top 0.67).
 *
 *   clip weights   one action per clip, weights damped towards the wanted
 *                  clip (≈0.4 s crossfades), walk playback rate = ground speed
 *   look-at        additive head/neck/spine rotation towards the cursor /
 *                  camera, applied after the mixer, clamped
 *   strolling      desktop only: every 20-40 s at the overview (chat closed)
 *                  he walks to another stop (locomotion.js) and looks at a rack
 */
export const MOOS_SCALE = 0.92;

const FADE = 7; // weight damping (1/s): ~95 % in 0.43 s
const HEAD_PIVOT = new Vector3(0, 1.55, 0); // model space
const LOOK_YAW_MAX = MathUtils.degToRad(60);
const LOOK_PITCH_UP = MathUtils.degToRad(22);
const LOOK_PITCH_DOWN = MathUtils.degToRad(25);
const STROLL_MIN = 20;
const STROLL_MAX = 40;

// scratch
const _v = new Vector3();
const _v2 = new Vector3();
const _q = new Quaternion();
const _qy = new Quaternion();
const _qx = new Quaternion();
const _gq = new Quaternion();
const _gqi = new Quaternion();
const _frustum = new Frustum();
const _m = new Matrix4();
const _sphere = new Sphere();
const Y = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);
const damp = MathUtils.damp;
const rand = (a, b) => a + Math.random() * (b - a);

// Built once per loaded GLTF (cached on it: survives remounts/HMR).
function prepare(gltf) {
  let rig = gltf.userData.moosRig;
  if (rig) return rig;
  rig = buildRig(gltf);
  const src = rig.skinned.material;
  const material = new MeshStandardNodeMaterial({
    map: src.map,
    roughness: 0.82,
    metalness: 0,
    side: FrontSide,
  });
  material.name = "moos";
  // Moos has no lightmap: at night the hemisphere fill + rack point lights
  // (which exist only for un-lightmapped objects) lit him clearly brighter
  // than the dim baked interior around him. Pull his albedo down at night so
  // he sits in the same light as the studio; daylight is unchanged.
  if (src.map) material.colorNode = texture(src.map).mul(mix(float(1), float(0.6), uNightFactor));
  rig.skinned.material = material;
  rig.skinned.castShadow = true;
  rig.skinned.receiveShadow = true;
  rig.skinned.raycast = () => {}; // clicks go through the cheap capsule below
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

/** Overview shot, nothing else going on: a good moment for a stroll. */
function canStroll() {
  const { sidebarOpen, introScreen, bookVisible } = collectionStore.getState();
  const { preset, cinematic } = useCameraStore.getState();
  const moos = useMoosStore.getState();
  return (
    !sidebarOpen &&
    !introScreen &&
    !bookVisible &&
    !cinematic &&
    preset === "default" &&
    !moos.open &&
    moos.currentAnimation === "idle"
  );
}

export default function Moos({ isMobile = false }) {
  const gltf = useGLTFv2(MOOS_URL);
  const rig = useMemo(() => prepare(gltf), [gltf]);
  const home = isMobile ? MOOS_HOME_MOBILE : MOOS_HOME;
  const group = useRef();
  const camera = useThree((s) => s.camera);
  const pointer = useThree((s) => s.pointer);
  const contactShadowMaterial = useMemo(makeContactShadowMaterial, []);

  // Everything per-frame lives in refs: stores are read imperatively.
  const state = useRef(null);
  if (!state.current) {
    state.current = {
      t: 0,
      weights: Object.fromEntries(CLIPS.map((n) => [n, n === "idle" ? 1 : 0])),
      yaw: 0,
      pitch: 0,
      lookW: 1,
      localWaveUntil: 0,
      hovered: false,
      greeted: false,
      walker: new Walker(rig.walkSpeed * MOOS_SCALE),
      stop: "home", // current / target stop
      prevStop: null,
      mode: "idle", // idle | walking | arrived | chat
      nextStrollAt: rand(STROLL_MIN, STROLL_MAX),
      lookAt: null, // [x, y, z] world point to study after arriving
      lookUntil: 0,
      faceHeading: home.heading,
      visible: true,
      timeScale: 1,
      lookOff: false,
      // mixer output of the look-at bones (see the look-at block)
      lookBase: Object.fromEntries(
        LOOK_BONES.map(([name]) => [name, rig.bones[name].quaternion.clone()])
      ),
    };
    moosBody.x = home.x;
    moosBody.z = home.z;
    moosBody.heading = home.heading;
    moosBody.speed = 0;
    moosBody.walking = false;
  }
  const st = state.current;

  // Say hi once when the intro screen goes away (local cue, does not touch the store).
  useEffect(() => {
    const greet = (s) => {
      if (!s.introScreen && !st.greeted) {
        st.greeted = true;
        st.localWaveUntil = st.t + 3.2;
        st.nextStrollAt = st.t + rand(STROLL_MIN, STROLL_MAX);
      }
    };
    greet(collectionStore.getState());
    return collectionStore.subscribe(greet);
  }, [st]);

  // Chat opens: stop walking, turn to the (chat) camera; the store plays the wave.
  useEffect(
    () =>
      useMoosStore.subscribe((s, prev) => {
        if (s.open === prev.open) return;
        if (s.open) {
          st.walker.stop();
          st.mode = "chat";
          // keep waving a bit past the store's 2.2 s cue: the camera dolly takes 1.5 s
          st.localWaveUntil = st.t + 3.4;
        } else {
          st.mode = "idle";
          st.nextStrollAt = st.t + rand(STROLL_MIN, STROLL_MAX);
        }
      }),
    [st]
  );

  useEffect(() => () => setPointerCursor(false), []);

  // #debug: poke Moos from the console, e.g. __moos.stroll('back'), __moos.store.getState().setAnimation('think')
  useEffect(() => {
    if (!window.location.hash.includes("debug")) return;
    window.__moos = {
      store: useMoosStore,
      camera: useCameraStore,
      body: moosBody,
      state: st,
      rig,
      group,
      stroll: (to) => strollTo(st, to || pickStop(st.stop, st.prevStop)),
    };
    return () => delete window.__moos;
  }, [st, rig]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20) * st.timeScale; // timeScale: #debug slow-mo / freeze
    st.t += dt;
    const t = st.t;
    const g = group.current;
    if (!g) return;
    const store = useMoosStore.getState();

    // ---- locomotion (cheap, runs off-screen too) ---------------------------
    if (st.mode === "walking") {
      if (st.walker.update(moosBody, dt)) {
        st.mode = "arrived";
        const stop = STOPS[st.stop];
        if (stop.look) {
          st.lookAt = stop.look;
          st.lookUntil = t + rand(3, 5.5);
          st.faceHeading = Math.atan2(stop.look[0] - moosBody.x, stop.look[2] - moosBody.z);
        } else {
          st.lookAt = null;
          st.faceHeading = stop.face;
        }
        st.nextStrollAt = t + rand(STROLL_MIN, STROLL_MAX);
      }
    } else {
      st.walker.update(moosBody, dt); // brakes to a stop if interrupted
      if (st.mode === "chat") {
        // face the chat camera (where it is going, it may still be tweening)
        const cam = useCameraStore.getState().targetCameraPosition;
        turnTowards(moosBody, Math.atan2(cam.x - moosBody.x, cam.z - moosBody.z), dt, 2.2);
      } else if (st.mode === "arrived") {
        // study the rack, then turn back towards the overview camera
        const want =
          st.lookAt && t < st.lookUntil
            ? st.faceHeading
            : Math.atan2(camera.position.x - moosBody.x, camera.position.z - moosBody.z);
        turnTowards(moosBody, want, dt, 1.2);
      }
      if (!isMobile && st.mode !== "chat" && t > st.nextStrollAt) {
        if (canStroll()) strollTo(st, pickStop(st.stop, st.prevStop));
        else st.nextStrollAt = t + 4; // try again in a bit
      }
    }
    moosBody.speed = st.walker.speed;
    moosBody.walking = st.mode === "walking";
    g.position.set(moosBody.x, MOOS_FLOOR_Y, moosBody.z);
    g.rotation.y = moosBody.heading;

    // ---- visibility: skip the mixer when Moos is off-screen ---------------
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_m);
    _sphere.center.set(moosBody.x, MOOS_FLOOR_Y + 0.95 * MOOS_SCALE, moosBody.z);
    _sphere.radius = 1.25 * MOOS_SCALE;
    st.visible = _frustum.intersectsSphere(_sphere);

    // ---- which clip -------------------------------------------------------
    const moving = st.mode === "walking" || st.walker.speed > 0.06;
    let want = store.currentAnimation;
    if (want === "idle" && t < st.localWaveUntil) want = "wave";
    if (moving) want = "walk";
    const w = st.weights;
    for (const name of CLIPS) {
      const action = rig.actions[name];
      if (!action) continue;
      w[name] = damp(w[name], name === want ? 1 : 0, FADE, dt);
      if (w[name] < 0.002 && name !== want) w[name] = 0;
      action.setEffectiveWeight(w[name]);
    }
    // stride matches ground speed (no foot skating); never fully frozen
    rig.actions.walk.timeScale = MathUtils.clamp(st.walker.speed / st.walker.v, 0.35, 1.3);

    if (!st.visible) return;
    // The mixer only writes a bone when its animated value changed, so undo
    // last frame's additive look-at first (else it would accumulate on
    // constant channels / while frozen), then remember the mixer's pose.
    for (const [name] of LOOK_BONES) rig.bones[name]?.quaternion.copy(st.lookBase[name]);
    rig.mixer.update(dt);
    for (const [name] of LOOK_BONES) st.lookBase[name].copy(rig.bones[name].quaternion);

    // ---- look-at (additive, after the mixer) -------------------------------
    let lookWeight = 1;
    if (want === "think") {
      _v.set(0.6, 2.4, 1.6); // model space: up and to his left, pondering
      g.localToWorld(_v);
    } else if (st.mode === "arrived" && st.lookAt && t < st.lookUntil) {
      _v.fromArray(st.lookAt);
    } else {
      _v.copy(camera.position);
      _v2.set(pointer.x * 1.2, pointer.y * 0.8, 0).applyQuaternion(camera.quaternion);
      _v.add(_v2);
    }
    if (moving) lookWeight = 0.35; // mostly where he is going
    if (w.wave > 0.5) lookWeight = 0.6;
    if (st.lookOff) lookWeight = 0; // #debug
    st.lookW = damp(st.lookW, lookWeight, 3, dt);
    g.worldToLocal(_v);
    _v.sub(HEAD_PIVOT);
    let yaw = Math.atan2(_v.x, _v.z);
    let pitch = -Math.atan2(_v.y, Math.hypot(_v.x, _v.z));
    if (Math.abs(yaw) > MathUtils.degToRad(115)) {
      yaw = 0; // target behind him: look ahead
      pitch = 0;
    }
    yaw = MathUtils.clamp(yaw, -LOOK_YAW_MAX, LOOK_YAW_MAX) * st.lookW;
    pitch = MathUtils.clamp(pitch, -LOOK_PITCH_UP, LOOK_PITCH_DOWN) * st.lookW;
    st.yaw = damp(st.yaw, yaw, 4, dt);
    st.pitch = damp(st.pitch, pitch, 4, dt);
    // model-space yaw (about up) then pitch (about his right axis), to world
    g.getWorldQuaternion(_gq);
    _gqi.copy(_gq).invert();
    for (const [name, share] of LOOK_BONES) {
      const bone = rig.bones[name];
      if (!bone) continue;
      _qy.setFromAxisAngle(Y, st.yaw * share);
      _qx.setFromAxisAngle(X, st.pitch * share);
      _q.copy(_gq).multiply(_qy).multiply(_qx).multiply(_gqi);
      rotateBoneWorld(bone, _q);
    }
  });

  return (
    <group ref={group} name="moos" scale={MOOS_SCALE}>
      <primitive object={gltf.scene} />
      <mesh
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
          if (
            !st.hovered &&
            st.mode !== "walking" &&
            useMoosStore.getState().currentAnimation === "idle"
          ) {
            st.localWaveUntil = st.t + 1.6;
          }
          st.hovered = true;
        }}
        onPointerOut={() => {
          st.hovered = false;
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

function strollTo(st, target) {
  const path = buildPath(moosBody.x, moosBody.z, target);
  if (!path) return null;
  st.prevStop = nearestStop(moosBody.x, moosBody.z);
  st.stop = target;
  st.walker.start(path);
  st.mode = "walking";
  return target;
}
