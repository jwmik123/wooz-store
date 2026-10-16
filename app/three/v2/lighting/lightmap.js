import { Color } from "three/webgpu";
import { texture, uniform, uv } from "three/tsl";
import META from "./lightmap.json";

/*
 * Baked global illumination for the studio + garments (workstream 9).
 *
 * Baked offline in Blender/Cycles by scripts/lighting/bake_studio_gi.py into the
 * GLB's TEXCOORD_0 bake atlas (same UVs as the albedo), lighting only (no albedo):
 *
 *   studio-lm-sky.ktx2  RGB  irradiance from a uniform white sky dome of radiance 1
 *                            over the green lawn: sky occlusion + interior bounce +
 *                            lawn colour bleeding. 1.0 = open up-facing surface.
 *   studio-lm-aux.ktx2  R    interior practicals (table lamp + rack lights), direct
 *                            + bounce, normalised (1 = brightest texels).
 *                       G    sun bounce (indirect only), averaged over the sun arc;
 *                            ÷π = per unit of three.js DirectionalLight intensity.
 *
 * At runtime it's two texture lookups:
 *
 *   indirect = albedo × ( sky × uSkyFill  +  sunBounce × uSunBounce  +  lamp × uLampFill )
 *
 * added as emissive on the studio material, whose real-time lighting is limited
 * to the sun/moon DirectionalLight (with its shadow map). The fill colours are
 * written per frame by <Lights /> from lighting/atmosphere.js.
 */

export const LIGHTMAP_SKY_URL = "/models/v2/studio-lm-sky.ktx2";
export const LIGHTMAP_AUX_URL = "/models/v2/studio-lm-aux.ktx2";
export const LIGHTMAP_META = META;

/** Linear sky-dome radiance the sky map is multiplied with (vec3). */
export const uSkyFill = uniform(new Color(0.8, 0.85, 0.9));
/** Key light colour × intensity × bounce gain for the sun-bounce map (vec3). */
export const uSunBounce = uniform(new Color(0, 0, 0));
/** Lamp colour × on-factor × gain for the practicals map (vec3). */
export const uLampFill = uniform(new Color(0, 0, 0));

/**
 * Baked irradiance node (vec3, linear) for a material using the atlas UVs.
 * Multiply by the albedo for outgoing radiance.
 */
export function bakedIrradianceNode(skyMap, auxMap) {
  const st = uv();
  const sky = texture(skyMap, st).rgb.mul(META.sky.scale);
  const aux = texture(auxMap, st);
  return sky
    .mul(uSkyFill)
    // Baked with a Cycles sun of irradiance π; three's Lambert has the 1/π.
    .add(aux.g.mul(META.sunBounce.scale / Math.PI).mul(uSunBounce))
    .add(aux.r.mul(uLampFill));
}
