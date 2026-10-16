import {
  Fn,
  float,
  interleavedGradientNoise,
  reference,
  renderGroup,
  screenCoordinate,
  texture,
  vogelDiskSample,
} from "three/tsl";

/** Taps of the soft PCF filter (each one is a hardware 2×2 compare). */
export const SOFT_SHADOW_TAPS = 10;

/**
 * Softer PCF for the sun/moon shadow (assign to `light.shadow.filterNode`).
 *
 * three's default PCF uses 5 Vogel-disk taps; at the radius a sun through a
 * glass roof needs (penumbra of a few cm at 2048² over the studio) that reads
 * as dithering. 10 IGN-rotated taps keep the edge smooth with MSAA alone (no
 * TAA). Cost: 10 compare samples per lit studio pixel, one light.
 */
export const softPCFShadowFilter = Fn(({ depthTexture, shadowCoord, shadow, depthLayer }) => {
  const mapSize = reference("mapSize", "vec2", shadow).setGroup(renderGroup);
  const radius = reference("radius", "float", shadow).setGroup(renderGroup);
  const radiusScaled = radius.div(mapSize.x);
  const phi = interleavedGradientNoise(screenCoordinate.xy).mul(6.28318530718);

  let sum = float(0);
  for (let i = 0; i < SOFT_SHADOW_TAPS; i++) {
    const offset = vogelDiskSample(i, SOFT_SHADOW_TAPS, phi).mul(radiusScaled);
    let depth = texture(depthTexture, shadowCoord.xy.add(offset));
    if (depthTexture.isArrayTexture) depth = depth.depth(depthLayer);
    sum = sum.add(depth.compare(shadowCoord.z));
  }
  return sum.div(SOFT_SHADOW_TAPS);
});
