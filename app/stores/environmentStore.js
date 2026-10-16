import { create } from "zustand";

/** Visitor's local time as fractional hours, 0..24. */
export function getLocalHours(date = new Date()) {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

const wrapHours = (h) => ((h % 24) + 24) % 24;

/**
 * Environment state shared by all v2 features (lighting, clouds, wind, ...).
 *
 * - mode "auto":   timeOfDay follows the visitor's local clock.
 * - mode "manual": timeOfDay is overridden (debug slider, cinematic, ...).
 *
 * Per-frame values live in TSL uniforms (app/three/v2/uniforms.js), which are
 * driven from this store in one place. Read the uniforms in shaders; use this
 * store for React/UI and to change values.
 */
const useEnvironmentStore = create((set, get) => ({
  mode: "auto",
  timeOfDay: typeof window === "undefined" ? 12 : getLocalHours(),

  // Wind, world space. Direction is normalized by the uniform updater (y ignored).
  windDirection: [1, 0, 0.35],
  windStrength: 0.4,

  setMode: (mode) =>
    set(mode === "auto" ? { mode, timeOfDay: getLocalHours() } : { mode }),

  /** Override the time of day (switches to manual mode). */
  setTimeOfDay: (hours) => set({ timeOfDay: wrapHours(hours), mode: "manual" }),

  /** Re-sync timeOfDay with the local clock (no-op in manual mode). */
  syncLocalTime: () => {
    if (get().mode === "auto") set({ timeOfDay: getLocalHours() });
  },

  setWind: ({ direction, strength }) =>
    set((s) => ({
      windDirection: direction ?? s.windDirection,
      windStrength: strength ?? s.windStrength,
    })),
}));

export default useEnvironmentStore;
