import * as THREE from "three/webgpu";
import { extend } from "@react-three/fiber";

// Register every three/webgpu class (incl. *NodeMaterial) as a JSX element,
// e.g. <meshStandardNodeMaterial />.
extend(THREE);

/**
 * Renderer factory for R3F 9's async `gl` prop.
 *
 * WebGPURenderer picks the WebGPU backend when `navigator.gpu` is available and
 * falls back to its WebGL2 backend automatically. TSL / NodeMaterials work on both.
 * Append `?webgl` to the URL to force the WebGL2 backend for testing.
 *
 *   <Canvas gl={createRenderer} />
 */
export async function createRenderer(props) {
  const forceWebGL =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("webgl");

  const renderer = new THREE.WebGPURenderer({
    ...props,
    antialias: true,
    alpha: true,
    forceWebGL,
  });
  await renderer.init();
  return renderer;
}

/** "WebGPU" | "WebGL2" for a renderer created by createRenderer. */
export function getBackendName(renderer) {
  return renderer?.backend?.isWebGPUBackend ? "WebGPU" : "WebGL2";
}
