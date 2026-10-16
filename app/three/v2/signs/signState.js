import { uniform } from "three/tsl";
import { Vector3 } from "three/webgpu";
import gsap from "gsap";
import { create } from "zustand";

/*
 * Shared state for the rack signboards (Signs.jsx), the rack hover glow / idle
 * light sweep in the cloth material (wind/clothWind.js) and the table-item
 * glow / sweep in the studio shell material (signs/spotGlow.js).
 * Uniforms are only written from event handlers / tweens, never per frame
 * from React.
 */

/** 0 = signs hidden (faded out), 1 = shown. Tweened by setSignsVisible. */
export const uSignsFade = uniform(0);
/** Index of the hovered sign (-1 = none) + its eased hover amount. */
export const uHoverSign = uniform(-1);
export const uHoverAmt = uniform(0);

/** Rack ids for the cloth highlight (per-garment `rackId` attribute). */
export const RACK_IDS = { hoodie: 0, splatter: 1, polo: 2, longsleeve: 3 };
/** Hovered rack id (-1 = none) + eased glow amount (fresnel rim). */
export const uGlowRack = uniform(-1);
export const uGlowAmt = uniform(0);
/** Idle discoverability sweep: rack id, progress 0..1 along the sweep axis, extent. */
export const uSweepRack = uniform(-1);
export const uSweepT = uniform(0);
export const uSweepMin = uniform(0);
export const uSweepMax = uniform(1);

/*
 * Table pieces (part of the studio shell mesh): one hover box + one sweep box.
 * Each box = centre + half size (world), with a soft edge.
 */
export const uSpotHoverC = uniform(new Vector3(0, -99, 0));
export const uSpotHoverH = uniform(new Vector3(0.1, 0.1, 0.1));
export const uSpotHoverAmt = uniform(0);
export const uSpotSweepC = uniform(new Vector3(0, -99, 0));
export const uSpotSweepH = uniform(new Vector3(0.1, 0.1, 0.1));
export const uSpotSweepT = uniform(0);

let visible = false;
/** Show / hide the signs (fade). Replaces the old DOM hotspot dots toggle. */
export function setSignsVisible(on) {
  on = !!on;
  if (on === visible) return;
  visible = on;
  gsap.to(uSignsFade, {
    value: on ? 1 : 0,
    duration: on ? 0.9 : 0.35,
    delay: on ? 0.25 : 0,
    ease: on ? "power2.out" : "power1.in",
    overwrite: true,
  });
}
export const signsVisible = () => visible;

export function setGlowRack(type) {
  const id = RACK_IDS[type];
  if (id === undefined) {
    gsap.to(uGlowAmt, { value: 0, duration: 0.35, ease: "power1.out", overwrite: true });
    return;
  }
  if (uGlowRack.value !== id) uGlowAmt.value = 0;
  uGlowRack.value = id;
  gsap.to(uGlowAmt, { value: 1, duration: 0.45, ease: "power2.out", overwrite: true });
}

export function setHoverSign(index) {
  if (index >= 0) {
    if (uHoverSign.value !== index) uHoverAmt.value = 0;
    uHoverSign.value = index;
    gsap.to(uHoverAmt, { value: 1, duration: 0.35, ease: "power2.out", overwrite: true });
  } else {
    gsap.to(uHoverAmt, { value: 0, duration: 0.5, ease: "power2.out", overwrite: true });
  }
}

/** Hover glow on a table piece (`spot` from TABLE_SPOTS) or off (null). */
export function setSpotHover(spot) {
  if (!spot) {
    gsap.to(uSpotHoverAmt, { value: 0, duration: 0.35, ease: "power1.out", overwrite: true });
    return;
  }
  if (!uSpotHoverC.value.equals(spot.center)) uSpotHoverAmt.value = 0;
  uSpotHoverC.value.copy(spot.center);
  uSpotHoverH.value.copy(spot.half);
  gsap.to(uSpotHoverAmt, { value: 1, duration: 0.45, ease: "power2.out", overwrite: true });
}

/**
 * DOM hover chip ("Hoodies · 4 colours") next to the cursor. Only the rack /
 * sign / table piece that is hovered lives here; the chip positions itself on
 * pointermove.
 */
export const useRackHover = create(() => ({ label: null }));

/** Desktop / fine pointer only (no hover glow or chip on touch). */
export const finePointer = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
