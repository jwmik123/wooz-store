"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Box3,
  Frustum,
  Matrix4,
  NeutralToneMapping,
  Object3D,
  PCFShadowMap,
  Vector3,
} from "three/webgpu";
import { ATMOSPHERE_SETTINGS, SUN_MODEL, atmosphere } from "./atmosphere";
import { timeSettings } from "../uniforms";
import { skyNode, uMoonDirection, uSkyGround, uSunGlowColor } from "./sky";
import { RACK_LIGHTS, TABLE_LAMP, uLampGlow } from "./interior";
import { keyLight } from "./keyLight";
import { softPCFShadowFilter } from "./softShadow";
import { uLampFill, uSkyFill, uSunBounce } from "./lightmap";
import LightingControls from "./LightingControls";
import useDebug from "../debug/useDebug";
import useEnvironmentStore from "../../../stores/environmentStore";
import useQualityStore, { TIERS } from "../perf/quality";

/*
 * Real-time lighting rig for the studio (workstream 1).
 *
 *  - ONE shadow-casting DirectionalLight = sun by day, moon by night
 *    (direction/colour from ./atmosphere.js via the shared uniforms updater).
 *    Its ortho shadow camera is fitted tightly around the studio in light space
 *    and the 2048² map is only re-rendered when the light moved noticeably.
 *  - Studio shell + garments: baked GI lightmap (./lightmap.js, Cycles bake by
 *    scripts/lighting/bake_studio_gi.py): sky occlusion + bounce, sun bounce and
 *    the interior lamps, tinted per frame (uSkyFill / uSunBounce / uLampFill).
 *    Their material only sees the key light in real time (./keyLight.js).
 *  - HemisphereLight: sky dome above, warm floor + lawn bounce below — fill for
 *    everything WITHOUT a lightmap (Moos, birds, garden, props).
 *  - 3 PointLights (no shadows) for the interior practicals, also only for the
 *    un-lightmapped objects; always present (intensity 0 by day) so the light
 *    count never changes → no shader recompiles.
 *  - scene.backgroundNode = TSL sky (gradient, sun/moon, stars).
 *  - Tone mapping: Khronos PBR Neutral (keeps the pastel albedo true), exposure
 *    adapts day↔night via renderer.toneMappingExposure ONLY, so a later
 *    PostProcessing/renderOutput() pass picks it up unchanged.
 */

/** Studio + clothes bounds in world space (see Studio.jsx), with a little margin. */
const STUDIO_BOUNDS = new Box3(new Vector3(-2.3, -2.15, -3.6), new Vector3(2.3, 2.3, 3.6));
const STUDIO_CENTER = STUDIO_BOUNDS.getCenter(new Vector3());
/** Where the wind-blown garments hang (racks + table), world space. */
const CLOTHES_BOUNDS = new Box3(new Vector3(-2.2, -2, -3.5), new Vector3(2.2, 0.2, 2.2));
/** Periodic (animated-caster) shadow refreshes only when the camera is this close. */
const CLOTHES_VIEW_DISTANCE = 9;
/**
 * Key light distance from the studio centre. Far enough that casters OUTSIDE
 * the studio between it and the sun (the garden's apple-tree crowns overhang
 * the roof, ~6.5 m high) sit inside the shadow camera's depth range.
 */
const LIGHT_DISTANCE = 22;

export const shadowSettings = {
  mapSize: 2048,
  /** PCF filter radius in shadow-map texels (penumbra softness). */
  radius: 3,
  bias: -0.00015, // depth range ≈ 26 m (tree casters), ≈ 4 mm
  normalBias: 0.012,
  /** Re-render the shadow map when the key light rotated more than this (degrees). */
  updateThreshold: 0.1,
  /**
   * Extra periodic shadow refreshes per second (0 = only when the light moves),
   * for animated casters (wind-blown clothes, swaying leaves). The adaptive
   * quality tier (perf/quality.js) sets it (24 / 15 / 10 Hz), and it only runs
   * while the garments are on screen and close enough for moving shadows to read.
   */
  refreshHz: 24,
};

