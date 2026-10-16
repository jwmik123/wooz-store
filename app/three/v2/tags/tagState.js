import { uniform } from "three/tsl";
import gsap from "gsap";
import { create } from "zustand";

/*
 * Shared state for the in-world garment tags (Tags.jsx) and the rack hover
 * glow / idle light sweep in the cloth material (wind/clothWind.js).
 * Uniforms are only written from event handlers / tweens, never per frame
 * from React.
 */

/** 0 = tags hidden (faded out), 1 = shown. Tweened by setTagsVisible. */
export const uTagsFade = uniform(0);
/** Index of the hovered tag (-1 = none) + its eased hover amount. */
export const uHoverTag = uniform(-1);
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

let visible = false;
/** Show / hide the tags (fade). Replaces the old DOM hotspot dots toggle. */
export function setTagsVisible(on) {
  on = !!on;
  if (on === visible) return;
  visible = on;
  gsap.to(uTagsFade, {
    value: on ? 1 : 0,
    duration: on ? 0.9 : 0.35,
    delay: on ? 0.25 : 0,
    ease: on ? "power2.out" : "power1.in",
    overwrite: true,
  });
}
export const tagsVisible = () => visible;

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

export function setHoverTag(index) {
  if (index >= 0) {
    if (uHoverTag.value !== index) uHoverAmt.value = 0;
    uHoverTag.value = index;
    gsap.to(uHoverAmt, { value: 1, duration: 0.5, ease: "back.out(1.6)", overwrite: true });
  } else {
    gsap.to(uHoverAmt, { value: 0, duration: 0.6, ease: "power2.out", overwrite: true });
  }
}

/**
 * DOM hover chip ("Hoodies · 4 colours") next to the cursor. Only the rack/tag
 * that is hovered lives here; the chip positions itself on pointermove.
 */
export const useRackHover = create(() => ({ label: null }));

/** Desktop / fine pointer only (no hover glow or chip on touch). */
export const finePointer = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
