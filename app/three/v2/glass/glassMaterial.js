import { Color, DoubleSide, MeshBasicNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";
import {
  abs,
  cameraPosition,
  clamp,
  dot,
  float,
  select,
  max,
  mix,
  normalWorld,
  normalize,
  positionWorld,
  pow,
  reflect,
  screenUV,
  smoothstep,
  texture,
  uv,
  viewportMipTexture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { uKeyLightDirection, uNightFactor, uSkyHorizon, uSkyZenith, uSunColor } from "../uniforms";
import { uLampColor, uLampGlow } from "../lighting/interior";
import { bakedLightsNode } from "../lighting/keyLight";
import { getFinishNoiseTexture } from "../studio/finishNoise";
import { DOODLE, FOG_MASK_W, getFogDoodleTexture, getFogMaskTexture, uFog, uFogLine } from "./fog";

/*
 * Greenhouse glass: no transmission/refraction, just what clean float glass
 * adds on top of what's behind it (premultiplied, blended over the scene):
 *   - Schlick Fresnel (F0 = 0.06, a touch above real glass so the panes read) reflection of the sky dome, so the panes are
 *     nearly invisible face-on and pick up the sky at grazing angles;
 *   - a tight glint (+ soft halo) of the key light (sun / moon);
 *   - at night the reflection turns into the warm interior instead of the sky;
 *   - a faint green body tint that grows at grazing angles (edge-on glass);
 *   - a hint of dust / dried rain near the lower edge of each plane.
 *
 * Options:
 *   fog   condensation layer for the sale-drop countdown (./fog.js): the scene
 *         behind blurred (mip-mapped viewport copy, `fog.blur`; a flat milky
 *         layer without it), droplets, run streaks, wiped clear by the
 *         visitor's pointer and dried top-down by the sun at T-0.
 *   fade  uniform multiplying the whole layer (the temporary front wall).
 */
/**
 * Heavily blurred copy of the scene behind the glass (mip level 4.5), refreshed
 * only every `every`-th render: copying the frame and building its mip chain is
 * several full-screen passes, and under this much blur a copy that is a few
 * frames old is invisible.
 */
function throttledViewportMip(every) {
  const node = viewportMipTexture(screenUV, float(4.5));
  const copy = node.updateBefore.bind(node);
  let n = 0;
  node.updateBefore = (frame) => {
    if (n++ % every === 0) copy(frame);
  };
  return node;
}

export function createGlassMaterial({ fog = null, fade = null } = {}) {
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

  let rgb = refl.mul(F).add(glint).add(dustColor.mul(dust)).add(green.mul(greenA));
  let a = clamp(F.add(dust).add(greenA).add(glint.g.mul(0.5)), 0, 0.9);

  if (fog) {
    m.name = "greenhouseGlassFogged";
    const noiseTex = getFinishNoiseTexture();
    const dried = smoothstep(uFogLine.sub(0.45), uFogLine, positionWorld.y);

    // Finger trails (screen space) and the doodles on the front glass (world
    // x/y), both R = cleared track, G = water drops (./fingerStroke.js). The
    // drops are shaded by a one-texel emboss: highlight towards the light
    // (upper left), a darker refracting rim on the other side.
    const maskTex = getFogMaskTexture();
    const mt = 1 / FOG_MASK_W;
    const mk = texture(maskTex, screenUV);
    const mkOff = texture(maskTex, screenUV.add(vec2(mt, mt)));
    const P = positionWorld;
    const onFront = abs(Nw.z).greaterThan(0.7).and(P.z.greaterThan(3));
    const dUv = vec2(P.x.sub(DOODLE.x0), float(DOODLE.y0).sub(P.y)).mul(DOODLE.ppm / DOODLE.size);
    const dt = 1.5 / DOODLE.size;
    const dd = texture(getFogDoodleTexture(), dUv);
    const ddOff = texture(getFogDoodleTexture(), dUv.add(vec2(dt, dt)));
    const front = select(onFront, float(1), float(0));
    const track = mk.r.max(dd.r.mul(front)).clamp(0, 1);
    const drops = mk.g.max(dd.g.mul(front)).clamp(0, 1);
    const dropsOff = mkOff.g.max(ddOff.g.mul(front)).clamp(0, 1);
    const shine = drops.sub(dropsOff).max(0);
    const rimShade = dropsOff.sub(drops).max(0);

    // Haze: condensation is heavier low on a pane (uv.y = metres above its
    // lower edge), patchy over large areas, with a fine frosted grain.
    const patch = texture(noiseTex, uv().mul(0.45)).r;
    const heavy = mix(float(1), float(0.8), smoothstep(0.2, 2.2, uv().y));
    // A wiped track is never bone dry: a thin streaky film stays behind.
    const film = mix(float(0.1), float(0.22), texture(noiseTex, uv().mul(vec2(31.0, 9.0))).b);
    const cleared = track.mul(float(1).sub(film)).max(drops.mul(0.55));
    const density = uFog
      .mul(float(1).sub(dried))
      .mul(heavy)
      .mul(mix(float(0.82), float(1), patch))
      .mul(float(1).sub(cleared));

    const tint = mix(vec3(0.9, 0.93, 0.92), uLampColor.mul(0.35).add(vec3(0.06, 0.07, 0.08)), uNightFactor);
    const behind = fog.blur ? throttledViewportMip(3).rgb : tint.mul(0.55);
    // Dense, milky condensation: the room behind only as soft blurred colour.
    const milk = behind.mul(0.62).add(tint.mul(0.4));
    const fA = density.mul(fog.blur ? 0.96 : 0.78);
    const wet = uFog.mul(float(1).sub(dried));
    const sky = mix(uSkyHorizon, uSkyZenith, 0.6).add(uSunColor.mul(0.25));
    rgb = rgb
      .mul(float(1).sub(fA))
      .add(milk.mul(fA))
      .add(sky.mul(shine.mul(0.45).mul(wet)))
      .sub(vec3(rimShade.mul(0.08).mul(wet)))
      .max(0);
    a = a.mul(float(1).sub(fA)).add(fA).add(shine.mul(0.15).mul(wet)).min(1);
  }
  if (fade) {
    rgb = rgb.mul(fade);
    a = a.mul(fade);
  }
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
