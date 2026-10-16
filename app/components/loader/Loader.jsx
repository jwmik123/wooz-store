"use client";

import "./loader.css";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { InfoIcon } from "lucide-react";
import useLoadingStore, { rawProgress } from "./loadingStore";
import { installFetchTracker, uninstallFetchTracker } from "./fetchTracker";
import { SKY_SCRIPT } from "./skyPalette";
import Sprout from "./Sprout";
import IntroScreen from "../ui/IntroScreen";
import collectionStore from "../../stores/collectionStore";
import useCameraStore, { INTRO_MOVES } from "../../stores/cameraStore";
import useSoundStore from "../../stores/soundStore";
import { focusPull } from "../../three/v2/post/focusOverride";
import { EASE, prefersReducedMotion } from "../ui/tokens";

/*
 * Loading → reveal → intro → enter, as one piece of choreography.
 *
 *   loading  the visitor's own sky (time of day, skyPalette.js) with a seed that
 *            grows into the WOOZ-smiley flower as real progress comes in
 *            (loadingStore.js: bytes → compile → calibration → steady frames).
 *            Rendered on the server, so it paints before any JS runs.
 *   reveal   the flower winks and sinks away, the sky curtain lifts like mist
 *            off the real (identical) sky while the camera cranes down onto the
 *            garden and the depth of field racks from soft to sharp. The title
 *            rises letter by letter, then the copy and the buttons.
 *   enter    "Step inside": the title lifts out, one camera move down the garden
 *            path through the open front (cameraStore INTRO_MOVES.enter), the
 *            floating UI drifts in as it lands, then a short hint.
 *   reduced motion: plain cross-fades, the camera cuts.
 */

if (typeof window !== "undefined") installFetchTracker();

const LABELS = {
  boot: "Unlocking the gate",
  assets: "Planting the garden",
  compile: "Watering the flowers",
  calibrate: "Polishing the glass",
  settle: "Letting it bloom",
};

const CLOUDS = [
  { top: "9%", left: "6%", w: "34vw", h: "11vw", dur: "46s", delay: "-8s" },
  { top: "18%", left: "58%", w: "28vw", h: "9vw", dur: "38s", delay: "-21s" },
  { top: "4%", left: "38%", w: "18vw", h: "6vw", dur: "52s", delay: "-30s" },
];
const STARS = Array.from({ length: 26 }, (_, i) => ({
  top: `${(i * 37) % 55}%`,
  left: `${(i * 61 + 7) % 100}%`,
  delay: `${-((i * 0.53) % 3.6).toFixed(2)}s`,
}));

const setHtmlStage = (stage) => {
  document.documentElement.dataset.wzStage = stage;
};

