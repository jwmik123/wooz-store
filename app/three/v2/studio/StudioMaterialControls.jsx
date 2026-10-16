"use client";

import { useEffect } from "react";
import { Color } from "three/webgpu";
import { useThree } from "@react-three/fiber";
import { folder, useControls } from "leva";
import { applyStudioFinish } from "../Studio";
import {
  DEFAULT_PRESET,
  FINISH_PRESETS,
  FLOOR_TONE,
  applyPresetColours,
  finishUniforms as U,
} from "./wallFinish";

const toLinear = (hex) => new Color().setStyle(hex, "srgb");
const VIEWS = { final: 0, masks: 1 };

/**
 * #debug-only leva folder "Studio materials": pick a wall finish preset, tune
 * colours + strengths, or show the surface masks (R plaster, G timber, B floor).
 * Uniform edits are live; preset / view rebuild the shell material's graph.
 */
export default function StudioMaterialControls({ material, baseline }) {
  const scene = useThree((s) => s.scene);
  const rebuild = (patch) => applyStudioFinish(material, { ...material.userData.finish, ...patch });

  const [, set] = useControls(() => ({
    "Studio materials": folder(
      {
        preset: {
          value: material.userData.finish?.preset ?? DEFAULT_PRESET,
          options: Object.keys(FINISH_PRESETS),
          onChange: (v, _, { initial }) => {
            if (initial) return;
            const p = applyPresetColours(v);
            set({
              wall: p.wallA,
              mottle: p.wallB,
              lowerBand: p.lower,
              accentWall: p.accent,
              trim: p.trim,
              timber: p.timber,
              brick: p.brick,
              texture: p.texture,
              bump: p.bump,
            });
            rebuild({ preset: v });
          },
        },
        view: {
          value: "final",
          options: Object.keys(VIEWS),
          onChange: (v, _, { initial }) => !initial && rebuild({ view: VIEWS[v] }),
        },
        amount: {
          value: U.amount.value,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (v) => (U.amount.value = v),
        },
        texture: {
          value: U.texture.value,
          min: 0,
          max: 2,
          step: 0.01,
          onChange: (v) => (U.texture.value = v),
        },
        bump: {
          value: U.bump.value,
          min: 0,
          max: 4,
          step: 0.01,
          onChange: (v) => (U.bump.value = v),
        },
        wall: {
          value: FINISH_PRESETS[DEFAULT_PRESET].wallA,
          onChange: (v) => U.wallA.value.copy(toLinear(v)),
        },
        mottle: {
          value: FINISH_PRESETS[DEFAULT_PRESET].wallB,
          onChange: (v) => U.wallB.value.copy(toLinear(v)),
        },
        lowerBand: {
          value: FINISH_PRESETS[DEFAULT_PRESET].lower,
          onChange: (v) => U.lower.value.copy(toLinear(v)),
        },
        accentWall: {
          value: FINISH_PRESETS[DEFAULT_PRESET].accent,
          onChange: (v) => U.accent.value.copy(toLinear(v)),
        },
        bandHeight: {
          value: U.bandHeight.value,
          min: 0.3,
          max: 1.6,
          step: 0.01,
          onChange: (v) => (U.bandHeight.value = v),
        },
        trim: {
          value: FINISH_PRESETS[DEFAULT_PRESET].trim,
          onChange: (v) => U.trim.value.copy(toLinear(v)),
        },
        timber: {
          value: FINISH_PRESETS[DEFAULT_PRESET].timber,
          onChange: (v) => U.timber.value.copy(toLinear(v)),
        },
        brick: {
          value: FINISH_PRESETS[DEFAULT_PRESET].brick,
          onChange: (v) => U.brick.value.copy(toLinear(v)),
        },
        floor: {
          value: U.floorAmount.value,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (v) => (U.floorAmount.value = v),
        },
        floorTone: { value: FLOOR_TONE, onChange: (v) => U.floorTone.value.copy(toLinear(v)) },
      },
      { collapsed: true },
    ),
  }));

  // Console hook for scripted A/B screenshots + perf: __studioFinish.set({ preset: "…" }),
  // __studioFinish.useBaseline(true) renders the shell with the plain baked material.
  useEffect(() => {
    const useBaseline = (on) => {
      const shell = scene.getObjectByName("studio");
      if (shell) shell.material = on ? baseline : material;
    };
    window.__studioFinish = { material, uniforms: U, set, rebuild, useBaseline };
    return () => delete window.__studioFinish;
  });

  return null;
}
