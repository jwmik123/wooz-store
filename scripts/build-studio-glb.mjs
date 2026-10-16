/*
 * Rebuilds public/models/v2/studio.glb from public/models/v2/studio-original.glb
 * (kevkev's studioMat4.glb: Draco + 8192² webp DIFFUSE bake, no normals).
 *
 *  - drops unused attributes (COLOR_0/COLOR_1 are constant white, TEXCOORD_1 is
 *    the pre-bake material UV set; the bake uses TEXCOORD_0)
 *  - adds creased normals (three's toCreasedNormals: 35° studio, 70° clothes)
 *  - replaces the webp with a 4096² UASTC KTX2 (KHR_texture_basisu)
 *  - meshopt compression; positions stay float so node transforms are untouched
 *
 * Usage (deps are not part of the app, install them in a temp dir):
 *   npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions \
 *         draco3dgltf@1.5.7 meshoptimizer sharp three
 *   # albedo: extract the webp, resize to 4096 (sharp, lanczos3), then
 *   basisu -ktx2 -mipmap -uastc -uastc_level 2 -uastc_rdo_l 1.0 \
 *          -ktx2_zstandard_level 18 albedo4k.png -output_file albedo4k_uastc.ktx2
 *   node build-studio-glb.mjs studio-original.glb albedo4k_uastc.ktx2 studio.glb 35
 */
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { reorder, quantize, prune, dedup } from '@gltf-transform/functions';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import * as THREE from 'three';
import { toCreasedNormals, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import fs from 'fs';

const [,, input, ktx, output, angleDeg = '35'] = process.argv;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
const doc = await io.read(input);
const root = doc.getRoot();
// strip draco
for (const e of root.listExtensionsUsed()) if (e.extensionName === 'KHR_draco_mesh_compression') e.dispose();

const DROP=['COLOR_0','COLOR_1','TEXCOORD_1'];
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const g = new THREE.BufferGeometry();
    for (const d of DROP) if (prim.getAttribute(d)) prim.setAttribute(d, null);
    const sem = prim.listSemantics();
    const crease = THREE.MathUtils.degToRad(mesh.getName().startsWith('Cube') ? +angleDeg : 70);
    for (const s of sem) {
      const a = prim.getAttribute(s);
      const name = s.toLowerCase();
      g.setAttribute(name, new THREE.BufferAttribute(a.getArray().slice(), a.getElementSize(), a.getNormalized()));
    }
    if (prim.getIndices()) g.setIndex(new THREE.BufferAttribute(prim.getIndices().getArray().slice(), 1));
    const before = g.attributes.position.count;
    let out = toCreasedNormals(g, crease);
    out = mergeVertices(out, 1e-5);
    for (const s of sem) prim.getAttribute(s).dispose?.();
    for (const [name, attr] of Object.entries(out.attributes)) {
      const sName = name === 'normal' ? 'NORMAL' : name.toUpperCase();
      const acc = doc.createAccessor().setType(['','SCALAR','VEC2','VEC3','VEC4'][attr.itemSize]).setArray(attr.array).setNormalized(attr.normalized).setBuffer(root.listBuffers()[0]);
      prim.setAttribute(sName, acc);
    }
    const idx = out.index.array;
    const IdxArr = out.attributes.position.count > 65535 ? Uint32Array : Uint16Array;
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(IdxArr.from(idx)).setBuffer(root.listBuffers()[0]));
    console.log(mesh.getName(), 'verts', before, '->', out.attributes.position.count);
  }
}
// texture -> ktx2
const basisu = doc.createExtension(KHRTextureBasisu).setRequired(true);
for (const t of root.listTextures()) { t.setImage(new Uint8Array(fs.readFileSync(ktx))).setMimeType('image/ktx2'); t.setURI(''); }
for (const e of root.listExtensionsUsed()) if (e.extensionName === 'EXT_texture_webp') e.dispose();
// Meshopt: positions stay float (no node-level dequantization transform, so
// positionLocal in shaders is in real model units); UVs quantized; FILTER mode
// (octahedral normals).
await doc.transform(prune(), dedup(), reorder({ encoder: MeshoptEncoder, target: 'size' }),
  quantize({ pattern: /^TEXCOORD_\d+$/, quantizeTexcoord: 14 }));
doc.createExtension(KHRMeshQuantization).setRequired(true);
doc.createExtension(EXTMeshoptCompression).setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(output, doc);
console.log('wrote', output, fs.statSync(output).size);