export default function Loader() {
  const rootRef = useRef(null);
  const skyRef = useRef(null);
  const stageRef = useRef(null);
  const sproutRef = useRef(null);
  const numRef = useRef(null);
  const labelRef = useRef(null);
  const welcomeRef = useRef(null);
  const timeline = useRef(null);

  const [stage, setStage] = useState("loading");
  const [interactive, setInteractive] = useState(false);
  const [hint, setHint] = useState(false);

  const q = (sel) => welcomeRef.current?.querySelectorAll(sel) ?? [];

  const goStage = useCallback((s) => {
    setStage(s);
    useLoadingStore.getState().setStage(s);
  }, []);

  // ── Reveal: loader → intro shot ──────────────────────────────────────────
  const startReveal = useCallback(() => {
    const reduce = prefersReducedMotion();
    goStage("reveal");
    setHtmlStage("intro");
    rootRef.current.dataset.done = "";
    const camera = useCameraStore.getState();
    const welcome = welcomeRef.current;
    const chars = q(".wz-welcome-char");
    const tl = gsap.timeline({ onComplete: () => goStage("intro") });
    timeline.current = tl;

    if (reduce) {
      camera.playIntroReveal({ instant: true });
      tl.to(rootRef.current, { autoAlpha: 0, duration: 0.6, ease: "none" }, 0.1)
        .set(welcome, { visibility: "visible" }, 0.1)
        .fromTo(welcome, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.3)
        .call(() => setInteractive(true), null, 0.5);
      return;
    }

    sproutRef.current?.wink();
    tl.to(stageRef.current, { y: -18, scale: 0.97, opacity: 0, duration: 0.8, ease: "power2.in" }, 0.3)
      .call(() => camera.playIntroReveal(), null, 0.55)
      .fromTo(focusPull, { amount: 1 }, { amount: 0, duration: 3.4, ease: "power2.inOut" }, 0.55)
      .to(skyRef.current, { yPercent: -30, opacity: 0, duration: 2.6, ease: "power2.inOut" }, 0.6)
      .set(welcome, { visibility: "visible" }, 1.4)
      .fromTo(q("[data-intro=eyebrow]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1, ease: EASE.out }, 1.6)
      .fromTo(chars, { yPercent: 115 }, { yPercent: 0, duration: 1.5, ease: "expo.out", stagger: 0.045 }, 1.7)
      .fromTo(q("[data-intro=copy]"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.1, ease: EASE.out }, 2.4)
      .fromTo(q("[data-intro=actions]"), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.1, ease: EASE.out }, 2.7)
      .call(() => setInteractive(true), null, 2.8);
  }, [goStage]);

  // ── Progress loop (monotonic, eased; real signals from loadingStore) ─────
  useEffect(() => {
    setHtmlStage("loading");
    if (process.env.NODE_ENV === "development") {
      // Dev: ?slowmo=4 plays the choreography 4× slower (for reviewing frames).
      const slowmo = parseFloat(new URLSearchParams(window.location.search).get("slowmo"));
      if (slowmo > 0) gsap.globalTimeline.timeScale(1 / slowmo);
      // Main-thread long tasks per loading phase (does the loader stay fluid?).
      window.__wzLoading = useLoadingStore;
      window.__wzLongTasks = [];
      try {
        new PerformanceObserver((list) => {
          const { phase, stage } = useLoadingStore.getState();
          for (const e of list.getEntries())
            window.__wzLongTasks.push({ phase: stage === "loading" ? phase : stage, ms: Math.round(e.duration), at: Math.round(e.startTime) });
        }).observe({ type: "longtask" });
      } catch {
        /* unsupported */
      }
    }
    let raf;
    let last = performance.now();
    let shown = 0;
    let phase = null;
    const tick = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const s = useLoadingStore.getState();
      const target = rawProgress(s, t);
      let next = shown + (target - shown) * (1 - Math.exp(-dt * 2.5));
      // Speed cap (the flower always gets time to grow), and once everything is
      // ready a gentle minimum pace so the last percent eases in instead of stalling.
      next = Math.min(next, shown + dt * (s.ready ? 1.1 : 0.5));
      if (s.ready) next = Math.max(next, shown + dt * 0.25);
      shown = Math.min(1, Math.max(shown, next));

      sproutRef.current?.update(shown);
      if (numRef.current) numRef.current.textContent = `${Math.floor(shown * 100)}%`;
      if (s.phase !== phase && labelRef.current) {
        phase = s.phase;
        labelRef.current.textContent = LABELS[phase];
      }
      if (shown >= 1) {
        startReveal();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      timeline.current?.kill();
    };
  }, [startReveal]);

  // ── Enter: intro shot → studio overview ───────────────────────────────────
  const finishInside = useCallback(() => {
    setHtmlStage("inside");
    goStage("inside");
    uninstallFetchTracker();
    setTimeout(() => setHint(true), 500);
    setTimeout(() => setHint(false), 6500);
  }, [goStage]);

  const handleStart = useCallback(
    (withSound) => {
      if (!interactive) return;
      setInteractive(false);
      timeline.current?.kill();
      // The click is the user gesture that lets the ambient bed start.
      useSoundStore.getState().setSoundEnabled(withSound);
      goStage("enter");
      const camera = useCameraStore.getState();
      const welcome = welcomeRef.current;
      const tl = gsap.timeline();
      timeline.current = tl;

      if (prefersReducedMotion()) {
        tl.set(stageRef.current, { opacity: 0 })
          .set(skyRef.current, { yPercent: 0 })
          .to(rootRef.current, { autoAlpha: 1, duration: 0.35, ease: "none" }, 0)
          .to(skyRef.current, { opacity: 1, duration: 0.35, ease: "none" }, 0)
          .to(welcome, { autoAlpha: 0, duration: 0.3 }, 0)
          .call(() => {
            camera.playEnter({ instant: true });
            collectionStore.getState().setIntroScreen(false);
          })
          .to(rootRef.current, { autoAlpha: 0, duration: 0.5, ease: "none" }, "+=0.15")
          .call(finishInside);
        return;
      }

      const D = INTRO_MOVES.enter.duration;
      const START = 0.2;
      tl.to(q("[data-intro=actions]"), { opacity: 0, y: 14, duration: 0.45, ease: "power2.in" }, 0)
        .to(q("[data-intro=copy]"), { opacity: 0, y: -8, duration: 0.45, ease: "power2.in" }, 0.05)
        .to(q(".wz-welcome-char"), { yPercent: -115, duration: 0.65, ease: "power3.in", stagger: 0.025 }, 0.05)
        .to(q("[data-intro=eyebrow]"), { opacity: 0, y: -8, duration: 0.4, ease: "power2.in" }, 0.1)
        .set(welcome, { visibility: "hidden" }, 0.95)
        .call(() => camera.playEnter(), null, START)
        // Moos waves and the hotspots fade in as the camera crosses the threshold.
        .call(() => collectionStore.getState().setIntroScreen(false), null, START + D * 0.8)
        .call(finishInside, null, START + D * 0.92);
    },
    [interactive, goStage, finishInside]
  );

  const inside = stage === "inside";

  return (
    <>
      {!inside && (
        <div ref={rootRef} className="wz-loader" suppressHydrationWarning role="status" aria-live="polite">
          {/* Paints the visitor's sky before hydration (no flash of a wrong colour). */}
          <script dangerouslySetInnerHTML={{ __html: SKY_SCRIPT }} />
          <div ref={skyRef} className="wz-loader-sky">
            {STARS.map((s, i) => (
              <span key={i} className="wz-loader-star" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
            ))}
            {CLOUDS.map((c, i) => (
              <span
                key={i}
                className="wz-loader-cloud"
                style={{ top: c.top, left: c.left, width: c.w, height: c.h, animationDuration: c.dur, animationDelay: c.delay }}
              />
            ))}
          </div>
          <div ref={stageRef} className="wz-loader-stage">
            <span className="wz-eyebrow wz-loader-brand">Wooz Studio</span>
            <Sprout ref={sproutRef} />
            <div className="wz-loader-caption wz-eyebrow">
              <span ref={labelRef} className="wz-loader-label">
                {LABELS.boot}
              </span>
              <span className="wz-loader-dot" aria-hidden />
              <span ref={numRef} className="wz-loader-num">
                0%
              </span>
            </div>
            <span className="wz-eyebrow wz-loader-foot !tracking-[0.18em]">
              Best with sound on
            </span>
          </div>
        </div>
      )}

      {!inside && <IntroScreen ref={welcomeRef} onStart={handleStart} interactive={interactive} />}

      <div
        className={`fixed z-wz-overlay bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-2 text-xs rounded-full wz-glass-chip text-ink pointer-events-none transition-[opacity,transform] duration-700 ease-wz-out ${
          hint ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
        aria-hidden={!hint}
      >
        <InfoIcon className="w-4 h-4" strokeWidth={1.75} />
        <span className="whitespace-nowrap">Tap the pulsing dots to explore</span>
      </div>
    </>
  );
}
