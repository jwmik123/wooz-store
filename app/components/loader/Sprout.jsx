"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

/*
 * The loader illustration: a seed in a little hill grows into a flower whose
 * heart is the WOOZ smiley. Grass blades sprout along the hill from left to
 * right (that hill IS the progress bar). Pure inline SVG, driven imperatively
 * by `update(p)` (p = 0..1) from the loader's rAF loop — no React re-renders.
 */

const W = 240;
const BASE = { x: 120, y: 250 };
// Hill: cubic from (8,252) via (60,238) (180,238) to (232,252).
const HILL = [
  [8, 252],
  [60, 238],
  [180, 238],
  [232, 252],
];
const hillAt = (t) => {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [0, 1].map((a) => HILL.reduce((s, p, i) => s + p[a] * k[i], 0));
};

// Blades left → right, leaving room for the stem.
const BLADES = Array.from({ length: 22 }, (_, i) => {
  const t = 0.04 + (i / 21) * 0.92;
  const [x, y] = hillAt(t);
  const h = 11 + ((i * 7) % 5) * 2.8;
  const lean = (i % 2 ? 1 : -1) * (1.5 + (i % 3));
  return { x, y: y + 1, h, lean, at: 0.03 + t * 0.9, tone: i % 3 };
}).filter((b) => Math.abs(b.x - BASE.x) > 12);

const PETALS = ["#F4C3C1", "#F5DD92", "#CFC1F1", "#AED0EC", "#B7DFC4", "#F4C3C1", "#F5DD92"];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (p, a, b) => clamp01((p - a) / (b - a));
const backOut = (t) => {
  const s = 1.7;
  const u = t - 1;
  return t <= 0 ? 0 : 1 + (s + 1) * u * u * u + s * u * u;
};
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);

const Sprout = forwardRef(function Sprout(_, ref) {
  const r = useRef({});
  const set = (key) => (el) => (r.current[key] = el);

  useImperativeHandle(ref, () => ({
    update(p) {
      const e = r.current;
      if (!e.stem) return;
      e.hill.style.strokeDashoffset = 1.02 * (1 - easeOut(span(p, 0, 0.12)));
      e.seed.setAttribute("transform", `translate(${BASE.x} ${BASE.y}) scale(${1 - 0.6 * span(p, 0.1, 0.2)})`);
      BLADES.forEach((b, i) => {
        const g = backOut(span(p, b.at, b.at + 0.07));
        e[`blade${i}`]?.setAttribute("transform", `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) scale(${(0.6 + 0.4 * g).toFixed(3)} ${g.toFixed(3)})`);
      });
      e.stem.style.strokeDashoffset = 1.02 * (1 - easeOut(span(p, 0.08, 0.55)));
      e.leafL.setAttribute("transform", `translate(119 216) rotate(-38) scale(${backOut(span(p, 0.2, 0.38)).toFixed(3)})`);
      e.leafR.setAttribute("transform", `translate(121 184) rotate(40) scale(${backOut(span(p, 0.36, 0.54)).toFixed(3)})`);
      const bud = backOut(span(p, 0.5, 0.64));
      const open = span(p, 0.64, 0.96);
      e.bud.setAttribute("transform", `translate(120 120) scale(${(bud * (1 - 0.5 * open)).toFixed(3)})`);
      PETALS.forEach((_, i) => {
        const a = (i * 360) / PETALS.length;
        const s = backOut(span(p, 0.64 + i * 0.035, 0.8 + i * 0.035));
        e[`petal${i}`]?.setAttribute("transform", `rotate(${(a + 30 * (1 - s)).toFixed(2)}) scale(${s.toFixed(3)})`);
      });
      e.face.setAttribute("transform", `translate(120 120) scale(${backOut(span(p, 0.8, 0.92)).toFixed(3)})`);
      e.smile.style.strokeDashoffset = 1.02 * (1 - easeOut(span(p, 0.9, 1)));
    },
    /** A little wink when the flower is done. */
    wink() {
      const eye = r.current.eyeR;
      if (!eye) return;
      eye.animate(
        [{ transform: "scaleY(1)" }, { transform: "scaleY(0.1)" }, { transform: "scaleY(1)" }],
        { duration: 260, easing: "ease-in-out" }
      );
    },
  }));

  return (
    <svg
      viewBox={`0 72 ${W} 194`}
      className="wz-sprout"
      aria-hidden
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g className="wz-sprout-grass">
        {BLADES.map((b, i) => (
          <g key={i} ref={set(`blade${i}`)} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) scale(0.6 0)`}>
            <path
              className="wz-sprout-blade"
              data-tone={b.tone}
              style={{ animationDelay: `${(-i * 0.37).toFixed(2)}s` }}
              d={`M0 0 Q ${(b.lean * 0.4).toFixed(1)} ${(-b.h * 0.55).toFixed(1)} ${b.lean.toFixed(1)} ${(-b.h).toFixed(1)}`}
            />
          </g>
        ))}
      </g>
      <path
        ref={set("hill")}
        className="wz-sprout-line"
        pathLength={1}
        strokeDasharray="1 1.1"
        strokeDashoffset={1.02}
        d={`M${HILL[0]} C${HILL[1]} ${HILL[2]} ${HILL[3]}`}
      />
      <ellipse ref={set("seed")} className="wz-sprout-seed" rx="5" ry="3.4" transform={`translate(${BASE.x} ${BASE.y})`} />

      <g className="wz-sprout-sway">
        <path
          ref={set("stem")}
          className="wz-sprout-line wz-sprout-stem"
          pathLength={1}
          strokeDasharray="1 1.1"
          strokeDashoffset={1.02}
          d="M120 250 C 116 226, 125 204, 120 180 S 117 142, 120 124"
        />
        <g ref={set("leafL")} transform="translate(119 216) rotate(-38) scale(0)">
          <path className="wz-sprout-leaf" d="M0 0 C -9 -9, -8 -25, 0 -32 C 8 -25, 9 -9, 0 0 Z" />
          <path className="wz-sprout-vein" d="M0 -3 L0 -25" />
        </g>
        <g ref={set("leafR")} transform="translate(121 184) rotate(40) scale(0)">
          <path className="wz-sprout-leaf" d="M0 0 C -8 -8, -7 -22, 0 -28 C 7 -22, 8 -8, 0 0 Z" />
          <path className="wz-sprout-vein" d="M0 -3 L0 -21" />
        </g>
        <g ref={set("bud")} transform="translate(120 120) scale(0)">
          <path className="wz-sprout-leaf" d="M0 8 C -10 4, -9 -8, 0 -12 C 9 -8, 10 4, 0 8 Z" />
        </g>
        <g transform="translate(120 120)">
          {PETALS.map((c, i) => (
            <g key={i} ref={set(`petal${i}`)} transform="scale(0)">
              <ellipse className="wz-sprout-petal" cx="0" cy="-19" rx="9" ry="14" fill={c} />
            </g>
          ))}
        </g>
        <g ref={set("face")} transform="translate(120 120) scale(0)">
          <circle className="wz-sprout-face" r="13" />
          <circle className="wz-sprout-eye" cx="-4.6" cy="-3" r="1.9" />
          <circle ref={set("eyeR")} className="wz-sprout-eye wz-sprout-wink" cx="4.6" cy="-3" r="1.9" />
          <path
            ref={set("smile")}
            className="wz-sprout-smile"
            pathLength={1}
            strokeDasharray="1 1.1"
            strokeDashoffset={1.02}
            d="M-6.4 2.6 Q0 9.4 6.4 2.6"
          />
        </g>
      </g>
    </svg>
  );
});

export default Sprout;
