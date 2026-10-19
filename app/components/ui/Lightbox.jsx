"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import gsap from "gsap";
import { X } from "lucide-react";
import { EASE, prefersReducedMotion } from "./tokens";

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DISMISS_DISTANCE = 110;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Fullscreen photo viewer (touch). Grows out of the product stage, swipes
 * between photos, pinch / double-tap to zoom, drag down to close.
 *
 * `getOriginRect()` returns the on-page frame the viewer opens from and
 * collapses back into, so the morph lands wherever the stage currently is.
 */
export default function Lightbox({ images, index, onIndexChange, onClose, getOriginRect, alt }) {
  const rootRef = useRef(null);
  const backdropRef = useRef(null);
  const stageRef = useRef(null);
  const chromeRef = useRef(null);
  const trackRef = useRef(null);
  const closeRef = useRef(null);
  const slideRefs = useRef([]);
  const closing = useRef(false);

  // Zoom/pan of the active slide, written straight to the DOM during gestures.
  const view = useRef({ s: 1, x: 0, y: 0 });
  const [zoomed, setZoomed] = useState(false);
  const gesture = useRef({ pointers: new Map(), lastTap: 0 });

  const activeEl = () => slideRefs.current[index];

  const applyView = useCallback(
    (animate) => {
      const el = slideRefs.current[index];
      if (!el) return;
      const { s, x, y } = view.current;
      if (animate) gsap.to(el, { x, y, scale: s, duration: 0.45, ease: EASE.out, overwrite: true });
      else gsap.set(el, { x, y, scale: s, overwrite: true });
      setZoomed(s > 1.01);
    },
    [index]
  );

  // Keep the pan inside the rendered (object-contain) image.
  const clampView = (s, x, y) => {
    const el = activeEl();
    if (!el) return { s, x, y };
    const img = images[index];
    const W = el.clientWidth;
    const H = el.clientHeight;
    const fit = img?.width && img?.height ? Math.min(W / img.width, H / img.height) : 1;
    const rw = img?.width ? img.width * fit : W;
    const rh = img?.height ? img.height * fit : H;
    const mx = Math.max(0, (rw * s - W) / 2);
    const my = Math.max(0, (rh * s - H) / 2);
    return { s, x: clamp(x, -mx, mx), y: clamp(y, -my, my) };
  };

  // Zoom to scale s1 keeping screen point (cx, cy) — relative to the slide centre — fixed.
  const zoomAt = (s1, cx, cy) => {
    const { s, x, y } = view.current;
    const qx = (cx - x) / s;
    const qy = (cy - y) / s;
    return clampView(s1, cx - qx * s1, cy - qy * s1);
  };

  const resetView = (animate = true) => {
    view.current = { s: 1, x: 0, y: 0 };
    applyView(animate);
  };

  /* ── open / close choreography ── */

  const morphFrom = () => {
    const r = getOriginRect?.();
    if (!r || !r.width) return { x: 0, y: 0, scale: 0.9 };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: r.left + r.width / 2 - vw / 2,
      y: r.top + r.height / 2 - vh / 2,
      scale: Math.min(r.width / vw, r.height / vh),
    };
  };

  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    const from = morphFrom();
    gsap.fromTo(backdropRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: reduce ? 0.15 : 0.45, ease: EASE.out });
    gsap.fromTo(
      chromeRef.current,
      { autoAlpha: 0, y: -8 },
      { autoAlpha: 1, y: 0, duration: 0.4, ease: EASE.out, delay: reduce ? 0 : 0.2 }
    );
    if (reduce) gsap.fromTo(stageRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 });
    else
      gsap.fromTo(
        stageRef.current,
        { ...from, autoAlpha: 0.4 },
        { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: 0.6, ease: EASE.out }
      );
    // Land on the photo that was tapped before the first paint.
    const track = trackRef.current;
    if (track) track.scrollLeft = index * track.clientWidth;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevFocus = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const reduce = prefersReducedMotion();
    const to = morphFrom();
    gsap.to(chromeRef.current, { autoAlpha: 0, duration: 0.2 });
    gsap.to(backdropRef.current, { autoAlpha: 0, duration: reduce ? 0.15 : 0.4, ease: EASE.inOut });
    gsap.to(stageRef.current, {
      ...(reduce ? {} : to),
      autoAlpha: 0,
      duration: reduce ? 0.15 : 0.45,
      ease: EASE.inOut,
      onComplete: onClose,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // Keys: capture phase so the shop's own arrow/Escape shortcuts stay quiet.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const next = clamp(index + (e.key === "ArrowRight" ? 1 : -1), 0, images.length - 1);
        trackRef.current?.scrollTo({ left: next * trackRef.current.clientWidth, behavior: "smooth" });
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, index, images.length]);

  // A new slide always starts unzoomed.
  useEffect(() => {
    view.current = { s: 1, x: 0, y: 0 };
    setZoomed(false);
    slideRefs.current.forEach((el) => el && gsap.set(el, { x: 0, y: 0, scale: 1 }));
  }, [index]);

  const onTrackScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const i = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
    if (i !== index && i >= 0 && i < images.length) onIndexChange(i);
  };

  /* ── gestures: pinch, pan, double-tap, drag-to-dismiss ── */

  // Relative to the slide's untransformed centre (the viewport centre).
  const fromCentre = (px, py) => ({ x: px - window.innerWidth / 2, y: py - window.innerHeight / 2 });

  const onPointerDown = (e) => {
    const g = gesture.current;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()];
      g.pinch = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        s: view.current.s,
        mid: fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2),
        start: { ...view.current },
      };
      g.drag = null;
    } else if (g.pointers.size === 1) {
      g.pinch = null;
      g.drag = { x0: e.clientX, y0: e.clientY, t0: performance.now(), view0: { ...view.current }, axis: null };
    }
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g.pointers.has(e.pointerId)) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (g.pinch && g.pointers.size >= 2) {
      const [a, b] = [...g.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const s1 = clamp((g.pinch.s * dist) / Math.max(g.pinch.dist, 1), 1, MAX_SCALE);
      view.current = g.pinch.start;
      view.current = zoomAt(s1, g.pinch.mid.x, g.pinch.mid.y);
      applyView(false);
      return;
    }

    const d = g.drag;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;

    if (view.current.s > 1.01 || d.view0.s > 1.01) {
      view.current = clampView(d.view0.s, d.view0.x + dx, d.view0.y + dy);
      applyView(false);
      return;
    }

    if (!d.axis && Math.hypot(dx, dy) > 8) d.axis = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
    if (d.axis === "y") {
      const p = Math.min(Math.abs(dy) / 400, 1);
      gsap.set(stageRef.current, { y: dy, scale: 1 - p * 0.18 });
      gsap.set(backdropRef.current, { autoAlpha: 1 - p * 0.9 });
      gsap.set(chromeRef.current, { autoAlpha: 1 - p * 2 });
    }
  };

  const onPointerUp = (e) => {
    const g = gesture.current;
    if (!g.pointers.has(e.pointerId)) return;
    g.pointers.delete(e.pointerId);

    if (g.pinch) {
      if (g.pointers.size < 2) {
        g.pinch = null;
        if (view.current.s < 1.05) resetView(true);
        // Continue as a pan with the remaining finger.
        const rest = [...g.pointers.values()][0];
        g.drag = rest
          ? { x0: rest.x, y0: rest.y, t0: performance.now(), view0: { ...view.current }, axis: null, fromPinch: true }
          : null;
      }
      return;
    }

    const d = g.drag;
    g.drag = null;
    if (!d || e.type === "pointercancel") {
      if (d?.axis === "y") springBack();
      return;
    }
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    const dt = performance.now() - d.t0;

    if (d.axis === "y") {
      const fast = Math.abs(dy) / Math.max(dt, 1) > 0.6;
      if (Math.abs(dy) > DISMISS_DISTANCE || (fast && Math.abs(dy) > 30)) close();
      else springBack();
      return;
    }

    // Tap → double-tap zoom toggle.
    if (!d.fromPinch && Math.hypot(dx, dy) < 10 && dt < 300) {
      const now = performance.now();
      if (now - g.lastTap < 300) {
        g.lastTap = 0;
        if (view.current.s > 1.01) resetView(true);
        else {
          const p = fromCentre(e.clientX, e.clientY);
          view.current = zoomAt(DOUBLE_TAP_SCALE, p.x, p.y);
          applyView(true);
        }
      } else g.lastTap = now;
    }
  };

  const springBack = () => {
    gsap.to(stageRef.current, { y: 0, scale: 1, duration: 0.5, ease: EASE.spring });
    gsap.to(backdropRef.current, { autoAlpha: 1, duration: 0.3 });
    gsap.to(chromeRef.current, { autoAlpha: 1, duration: 0.3 });
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Product photos"
      className="fixed inset-0 z-[80] overscroll-contain select-none"
      // Keep events away from the bottom sheet's drag handlers up the React tree.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-paper/90 backdrop-blur-2xl backdrop-saturate-150"
        style={{ visibility: "hidden" }}
      />

      <div ref={stageRef} className="absolute inset-0 will-change-transform">
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          className={`flex w-full h-full wz-no-scrollbar snap-x snap-mandatory ${
            zoomed ? "overflow-hidden" : "overflow-x-auto"
          }`}
        >
          {images.map((img, i) => (
            <div
              key={img.url}
              className="relative w-full h-full overflow-hidden snap-center shrink-0"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${images.length}`}
            >
              <div
                ref={(el) => (slideRefs.current[i] = el)}
                className="absolute inset-0"
                style={{ touchAction: i === index && zoomed ? "none" : "pan-x" }}
                onPointerDown={i === index ? onPointerDown : undefined}
                onPointerMove={i === index ? onPointerMove : undefined}
                onPointerUp={i === index ? onPointerUp : undefined}
                onPointerCancel={i === index ? onPointerUp : undefined}
              >
                {Math.abs(i - index) <= 1 && (
                  <Image
                    src={img.url}
                    alt={img.altText || `${alt} photo ${i + 1}`}
                    fill
                    // Zoomed: ask for a bigger file so the detail stays sharp.
                    sizes={i === index && zoomed ? "300vw" : "100vw"}
                    priority={i === index}
                    draggable={false}
                    className="object-contain pointer-events-none"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chrome */}
      <div ref={chromeRef} className="absolute inset-0 pointer-events-none" style={{ visibility: "hidden" }}>
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="px-3 py-1.5 text-xs font-semibold rounded-full wz-glass-chip tabular-nums text-ink" aria-live="polite">
            {index + 1}
            <span className="mx-1 text-ink-soft/60">/</span>
            <span className="text-ink-soft">{images.length}</span>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close photos"
            className="pointer-events-auto wz-icon-btn wz-glass-chip"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {images.length > 1 && images.length <= 8 && (
          <div
            className="absolute flex gap-1.5 -translate-x-1/2 left-1/2 bottom-[max(1.25rem,env(safe-area-inset-bottom))] px-2.5 py-2 rounded-full wz-glass-chip"
            aria-hidden
          >
            {images.map((img, i) => (
              <span
                key={img.url}
                className={`h-1.5 rounded-full transition-all duration-wz-slow ease-wz-out ${
                  i === index ? "w-5 bg-ink" : "w-1.5 bg-ink/25"
                }`}
              />
            ))}
          </div>
        )}

        <p
          className={`absolute inset-x-0 text-center text-[11px] font-semibold tracking-wide text-ink-soft transition-opacity duration-wz-slow ${
            images.length > 1 && images.length <= 8 ? "bottom-[max(3.75rem,calc(env(safe-area-inset-bottom)+2.5rem))]" : "bottom-[max(1.25rem,env(safe-area-inset-bottom))]"
          } ${zoomed ? "opacity-0" : "opacity-100"}`}
          aria-hidden
        >
          Double-tap to zoom · swipe down to close
        </p>
      </div>
    </div>,
    document.body
  );
}
