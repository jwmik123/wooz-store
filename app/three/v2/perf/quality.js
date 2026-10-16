import { create } from "zustand";

/*
 * Adaptive quality (workstream 7).
 *
 * Three tiers scale the knobs that dominate GPU time: pixel count (DPR cap),
 * grass density, shadow-map size / refresh rate and the post effects.
 *
 *   1. start tier: desktop "high", phones/tablets "medium" (or ?quality=low|medium|high)
 *   2. calibration (perf/QualityMonitor.jsx): once the studio is loaded, while the
 *      loader still covers the canvas, K frames are rendered back to back at the
 *      tier's DPR and timed until the GPU is idle → the highest tier whose
 *      predicted frame cost fits the budget is picked.
 *   3. runtime guard: if the frame time keeps missing the target (60 fps desktop,
 *      30 fps mobile), the DPR steps down inside the tier, then the tier drops.
 *      Never steps back up (no oscillation).
 */

export const TIERS = {
  high: { dpr: 1.75, grass: 1, shadowMapSize: 2048, shadowHz: 24, dof: true, bloom: true },
  medium: { dpr: 1.4, grass: 0.7, shadowMapSize: 1536, shadowHz: 15, dof: true, bloom: true },
  low: { dpr: 1, grass: 0.45, shadowMapSize: 1024, shadowHz: 10, dof: false, bloom: false },
};
export const TIER_ORDER = ["high", "medium", "low"];

/** Lowest DPR the runtime guard may reach inside a tier (fraction of its cap). */
export const DPR_FLOOR = 0.75;
/** DPR while the opaque loader covers the canvas (still compiles every pipeline). */
export const VEILED_DPR = 0.5;

export const isMobileDevice = () =>
  typeof navigator !== "undefined" &&
  (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));

function urlTier() {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("quality");
  return TIERS[q] ? q : null;
}

const deviceDpr = () => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);

/** Effective DPR cap for a tier on this device (phones never above 1.5). */
export function tierDpr(tier, mobile = isMobileDevice()) {
  const cap = TIERS[tier].dpr;
  return Math.min(deviceDpr(), mobile ? Math.min(cap, 1.5) : cap);
}

const forced = urlTier();
const startTier = forced ?? (isMobileDevice() ? "medium" : "high");

const useQualityStore = create((set, get) => ({
  tier: startTier,
  /** true when ?quality= pinned the tier (no calibration, no runtime guard). */
  forced: Boolean(forced),
  /** Current DPR (≤ the tier cap); the runtime guard lowers it first. */
  dpr: tierDpr(startTier),
  /** Opaque loader in front of the canvas → render at VEILED_DPR. */
  veiled: true,
  calibrated: Boolean(forced),
  /** Last calibration result, for the #debug overlay. */
  calibration: null,

  setVeiled: (veiled) => set({ veiled }),
  setTier: (tier) => set({ tier, dpr: tierDpr(tier) }),
  setDpr: (dpr) => set({ dpr }),
  setCalibrated: (calibration, tier) =>
    set({ calibrated: true, calibration, tier, dpr: tierDpr(tier) }),

  /** One step down: DPR inside the tier first, then the next tier. false at the bottom. */
  stepDown: () => {
    const { tier, dpr } = get();
    const floor = tierDpr(tier) * DPR_FLOOR;
    if (dpr > floor + 0.01) {
      set({ dpr: Math.max(floor, dpr * 0.88) });
      return true;
    }
    const next = TIER_ORDER[TIER_ORDER.indexOf(tier) + 1];
    if (!next) return false;
    set({ tier: next, dpr: tierDpr(next) });
    return true;
  },
}));

/** Settings of the current tier (React hook). */
export const useTierSettings = () => TIERS[useQualityStore((s) => s.tier)];

export default useQualityStore;
