import { useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

// ONE KTX2Loader for the page (it owns a transcoder worker pool; three warns
// about several active ones). The scene and the sidebar product viewer use the
// same backend type (both WebGPU, or both WebGL2 with ?webgl), so the transcode
// target detected on the first renderer is valid for both.
let ktx2Loader = null;

export function getKTX2Loader(renderer) {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader().setTranscoderPath("/basis/");
    ktx2Loader.detectSupport(renderer);
  }
  return ktx2Loader;
}

/**
 * GLTF loader for v2 assets: meshopt geometry + KTX2 (Basis) textures.
 * Suspends like drei's useGLTF and returns the same { scene, nodes, materials } shape.
 */
export function useGLTFv2(url) {
  const gl = useThree((s) => s.gl);
  return useLoader(GLTFLoader, url, (loader) => {
    loader.setKTX2Loader(getKTX2Loader(gl));
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
}
