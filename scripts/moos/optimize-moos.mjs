/*
 * Turns the Blender-rigged Moos GLB (scripts/moos/rig_moos.py output, 2K PNG
 * basecolor + 4K PNG metallicRoughness, ~12 MB) into public/models/v2/moos.glb.
 *
 *  - metallicRoughness: Meshy bakes a noisy 4K map; Moos is matte, so the map is
 *    dropped and replaced by constant factors (metallic 0, roughness 0.8).
 *    Channel stats are printed so the decision can be re-checked.
 *  - basecolor -> SIZE² (default 1024) UASTC KTX2 (zstd) via `basisu`
 *  - meshopt (FILTER) compression; positions stay float (skinned mesh: no
 *    node-level dequantisation transform), normals/uv/weights quantised.
 *
 * Usage (deps are not part of the app; install them in a temp dir and run there):
 *   npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
 *   node optimize-moos.mjs moos_rigged.glb public/models/v2/moos.glb [1024]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { prune, dedup, reorder, quantize, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const [, , input, output, sizeArg = '1024'] = process.argv;
const SIZE = +sizeArg;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});
const doc = await io.read(input);
const root = doc.getRoot();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'moos-'));

for (const mat of root.listMaterials()) {
  const mr = mat.getMetallicRoughnessTexture();
  if (mr) {
    const { channels } = await sharp(Buffer.from(mr.getImage())).stats();
    const fmt = (c) => `mean ${c.mean.toFixed(1)} sd ${c.stdev.toFixed(1)}`;
    console.log(`metallicRoughness: roughness(G) ${fmt(channels[1])}, metallic(B) ${fmt(channels[2])} -> dropped`);
    mat.setMetallicRoughnessTexture(null);
  }
  mat.setMetallicFactor(0).setRoughnessFactor(0.8).setDoubleSided(false);
  mat.setName('moos');

  const base = mat.getBaseColorTexture();
  const png = path.join(tmp, 'base.png');
  const ktx = path.join(tmp, 'base.ktx2');
  await sharp(Buffer.from(base.getImage())).resize(SIZE, SIZE, { kernel: 'lanczos3' }).png().toFile(png);
  execFileSync('basisu', ['-ktx2', '-mipmap', '-uastc', '-uastc_level', '2', '-uastc_rdo_l', '1.0',
    '-ktx2_zstandard_level', '18', png, '-output_file', ktx], { stdio: 'ignore' });
  base.setImage(new Uint8Array(fs.readFileSync(ktx))).setMimeType('image/ktx2').setURI('');
  console.log('basecolor', SIZE, 'ktx2', fs.statSync(ktx).size);
}
doc.createExtension(KHRTextureBasisu).setRequired(true);

for (const mesh of root.listMeshes()) mesh.setName('moos');
await doc.transform(
  prune(),
  dedup(),
  weld(),
  reorder({ encoder: MeshoptEncoder, target: 'size' }),
  quantize({ pattern: /^(NORMAL|TEXCOORD_0|WEIGHTS_0)$/, quantizeNormal: 10, quantizeTexcoord: 12 }),
);
doc.createExtension(KHRMeshQuantization).setRequired(true);
doc.createExtension(EXTMeshoptCompression).setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(output, doc);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('wrote', output, fs.statSync(output).size);
