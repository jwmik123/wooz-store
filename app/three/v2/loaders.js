import { useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

// One KTX2Loader per renderer (it owns a transcoder worker pool).
const ktx2Loaders = new WeakMap();

export function getKTX2Loader(renderer) {
  let loader = ktx2Loaders.get(renderer);
  if (!loader) {
    loader = new KTX2Loader().setTranscoderPath("/basis/");
    loader.detectSupport(renderer);
    ktx2Loaders.set(renderer, loader);
  }
  return loader;
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
