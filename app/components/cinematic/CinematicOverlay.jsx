"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import useCameraStore from "../../stores/cameraStore";
import { EASE, d } from "../ui/tokens";
import { useT } from "@/lib/i18n";
import "./cinematic.css";

// One credit per shot, cycling (the reel has 8 shots, so each comes round twice).
const CREDITS = [
  { label: "Wooz Studio", name: "cin.tagline" },
  { label: "cin.design", name: "Kevin Schipper", href: "https://kevinschipper.com", host: "kevinschipper.com" },
  { label: "cin.dev", name: "Joël Mik", href: "https://joelmik.nl", host: "joelmik.nl" },
];

/**
 * Coffee-cup cinematic chrome: thin letterbox bars, the frozen frame the
 * reel crossfades from (#wz-cin-snap, animated by useCinematicReel) and a credit
 * line per shot. Any click / tap / Esc / scroll ends the reel. While it runs,
 * <html> gets .wz-cinematic so the floating UI and hotspot dots step aside.
 */
export default function CinematicOverlay() {
  const cinematic = useCameraStore((s) => s.cinematic);
  const shot = useCameraStore((s) => s.cinematicShot);
  const root = useRef(null);
  const credit = useRef(null);
  const t = useT();

  // Bars in / out + hide the chrome.
  useEffect(() => {
    const el = root.current;
    document.documentElement.classList.toggle("wz-cinematic", cinematic);
    gsap.to(el.querySelectorAll(".wz-cin-bar"), {
      scaleY: cinematic ? 1 : 0,
      duration: d(cinematic ? 1.4 : 0.8),
      ease: cinematic ? EASE.inOut : "power2.inOut",
      overwrite: true,
    });
    gsap.to(el.querySelector(".wz-cin-hint"), {
      opacity: cinematic ? 1 : 0,
      duration: d(0.6),
      delay: cinematic ? 1.6 : 0,
      overwrite: true,
    });
    if (!cinematic) gsap.to(credit.current, { opacity: 0, duration: d(0.4), overwrite: true });
  }, [cinematic]);

  // Credit per shot: fades in after the cut, out before the next dissolve.
  useEffect(() => {
    if (!cinematic || shot < 0) return;
    const el = credit.current;
    gsap.killTweensOf(el);
    gsap
      .timeline()
      .set(el, { opacity: 0, y: 8 })
      .to(el, { opacity: 1, y: 0, duration: d(1.2), ease: EASE.out, delay: 1.1 })
      .to(el, { opacity: 0, duration: d(0.8), ease: "sine.in", delay: 3.6 });
  }, [cinematic, shot]);

  // Exit on any click / tap / Esc / scroll (links in the credits still work).
  useEffect(() => {
    if (!cinematic) return;
    let swallow = false;
    const end = () => useCameraStore.getState().setCinematic(false);
    const onDown = (e) => {
      if (e.target.closest?.("a[href]")) return;
      swallow = true; // the click that ends the reel must not open a rack
      end();
    };
    const onClick = (e) => {
      if (!swallow) return;
      swallow = false;
      e.stopPropagation();
      e.preventDefault();
    };
    const onKey = (e) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") end();
    };
    // Arm after the click on the cup has finished.
    const t = setTimeout(() => {
      window.addEventListener("pointerdown", onDown, true);
      window.addEventListener("wheel", end, { passive: true });
      window.addEventListener("touchmove", end, { passive: true });
    }, 250);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("wheel", end);
      window.removeEventListener("touchmove", end);
      window.removeEventListener("keydown", onKey);
      // Let the swallowing click (fired after pointerup) arrive first.
      setTimeout(() => window.removeEventListener("click", onClick, true), 400);
    };
  }, [cinematic]);

  const c = CREDITS[(shot < 0 ? 0 : shot) % CREDITS.length];

  return (
    <div ref={root} className="wz-cin" aria-hidden={!cinematic}>
      <canvas id="wz-cin-snap" className="wz-cin-snap" />
      <div className="wz-cin-bar wz-cin-bar--top">
        <span className="wz-cin-hint wz-eyebrow">
          <span className="wz-cin-hint-dot" aria-hidden />
          {t("cin.return")}
        </span>
      </div>
      <div className="wz-cin-bar wz-cin-bar--bottom">
        <div ref={credit} className="wz-cin-credit" role="status" aria-live="polite">
          <span className="wz-eyebrow wz-cin-credit-label">{c.label.startsWith("cin.") ? t(c.label) : c.label}</span>
          <span className="wz-cin-credit-name">{c.name.startsWith("cin.") ? t(c.name) : c.name}</span>
          {c.href && (
            <a className="wz-cin-credit-link" href={c.href} target="_blank" rel="noreferrer">
              {c.host}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
