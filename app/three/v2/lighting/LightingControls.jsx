"use client";

import { useThree } from "@react-three/fiber";
import { folder, useControls } from "leva";
import { ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping } from "three/webgpu";
import { ATMOSPHERE_SETTINGS, SUN_MODEL } from "./atmosphere";
import { lightSettings, requestShadowUpdate, shadowSettings } from "./Lights";
import { timeSettings } from "../uniforms";

const TONE_MAPPINGS = {
  Neutral: NeutralToneMapping,
  AgX: AgXToneMapping,
  ACES: ACESFilmicToneMapping,
};

const bind = (obj, key, opts = {}, after) => ({
  value: obj[key],
  ...opts,
  onChange: (v) => {
    obj[key] = v;
    after?.(v);
  },
});

/**
 * Lighting tunables, merged into the existing leva "Environment" folder
 * (only mounted behind #debug). Values write straight into the plain settings
 * objects the frame loop reads, so there are no React re-renders.
 */
export default function LightingControls() {
  const gl = useThree((s) => s.gl);

  useControls("Environment", {
    timeLapse: bind(timeSettings, "timeLapse", { label: "time lapse" }),
    timeLapseSeconds: bind(timeSettings, "timeLapseSeconds", { min: 10, max: 600, step: 5, label: "lapse s/day" }),
    Lighting: folder(
      {
        toneMapping: {
          value: "Neutral",
          options: Object.keys(TONE_MAPPINGS),
          onChange: (v) => {
            gl.toneMapping = TONE_MAPPINGS[v];
          },
        },
        exposureDay: bind(ATMOSPHERE_SETTINGS, "exposureDay", { min: 0.2, max: 3, step: 0.01 }),
        exposureNight: bind(ATMOSPHERE_SETTINGS, "exposureNight", { min: 0.2, max: 4, step: 0.01 }),
        sunIntensity: bind(ATMOSPHERE_SETTINGS, "sunIntensity", { min: 0, max: 3, step: 0.01 }),
        moonIntensity: bind(ATMOSPHERE_SETTINGS, "moonIntensity", { min: 0, max: 3, step: 0.01 }),
        ambient: bind(ATMOSPHERE_SETTINGS, "ambientIntensity", { min: 0, max: 3, step: 0.01 }),
        bounce: bind(ATMOSPHERE_SETTINGS, "bounce", { min: 0, max: 2, step: 0.01 }),
        skyFill: bind(ATMOSPHERE_SETTINGS, "skyFill", { min: 0, max: 4, step: 0.01, label: "GI sky" }),
        skyTint: bind(ATMOSPHERE_SETTINGS, "skyTint", { min: 0, max: 1, step: 0.01, label: "GI sky tint" }),
        sunBounce: bind(ATMOSPHERE_SETTINGS, "sunBounce", { min: 0, max: 4, step: 0.01, label: "GI sun bounce" }),
        lampFill: bind(ATMOSPHERE_SETTINGS, "lampFill", { min: 0, max: 8, step: 0.05, label: "GI lamps" }),
        tableLamp: bind(lightSettings, "tableLamp", { min: 0, max: 10, step: 0.05 }),
        rackLights: bind(lightSettings, "rackLights", { min: 0, max: 10, step: 0.05 }),
        shadowRadius: bind(shadowSettings, "radius", { min: 0, max: 10, step: 0.1 }, requestShadowUpdate),
        shadowBias: bind(shadowSettings, "bias", { min: -0.005, max: 0.005, step: 0.0001 }, requestShadowUpdate),
        normalBias: bind(shadowSettings, "normalBias", { min: 0, max: 0.1, step: 0.001 }, requestShadowUpdate),
        shadowRefreshHz: bind(shadowSettings, "refreshHz", { min: 0, max: 60, step: 1 }),
        scrubSmoothing: bind(timeSettings, "smoothing", { min: 0.2, max: 20, step: 0.1 }),
        sunrise: bind(SUN_MODEL, "sunrise", { min: 3, max: 10, step: 0.05 }),
        sunset: bind(SUN_MODEL, "sunset", { min: 15, max: 23, step: 0.05 }),
        maxElevation: bind(SUN_MODEL, "maxElevation", { min: 10, max: 85, step: 1 }),
        arcTilt: bind(SUN_MODEL, "arcTilt", { min: -45, max: 60, step: 1 }),
        azimuthOffset: bind(SUN_MODEL, "azimuthOffset", { min: -180, max: 180, step: 1, label: "azimuth°" }),
      },
      { collapsed: true }
    ),
  });

  return null;
}
