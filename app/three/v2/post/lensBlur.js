import {
  Fn,
  clamp,
  convertToTexture,
  float,
  max,
  mix,
  smoothstep,
  step,
  vec4,
} from "three/tsl";
import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";

/*
 * Lightweight photographic depth of field ("tilt-shift-lite").
 *
 * three's DepthOfFieldNode (64 + 16 tap bokeh gathers for near AND far field)
 * measured ~3 ms at 1080p here, far over budget for a subtle effect. This
 * version builds a small blur pyramid with separable gaussians instead:
 *
 *   sharp (full res RTT)
 *   far  = blur( rgb·w, w ) at 1/2 res, then again at 1/4 res     w = far CoC
 *   near = blur( rgb )      at 1/2 res
 *   composite at full res: sharp → far (small → large by CoC) → near
 *
 * Weighting the far blur by its own CoC (and dividing it back out) keeps sharp
 * foreground silhouettes from smearing into the blurred background (no halos).
 * Near-field blur is not spread over the focus plane — fine for the soft
 * foreground we want, much cheaper than a scatter/gather near field.
 */
export function lensBlur(colorNode, viewZNode, focusNode, rangeNode, strengthNode) {
  const sharp = convertToTexture(colorNode);
  const dist = viewZNode.negate();

  // Circle of confusion with an in-focus dead zone of ±range/2 around the focus
  // plane: the whole subject stays crisp, blur ramps in beyond it.
  // The sky (nothing drawn, depth at the far plane) only gets a light blur so
  // stars and the sun disc stay crisp-ish while cloud edges still soften into it.
  const isSky = step(900, dist);
  const farCoC = mix(
    clamp(smoothstep(rangeNode.mul(0.5), rangeNode.mul(2), dist.sub(focusNode)), 0, 1),
    float(0.3),
    isSky
  );
  const nearCoC = clamp(smoothstep(rangeNode.mul(0.3), rangeNode, focusNode.sub(dist)), 0, 1);

  const weighted = vec4(sharp.rgb.mul(farCoC), farCoC);
  const farSmall = gaussianBlur(weighted, null, 2, { resolutionScale: 0.5 });
  const farLarge = gaussianBlur(farSmall, null, 3, { resolutionScale: 0.5 });
  const nearBlur = gaussianBlur(sharp, null, 2, { resolutionScale: 0.5 });

  return Fn(() => {
    const base = sharp;
    const fs = farSmall.rgb.div(max(farSmall.a, 1e-3));
    const fl = farLarge.rgb.div(max(farLarge.a, 1e-3));
    const far = mix(fs, fl, smoothstep(0.4, 1.0, farCoC));
    const farMix = smoothstep(0.0, 0.5, farCoC).mul(strengthNode).min(1);
    const nearMix = nearCoC.mul(strengthNode).min(1);
    const out = mix(base.rgb, far, farMix);
    return vec4(mix(out, nearBlur.rgb, nearMix), float(1));
  })();
}
