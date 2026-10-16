"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { levaStore, useControls } from "leva";
import { RenderPipeline } from "three/webgpu";
import {
  Fn,
  float,
  max,
  mix,
  normalize,
  pass,
  pow,
  smoothstep,
  uniform,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { dof } from "three/addons/tsl/display/DepthOfFieldNode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";
import { uSkyHorizon, uSkyZenith } from "../uniforms";
import useAutoFocus from "./useAutoFocus";
import useCameraStore from "../../../stores/cameraStore";

/*
 * Post pipeline (three RenderPipeline + TSL):
 *
 *   scene pass (MSAA) ─┬─ GTAO (half res, blurred)  ──┐  optional
 *                      │                              ▼
 *                      └─ colour × AO ── over sky backdrop ── DOF ── + bloom ── renderOutput
 *
 * Tone mapping + output colour space come from renderer.toneMapping /
 * toneMappingExposure / outputColorSpace (owned by lighting) and are applied
 * once at the end by RenderPipeline. Rendering happens in a priority-1
 * useFrame, which makes R3F skip its own render.
 */

// Shared, frame-updated uniforms (kept across pipeline rebuilds).
const uFocusDistance = uniform(5);
const uFocusRange = uniform(1);
const uBokehScale = uniform(3);
const uAoIntensity = uniform(1);

function buildPipeline(renderer, scene, camera, opts) {
  const pipeline = new RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode("output");
  const viewZ = scenePass.getViewZNode();

  let lit = color;
  let aoNode = null;

  if (opts.ao) {
    aoNode = ao(scenePass.getTextureNode("depth"), null, camera);
    aoNode.resolutionScale = 0.5;
    aoNode.samples.value = 12;
    aoNode.radius.value = 0.35;
    aoNode.thickness.value = 1;
    aoNode.distanceFallOff.value = 1;
    const aoBlurred = gaussianBlur(aoNode.getTextureNode(), null, 2);
    const occlusion = mix(float(1), aoBlurred.r, uAoIntensity);
    lit = vec4(color.rgb.mul(occlusion), color.a);
  }

  // Sky backdrop for pixels nothing was drawn to (transparent canvas), so the
  // DOF never blurs towards black. A no-op once the sky writes alpha = 1.
  const invProj = uniform(camera.projectionMatrixInverse);
  const camWorld = uniform(camera.matrixWorld);
  const withSky = Fn(() => {
    const ndc = uv().mul(2).sub(1);
    // Post quads sample with uv.y = 0 at the top.
    const viewRay = invProj.mul(vec4(ndc.x, ndc.y.negate(), 1, 1));
    const dir = normalize(camWorld.mul(vec4(viewRay.xyz.div(viewRay.w), 0)).xyz);
    const t = pow(smoothstep(0.0, 0.65, max(dir.y, 0)), float(0.6));
    const sky = mix(uSkyHorizon, uSkyZenith, t);
    // Scene colour is premultiplied (blended over a transparent clear).
    return vec4(lit.rgb.add(sky.mul(float(1).sub(lit.a))), 1);
  })();

  let out = withSky;

  if (opts.dof) {
    const focalRange = max(uFocusDistance.mul(uFocusRange), 1.2);
    out = dof(withSky, viewZ, uFocusDistance, focalRange, uBokehScale);
  }

  let bloomNode = null;
  if (opts.bloom) {
    bloomNode = bloom(out, opts.bloomStrength, 0.4, opts.bloomThreshold);
    out = out.add(bloomNode);
  }

  pipeline.outputNode = out;
  return { pipeline, scenePass, aoNode, bloomNode };
}

/**
 * Mount once inside <Canvas>. Toggle (or tune) everything in leva (#debug).
 * When `enabled` is off the component renders nothing and R3F renders as usual.
 */
export default function PostPipeline() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const c = useControls(
    "Post",
    {
      enabled: true,
      dof: true,
      focusRange: { value: 1.4, min: 0.1, max: 3, step: 0.01 },
      bokehScale: { value: 2, min: 0, max: 10, step: 0.1 },
      ao: false,
      aoIntensity: { value: 1, min: 0, max: 1, step: 0.01 },
      bloom: true,
      bloomStrength: { value: 0.12, min: 0, max: 1, step: 0.01 },
      bloomThreshold: { value: 0.9, min: 0, max: 2, step: 0.01 },
    },
    { collapsed: true }
  );

  uFocusRange.value = c.focusRange;
  uBokehScale.value = c.bokehScale;
  uAoIntensity.value = c.aoIntensity;

  const enabled = c.enabled;
  const post = useMemo(
    () =>
      enabled
        ? buildPipeline(gl, scene, camera, {
            dof: c.dof,
            ao: c.ao,
            bloom: c.bloom,
            bloomStrength: c.bloomStrength,
            bloomThreshold: c.bloomThreshold,
          })
        : null,
    // Bloom strength/threshold are live uniforms below; rebuild only on toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, gl, scene, camera, c.dof, c.ao, c.bloom]
  );

  useEffect(() => () => post?.pipeline.dispose(), [post]);

  useEffect(() => {
    if (!post?.bloomNode) return;
    post.bloomNode.strength.value = c.bloomStrength;
    post.bloomNode.threshold.value = c.bloomThreshold;
  }, [post, c.bloomStrength, c.bloomThreshold]);

  const focus = useAutoFocus(uFocusDistance);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    window.__woozPost = { scene, camera, post, focus, uFocusDistance, leva: levaStore, cameraStore: useCameraStore };
  }, [scene, camera, post, focus]);

  return post ? <PostRender pipeline={post.pipeline} /> : null;
}

/** Priority > 0 takes over rendering from R3F. */
function PostRender({ pipeline }) {
  useFrame(() => pipeline.render(), 1);
  return null;
}
