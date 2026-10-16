// JS mirror of the motion tokens in app/globals.css (see docs/UI-TOKENS.md).
// Use these for GSAP so CSS and JS choreography feel like one system.

export const EASE = {
  out: "expo.out", //          ≈ var(--wz-ease-out)
  inOut: "power3.inOut", //    ≈ var(--wz-ease-in-out)
  in: "power3.in",
  spring: "back.out(1.6)", //  ≈ var(--wz-ease-spring)
};

export const DUR = {
  fast: 0.16, //  var(--wz-dur-fast)
  base: 0.28, //  var(--wz-dur-base)
  slow: 0.56, //  var(--wz-dur-slow)
  panel: 0.9,
};

export const STAGGER = 0.055;

/** True when the visitor asked for less motion. Safe on the server. */
export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Scale a duration to ~0 under reduced motion. */
export const d = (seconds) => (prefersReducedMotion() ? 0.001 : seconds);

/** Currency formatting used everywhere a price is shown. */
export function formatPrice(amount, currencyCode = "EUR") {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  try {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: currencyCode || "EUR",
    }).format(value || 0);
  } catch {
    return `€${(value || 0).toFixed(2)}`;
  }
}