export const lightSettings = {
  /** Interior practical lights strength at night (PointLight intensity, candela). */
  tableLamp: 2.2,
  rackLights: 1.6,
};

let shadowDirty = true;
/** Ask for one shadow-map re-render on the next frame (e.g. after geometry changed). */
export function requestShadowUpdate() {
  shadowDirty = true;
}

const _corner = new Vector3();
const _min = new Vector3();
const _max = new Vector3();

/** Fit the ortho shadow camera around STUDIO_BOUNDS as seen from the light. */
function fitShadowCamera(light) {
  const cam = light.shadow.camera;
  light.updateMatrixWorld();
  light.target.updateMatrixWorld();
  light.shadow.updateMatrices(light);
  _min.set(Infinity, Infinity, Infinity);
  _max.set(-Infinity, -Infinity, -Infinity);
  const { min, max } = STUDIO_BOUNDS;
  for (let i = 0; i < 8; i++) {
    _corner
      .set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z)
      .applyMatrix4(cam.matrixWorldInverse);
    _min.min(_corner);
    _max.max(_corner);
  }
  cam.left = _min.x;
  cam.right = _max.x;
  cam.bottom = _min.y;
  cam.top = _max.y;
  // x/y fit the receivers (studio) tightly; depth starts at the light so
  // off-studio casters (tree crowns) still shadow it.
  cam.near = 0.1;
  cam.far = -_min.z + 0.5;
  cam.updateProjectionMatrix();
}

const _frustum = new Frustum();
const _viewProj = new Matrix4();

/** Wind-blown garments on screen and near enough for their moving shadows to matter. */
function clothesInView(camera) {
  if (CLOTHES_BOUNDS.distanceToPoint(camera.position) > CLOTHES_VIEW_DISTANCE) return false;
  _viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_viewProj);
  return _frustum.intersectsBox(CLOTHES_BOUNDS);
}

