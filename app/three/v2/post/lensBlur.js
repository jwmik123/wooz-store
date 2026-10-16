import { Fn, clamp, float, mix, rtt, smoothstep, step, vec4 } from "three/tsl";
import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";

/*
 * Lightweight photographic depth of field ("tilt-shift-lite").
 *
 * three's DepthOfFieldNode (64 + 16 tap bokeh gathers for near AND far field)
 * measured ~3 ms at 1080p here, far over budget for a subtle effect. This
 * version builds a small blur pyramid with separable gaussians instead, and
 * keeps every intermediate at half resolution or below:
 *
 *   half = (rgb, farCoC)              ONE half-res pass over the scene colour
 *   far  = blur(half, premultiplied)  at 1/2 res, then again at 1/4 res
 *   near = blur(half.rgb)             at 1/2 res
 *   composite at full res: sharp → far (small → large by CoC) → near
 *
 * The premultiplied blur weights every tap by its own far CoC (and divides it
 * back out), so sharp foreground silhouettes never smear into the blurred
 * background (no halos). Near-field blur is not spread over the focus plane —
 * fine for the soft foreground we want, much cheaper than a scatter/gather.
 *
 * The only full-resolution work is the final composite (and the scene pass).
 * `half` is also handed back so bloom can reuse it as its (half-res) input.
 */
export function lensBlur(colorNode, viewZNode, focusNode, rangeNode, strengthNode) {
  const farCoCAt = (dist) => {
    // Circle of confusion with an in-focus dead zone of ±range/2 around the focus
    // plane: the whole subject stays crisp, blur ramps in beyond it.
    // The sky (nothing drawn, depth at the far plane) only gets a light blur so
    // stars and the sun disc stay crisp-ish while cloud edges still soften into it.
    const isSky = step(900, dist);
    return mix(
      clamp(smoothstep(rangeNode.mul(0.5), rangeNode.mul(2), dist.sub(focusNode)), 0, 1),
      float(0.3),
      isSky
    );
  };

  const dist = viewZNode.negate();
  const farCoC = farCoCAt(dist);
  const nearCoC = clamp(smoothstep(rangeNode.mul(0.3), rangeNode, focusNode.sub(dist)), 0, 1);

  const half = rtt(vec4(colorNode.rgb, farCoC), null, null, { resolutionScale: 0.5 });
  const farSmall = gaussianBlur(half, null, 2, { premultipliedAlpha: true });
  const farLarge = gaussianBlur(farSmall, null, 3, { premultipliedAlpha: true, resolutionScale: 0.5 });
  const nearBlur = gaussianBlur(half, null, 2);

  const out = Fn(() => {
    const far = mix(farSmall.rgb, farLarge.rgb, smoothstep(0.4, 1.0, farCoC));
    const farMix = smoothstep(0.0, 0.5, farCoC).mul(strengthNode).min(1);
    const nearMix = nearCoC.mul(strengthNode).min(1);
    const sharpFar = mix(colorNode.rgb, far, farMix);
    return vec4(mix(sharpFar, nearBlur.rgb, nearMix), float(1));
  })();

  return { node: out, half };
}
