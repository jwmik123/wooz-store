import { Color, DoubleSide, MeshBasicNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";
import {
  abs,
  cameraPosition,
  clamp,
  dot,
  float,
  max,
  mix,
  normalWorld,
  normalize,
  positionWorld,
  pow,
  reflect,
  smoothstep,
  texture,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { uKeyLightDirection, uNightFactor, uSkyHorizon, uSkyZenith, uSunColor } from "../uniforms";
import { uLampColor, uLampGlow } from "../lighting/interior";
import { bakedLightsNode } from "../lighting/keyLight";
import { getFinishNoiseTexture } from "../studio/finishNoise";

/*
 * Greenhouse glass: no transmission/refraction, just what clean float glass
 * adds on top of what's behind it (premultiplied, blended over the scene):
 *   - Schlick Fresnel (F0 = 0.06, a touch above real glass so the panes read) reflection of the sky dome, so the panes are
 *     nearly invisible face-on and pick up the sky at grazing angles;
 *   - a tight glint (+ soft halo) of the key light (sun / moon);
 *   - at night the reflection turns into the warm interior instead of the sky;
 *   - a faint green body tint that grows at grazing angles (edge-on glass);
 *   - a hint of dust / dried rain near the lower edge of each plane.
 */
export function createGlassMaterial() {
  const m = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  m.name = "greenhouseGlass";
  m.premultipliedAlpha = true;
  m.fog = false;

  const V = normalize(cameraPosition.sub(positionWorld));
  const Nw = normalize(normalWorld);
  const facing = dot(Nw, V);
  const N = Nw.mul(facing.sign()); // double-sided: always face the viewer
  const cosT = abs(facing).clamp(0, 1);
  const F = float(0.06).add(float(0.94).mul(pow(float(1).sub(cosT), 5))).min(0.7);

  // Reflected sky (same gradient as the post sky backdrop); below the horizon
  // a dim, greyed horizon (ground / garden / interior).
  const R = reflect(V.negate(), N);
  const skyT = pow(smoothstep(0.0, 0.65, max(R.y, 0)), float(0.6));
  const sky = mix(uSkyHorizon, uSkyZenith, skyT);
  const ground = uSkyHorizon.mul(vec3(0.32, 0.36, 0.3));
  const daySky = mix(ground, sky, smoothstep(-0.15, 0.05, R.y));
  // Night: the lit interior (lamps + rack spots) instead of the dark sky.
  const warm = uLampColor.mul(uLampGlow.mul(0.22)).add(uSkyZenith.mul(0.25));
  const refl = mix(daySky, warm, uNightFactor.mul(0.85));

  // Key-light glint: sharp core + soft halo.
  const rl = max(dot(R, uKeyLightDirection), 0);
  const glint = uSunColor.mul(pow(rl, 900).mul(5).add(pow(rl, 60).mul(0.1)));

  // Dust near the lower edge (uv.y = metres above it), broken up by the
  // studio finish noise (R: fbm mottling, B: fine grain).
  const noise = texture(getFinishNoiseTexture(), uv().mul(vec2(0.9, 1.6)));
  const grain = texture(getFinishNoiseTexture(), uv().mul(3.1)).b;
  const dust = smoothstep(0.32, 0.0, uv().y)
    .mul(smoothstep(0.45, 0.75, noise.r).mul(0.8).add(grain.mul(0.25)))
    .mul(0.07)
    .add(smoothstep(0.55, 0.9, noise.g).mul(0.01)); // faint smudges everywhere
  const dustColor = mix(vec3(0.62, 0.6, 0.55), uLampColor.mul(0.15), uNightFactor);

  // Faint green of the glass body, mostly visible edge-on.
  const greenA = mix(float(0.015), float(0.12), pow(float(1).sub(cosT), 3));
  const green = vec3(0.16, 0.26, 0.2).mul(mix(1, 0.15, uNightFactor));

  const rgb = refl.mul(F).add(glint).add(dustColor.mul(dust)).add(green.mul(greenA));
  const a = clamp(F.add(dust).add(greenA).add(glint.g.mul(0.5)), 0, 0.9);
  m.colorNode = vec4(0, 0, 0, 1);
  m.outputNode = vec4(rgb, a);
  return m;
}

/** Thin dark sash frame (matches the studio's black glazing bars). */
export function createSashMaterial() {
  const m = new MeshStandardNodeMaterial({
    color: new Color().setStyle("#1b1c1a", "srgb"),
    roughness: 0.55,
    metalness: 0.35,
  });
  m.name = "greenhouseSash";
  m.lightsNode = bakedLightsNode;
  // Sky fill (the studio has it baked; this small piece gets a flat stand-in).
  m.emissiveNode = vec3(0.1, 0.105, 0.1).mul(mix(uSkyHorizon, uSkyZenith, 0.5)).mul(0.8);
  return m;
}