export default function Lights() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const getThree = useThree((s) => s.get);
  const debug = useDebug();

  const key = useRef();
  const hemi = useRef();
  const lamp = useRef();
  const racks = useRef([]);
  const lastShadowDir = useRef(new Vector3(0, -1, 0));
  const refreshAcc = useRef(0);
  const settleFrames = useRef(0);

  const target = useMemo(() => {
    const o = new Object3D();
    o.position.copy(STUDIO_CENTER);
    return o;
  }, []);

  // Renderer + scene level setup.
  useEffect(() => {
    const prev = {
      toneMapping: gl.toneMapping,
      exposure: gl.toneMappingExposure,
      shadowType: gl.shadowMap.type,
      backgroundNode: scene.backgroundNode,
    };
    gl.toneMapping = NeutralToneMapping;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = PCFShadowMap;
    scene.backgroundNode = skyNode;
    scene.add(target);
    if (debug) {
      // debug: inspect scene/camera and drive the clock from devtools
      window.__three = getThree;
      window.__env = useEnvironmentStore;
      window.__lighting = { atmosphere, timeSettings, shadowSettings, lightSettings, ATMOSPHERE_SETTINGS, SUN_MODEL };
    }
    return () => {
      gl.toneMapping = prev.toneMapping;
      gl.toneMappingExposure = prev.exposure;
      gl.shadowMap.type = prev.shadowType;
      scene.backgroundNode = prev.backgroundNode;
      scene.remove(target);
    };
  }, [gl, scene, target, debug, getThree]);

  // Shadow config (mapSize is read when the shadow map is created).
  useEffect(() => {
    const light = key.current;
    light.target = target;
    const s = light.shadow;
    s.mapSize.set(shadowSettings.mapSize, shadowSettings.mapSize);
    s.filterNode = softPCFShadowFilter;
    s.autoUpdate = false;
    s.needsUpdate = true;
    // Geometry streams in under Suspense: refresh a few times while it settles.
    settleFrames.current = 240;
  }, [target]);

  // Adaptive quality: shadow-map resolution + refresh rate follow the tier.
  useEffect(() => {
    const apply = ({ tier }) => {
      const t = TIERS[tier];
      shadowSettings.refreshHz = t.shadowHz;
      const s = key.current?.shadow;
      if (s && s.mapSize.x !== t.shadowMapSize) {
        // ShadowNode resizes its render target from mapSize on the next update.
        s.mapSize.set(t.shadowMapSize, t.shadowMapSize);
        shadowDirty = true;
      }
    };
    apply(useQualityStore.getState());
    return useQualityStore.subscribe(apply);
  }, []);

  useFrame(({ camera }, delta) => {
    const a = atmosphere; // computed this frame by <SharedUniforms /> (priority -100)
    const light = key.current;
    const s = light.shadow;

    // --- key light (sun / moon) ---
    light.color.copy(a.keyColor);
    light.intensity = a.keyIntensity;
    light.position.copy(STUDIO_CENTER).addScaledVector(a.keyDirection, LIGHT_DISTANCE);
    s.radius = shadowSettings.radius;
    s.bias = shadowSettings.bias;
    s.normalBias = shadowSettings.normalBias;

    const moved =
      lastShadowDir.current.angleTo(a.keyDirection) > (shadowSettings.updateThreshold * Math.PI) / 180;
    refreshAcc.current += delta;
    const periodic =
      shadowSettings.refreshHz > 0 &&
      refreshAcc.current >= 1 / shadowSettings.refreshHz &&
      clothesInView(camera);
    let settle = false;
    if (settleFrames.current > 0) {
      settleFrames.current--;
      settle = settleFrames.current % 30 === 0;
    }
    if (moved || periodic || settle || shadowDirty) {
      fitShadowCamera(light);
      s.needsUpdate = true;
      lastShadowDir.current.copy(a.keyDirection);
      refreshAcc.current = 0;
      shadowDirty = false;
    }

    // --- fill ---
    hemi.current.color.copy(a.hemiSky);
    hemi.current.groundColor.copy(a.hemiGround);
    hemi.current.intensity = a.hemiIntensity;

    // --- practicals ---
    const on = a.lamps;
    lamp.current.intensity = on * lightSettings.tableLamp * 1;
    for (const r of racks.current) r.intensity = on * lightSettings.rackLights;
    uLampGlow.value = on;

    // --- baked GI fill (studio + garments lightmap, see ./lightmap.js) ---
    uSkyFill.value.copy(a.skyFill);
    uSunBounce.value.copy(a.sunBounce);
    uLampFill.value.copy(a.lampFill);

    // --- sky ---
    uSkyGround.value.copy(a.ground);
    uMoonDirection.value.copy(a.moonDirection);
    uSunGlowColor.value.copy(a.keyColor).multiplyScalar(a.sunElevation > -3 ? 1 : 0);

    // --- exposure (the only exposure knob; post's renderOutput reads it) ---
    gl.toneMappingExposure = a.exposure;
  });

  return (
    <>
      <primitive ref={key} object={keyLight} />
      <hemisphereLight ref={hemi} args={["#cfe0f2", "#d8c8b4", 1]} />
      <pointLight
        ref={lamp}
        position={TABLE_LAMP.position}
        color={TABLE_LAMP.color}
        intensity={0}
        distance={6}
        decay={2}
      />
      {RACK_LIGHTS.map((r, i) => (
        <pointLight
          key={i}
          ref={(el) => (racks.current[i] = el)}
          position={r.position}
          color={r.color}
          intensity={0}
          distance={5}
          decay={2}
        />
      ))}
      {debug && <LightingControls />}
    </>
  );
}

