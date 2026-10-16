# Wooz Store V2 — WebGPU + TSL

Branch: `v2-webgpu`. Doel: portfolio-showcase van wat Three.js/WebGPU/TSL kan, in de stijl van de bestaande Wooz studio (zachte pastels, licht hout, planten, kleding aan rekken, studio zwevend in de wolken).

## Bron-asset: `studioMat4.glb` (van kevkev)

- 19 meshes: `studio.001` (hele studio, 1 mesh, heeft `COLOR_0`/`COLOR_1` vertex colors) + 18 kledingstukken als losse meshes
  (`Splatter_*`, `Longsleeve_*`, `Polo2_*`, `Hoodie_*`). Draco + webp.
- 1 materiaal `bake_Diffuse`, 8192² webp = **Cycles DIFFUSE color bake (albedo, géén licht/schaduw)** → ideaal voor echt licht.
- **Geen NORMAL attribuut** → normals runtime genereren met crease-angle (`toCreasedNormals`) of offline toevoegen.
- Geen animaties. Kleding heeft geen bones.
- 8K texture is te zwaar voor GPU-geheugen → offline naar KTX2 (UASTC/ETC1S) 4096 (+ evt. 8K voor desktop).

## Stack (fundament)

- Next 15 + React 19 + `@react-three/fiber` 9 + `@react-three/drei` 10 + `three` (laatste r18x).
- `WebGPURenderer` via async `gl` prop van R3F 9; valt automatisch terug op WebGL2-backend (TSL werkt op beide).
- Alle materialen als NodeMaterials/TSL. Geen GLSL `ShaderMaterial` meer, geen `@react-three/postprocessing` (werkt niet met WebGPU) → three's TSL `PostProcessing` (`dof`, `bloom`, evt. `ao`).
- Rapier eruit (ongebruikt). Leva alleen achter `#debug`.
- Referentieproject met werkende R3F9 + WebGPU setup: `~/Code/tsl-cosy-room`.

## Architectuur (zodat workstreams parallel kunnen)

```
app/three/v2/
  Scene.jsx            // compositie: <Canvas> + één regel per feature
  renderer.js          // WebGPURenderer factory
  Studio.jsx           // studio mesh + NodeMaterial (albedo bake + licht)
  Clothes.jsx          // kledingstukken + wind-displacement
  lighting/            // zon, sky, dag/nacht, interieurlampen
  clouds/              // TSL wolken
  wind/                // windstrokes
  post/                // PostProcessing pipeline (DOF etc.)
  moos/                // mascotte
  uniforms.js          // GEDEELDE TSL uniforms: uTime, uDayProgress, uSunDir, uWindDir, uWindStrength ...
app/stores/environmentStore.js  // tijd van dag (auto = lokale tijd bezoeker, of override via debug slider)
```

Regel: features praten met elkaar via `uniforms.js` + stores, niet via elkaars componenten.

## Workstreams

| # | Workstream | Afhankelijk van | Model |
|---|---|---|---|
| 0 | Fundament: stack upgrade, WebGPU canvas, studioMat4 laden, uniforms/stores, bestaande features (camera, sidebar, product, cart) werkend houden | – | Opus |
| 1 | Licht + dag/nacht: zon door ramen, schaduwen, sky, maan/nacht, interieurlampen aan bij schemer, tijd = lokale tijd bezoeker, debug slider | 0 | Opus |
| 2 | Wolken (TSL, performant, eindeloos) + DOF + post pipeline | 0 | Opus |
| 3 | Wind: kleding wappert (TSL vertex displacement, vastgepind bij hanger) + windstrokes | 0 | Sonnet |
| 4 | Sidebar UI high-end upgrade, 3D shirt (Wiggle) + foto-weergave prominent | 0 | Opus |
| 5 | Moos: mascotte (model + idle/talk animaties) in de scene | 0 (+ keuze model) | t.b.d. |
| 6 | Moos chat: AI SDK + AI Gateway, streaming, kent producten (Shopify) | 0 | Sonnet |
| 7 | Performance pass + review (GPU timings, draw calls, texture memory, mobile) | 1–6 | Opus |

## Performance-budget

- Desktop: 60 fps op M1/integrated GPU; mobile: 30+ fps, DPR max 1.5.
- Eén shadow-casting light (zon), shadowmap ≤ 2048, alleen updaten als zon beweegt.
- Texture memory: studio ≤ 1 × 4K KTX2 op mobile.
- Draw calls laag houden: kleding kan instanced/merged waar wind dat toelaat.
- DOF/clouds: half-res waar mogelijk.
