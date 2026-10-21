"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useEnvironmentStore from "../../stores/environmentStore";
import { timeSettings } from "../../three/v2/uniforms";

/*
 * Scene clock (top right). Shows the time the scene is rendering — the
 * visitor's local time unless they've played with it.
 *   tap        → a 24 h dial in sky colours; drag the sun/moon around it
 *   hold       → easter egg: time fast-forwards while pressed
 *   "Play a day" runs a full day in 24 s, "Now" snaps back to live.
 */

const HOLD_MS = 350; // press longer than this = fast-forward instead of tap
const FF_HOURS_PER_SEC = 2.4;
const DAY_SECONDS = 24;

const fmt = (h) => {
  const m = Math.floor((h % 1) * 60);
  return `${String(Math.floor(h)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

function phase(h) {
  if (h < 5 || h >= 21.5) return { label: "Night", night: true };
  if (h < 7) return { label: "Sunrise", night: false };
  if (h < 11) return { label: "Morning", night: false };
  if (h < 15) return { label: "Midday", night: false };
  if (h < 18.75) return { label: "Afternoon", night: false };
  if (h < 20.25) return { label: "Golden hour", night: false };
  return { label: "Dusk", night: true };
}

// Sky colour per hour for the dial ring (conic gradient, 0 h at the top).
const RING = [
  [0, "#1d2747"], [4.5, "#2b3560"], [6, "#e7a3a8"], [7.5, "#f6d7a8"],
  [9, "#a9cdf0"], [13, "#8ec0f2"], [17, "#b7d3ee"], [19.2, "#f2b36b"],
  [20.3, "#d98aa7"], [21.2, "#6b5a9e"], [22.5, "#24305a"], [24, "#1d2747"],
];
const ringGradient = `conic-gradient(${RING.map(([h, c]) => `${c} ${(h / 24) * 360}deg`).join(", ")})`;

function SunMoon({ night, size = 14 }) {
  return night ? (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <path d="M11.5 10.6A5.5 5.5 0 0 1 5.4 4.5 5.5 5.5 0 1 0 11.5 10.6Z" fill="#f3ead2" stroke="#2b3560" strokeWidth="1" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="4.2" fill="#f6c45c" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1="8" y1="1.2" x2="8" y2="2.6" stroke="#f0a93a" strokeWidth="1.2" strokeLinecap="round" transform={`rotate(${a} 8 8)`} />
      ))}
    </svg>
  );
}

export default function TimeClock() {
  const mode = useEnvironmentStore((s) => s.mode);
  const timeOfDay = useEnvironmentStore((s) => s.timeOfDay);
  const setTimeOfDay = useEnvironmentStore((s) => s.setTimeOfDay);
  const setMode = useEnvironmentStore((s) => s.setMode);
  const syncLocalTime = useEnvironmentStore((s) => s.syncLocalTime);

  const [mounted, setMounted] = useState(false); // SSR has no local time
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ffwd, setFfwd] = useState(false);
  const holdTimer = useRef(null);
  const ffRaf = useRef(0);
  const dialRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    syncLocalTime();
  }, [syncLocalTime]);

  // Keep the chip ticking in live mode.
  useEffect(() => {
    if (mode !== "auto") return;
    const id = setInterval(syncLocalTime, 15_000);
    return () => clearInterval(id);
  }, [mode, syncLocalTime]);

  const stopPlay = useCallback(() => {
    timeSettings.timeLapse = false;
    setPlaying(false);
  }, []);

  useEffect(() => () => stopPlay(), [stopPlay]);

  // Close the popover on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // --- easter egg: hold the chip to fast-forward ------------------------------
  const startFastForward = () => {
    stopPlay();
    setFfwd(true);
    let last = performance.now();
    let h = useEnvironmentStore.getState().timeOfDay;
    const tick = (now) => {
      h += ((now - last) / 1000) * FF_HOURS_PER_SEC;
      last = now;
      setTimeOfDay(h);
      ffRaf.current = requestAnimationFrame(tick);
    };
    ffRaf.current = requestAnimationFrame(tick);
  };
  const onChipDown = () => {
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      startFastForward();
    }, HOLD_MS);
  };
  const onChipUp = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      setOpen((o) => !o); // it was a tap
    } else if (ffwd) {
      cancelAnimationFrame(ffRaf.current);
      setFfwd(false);
    }
  };
  const onChipCancel = () => {
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
    cancelAnimationFrame(ffRaf.current);
    setFfwd(false);
  };

  // --- dial drag ----------------------------------------------------------------
  const hoursFromPointer = (e) => {
    const r = dialRef.current.getBoundingClientRect();
    const a = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2)));
    return (((a / (Math.PI * 2)) * 24) + 24) % 24;
  };
  const onDialDown = (e) => {
    stopPlay();
    e.currentTarget.setPointerCapture(e.pointerId);
    setTimeOfDay(hoursFromPointer(e));
  };
  const onDialMove = (e) => {
    if (e.buttons) setTimeOfDay(hoursFromPointer(e));
  };

  const playDay = () => {
    if (playing) return stopPlay();
    timeSettings.timeLapseSeconds = DAY_SECONDS;
    timeSettings.timeLapse = true;
    setPlaying(true);
  };
  const goLive = () => {
    stopPlay();
    setMode("auto");
  };

  if (!mounted) return null;
  const { label, night } = phase(timeOfDay);
  const live = mode === "auto" && !playing;
  const angle = (timeOfDay / 24) * 360;

  return (
    <div ref={rootRef} className="wz-clock fixed z-wz-chrome !z-[35] wz-below-banner top-[calc(var(--wz-banner-h)+4.25rem)] left-4 items-start md:top-[calc(var(--wz-banner-h)+1rem)] md:left-auto md:right-4 md:items-end flex flex-col gap-2">
      <button
        type="button"
        aria-label={`Studio time: ${fmt(timeOfDay)}. Tap to change the time, hold to fast-forward.`}
        aria-expanded={open}
        onPointerDown={onChipDown}
        onPointerUp={onChipUp}
        onPointerLeave={onChipCancel}
        onContextMenu={(e) => e.preventDefault()}
        className={`flex items-center gap-2 h-10 pl-3 pr-3.5 rounded-full wz-glass-chip text-ink wz-focus select-none touch-none
          transition-transform duration-wz-fast ease-wz-out active:scale-[0.97] ${ffwd ? "scale-[1.04]" : ""}`}
      >
        <span className={`grid place-items-center ${ffwd ? "animate-spin [animation-duration:1.2s]" : ""}`}>
          <SunMoon night={night} />
        </span>
        <span className="text-xs font-semibold tabular-nums tracking-wide">{fmt(timeOfDay)}</span>
        {ffwd ? (
          <span className="text-[10px] font-semibold text-primary">⏩</span>
        ) : live ? (
          <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--wz-green))]" title="Live" />
        ) : null}
      </button>

      {open && (
        <div className="wz-glass rounded-wz-xl p-4 w-[232px] text-ink shadow-xl">
          <div className="flex items-baseline justify-between mb-3">
            <span className="wz-eyebrow !text-ink/60">Garden time</span>
            <span className="text-[11px] font-semibold text-ink-soft">{label}</span>
          </div>

          <div
            ref={dialRef}
            onPointerDown={onDialDown}
            onPointerMove={onDialMove}
            className="relative mx-auto w-[168px] h-[168px] rounded-full cursor-grab active:cursor-grabbing touch-none select-none"
            style={{ background: ringGradient }}
            role="slider"
            aria-label="Time of day"
            aria-valuemin={0}
            aria-valuemax={24}
            aria-valuenow={Math.round(timeOfDay * 10) / 10}
            aria-valuetext={fmt(timeOfDay)}
            tabIndex={0}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 1 : 0.25;
              if (e.key === "ArrowRight" || e.key === "ArrowUp") setTimeOfDay(timeOfDay + step);
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") setTimeOfDay(timeOfDay - step);
            }}
          >
            <div className="absolute inset-[18px] rounded-full bg-[rgb(var(--wz-paper))] grid place-items-center text-center shadow-inner">
              <div>
                <div className="wz-display text-[2rem] leading-none tabular-nums">{fmt(timeOfDay)}</div>
                <div className="mt-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-ink-soft">
                  {live ? "Live" : playing ? "A day in 24s" : "Drag the sun"}
                </div>
              </div>
            </div>
            {[0, 6, 12, 18].map((h) => (
              <span
                key={h}
                className="absolute left-1/2 top-1/2 text-[9px] font-semibold text-white/85 tabular-nums pointer-events-none"
                style={{ transform: `translate(-50%,-50%) rotate(${h * 15}deg) translateY(-75px) rotate(${-h * 15}deg)` }}
              >
                {String(h).padStart(2, "0")}
              </span>
            ))}
            <span
              className="absolute left-1/2 top-1/2 pointer-events-none"
              style={{ transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-75px) rotate(${-angle}deg)` }}
            >
              <span className="grid place-items-center w-7 h-7 rounded-full bg-white shadow-md ring-2 ring-white/70">
                <SunMoon night={night} size={18} />
              </span>
            </span>
          </div>

          <div className="flex gap-2 mt-4">
            <button type="button" onClick={playDay} className="flex-1 h-9 rounded-full wz-btn-primary !text-xs">
              {playing ? "Pause" : "Play a day"}
            </button>
            <button
              type="button"
              onClick={goLive}
              disabled={live}
              className="h-9 px-4 rounded-full text-xs font-semibold border border-ink/15 hover:bg-ink/5 disabled:opacity-40 wz-focus"
            >
              Now
            </button>
          </div>
          <p className="mt-3 text-[10px] leading-snug text-ink-soft text-center">
            Psst: hold the clock to fast-forward time.
          </p>
        </div>
      )}
    </div>
  );
}
