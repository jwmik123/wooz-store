/*
 * The downloads the loader waits for (studio + Moos in the scene, KTX2
 * transcoder, baked lightmaps). Plain strings, no three.js: the loader
 * prefetches them as soon as its JS runs (fetchTracker.js), in parallel with
 * the 3D chunk and WebGPU init instead of after them.
 */

// Phones get the same mesh with a 2048² albedo (studio-mobile.glb, ~2.3 MB lighter).
export const IS_PHONE =
  typeof navigator !== "undefined" && /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent);

export const STUDIO_URL = IS_PHONE ? "/models/v2/studio-mobile.glb" : "/models/v2/studio.glb";
export const MOOS_URL = "/models/v2/moos.glb";
export const BIRD_URL = "/models/bird.glb";
export const LIGHTMAP_SKY_URL = "/models/v2/studio-lm-sky.ktx2";
export const LIGHTMAP_AUX_URL = "/models/v2/studio-lm-aux.ktx2";
export const BASIS_PATH = "/basis/";

export const CRITICAL_ASSETS = [
  STUDIO_URL,
  MOOS_URL,
  `${BASIS_PATH}basis_transcoder.js`,
  `${BASIS_PATH}basis_transcoder.wasm`,
  LIGHTMAP_SKY_URL,
  LIGHTMAP_AUX_URL,
  BIRD_URL,
];
