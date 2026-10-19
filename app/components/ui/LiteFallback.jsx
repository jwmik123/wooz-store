"use client";

import { useEffect, useState } from "react";
import useQualityStore, { LITE_URL, cannotRender3D } from "../../three/v2/perf/quality";

/*
 * Points visitors to the 2D storefront when the 3D garden is too heavy for
 * their device. Raised via useQualityStore.setTooHeavy:
 *   unsupported  no WebGPU and no WebGL2 (checked here, before the scene loads)
 *   error        renderer / scene crashed (Scene.jsx boundary)
 *   slow         calibration or the runtime guard found even the low tier
 *                far over budget (perf/QualityMonitor.jsx)
 * "slow" can be dismissed ("Try 3D anyway"), remembered for the session.
 * ?lite shows the prompt for testing.
 */

const DISMISS_KEY = "wz-lite-dismissed";

const COPY = {
  unsupported: "Your browser can't show our 3D garden.",
  error: "Something went wrong loading our 3D garden.",
  slow: "Our 3D garden is a bit too heavy for this device.",
};

export default function LiteFallback() {
  const reason = useQualityStore((s) => s.tooHeavy);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) setDismissed(true);
    } catch {
      /* storage blocked */
    }
    const { setTooHeavy } = useQualityStore.getState();
    if (cannotRender3D()) setTooHeavy("unsupported");
    else if (new URLSearchParams(window.location.search).has("lite")) setTooHeavy("slow");
  }, []);

  if (!reason || (reason === "slow" && dismissed)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage blocked */
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wz-lite-title"
      className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-ink/30 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center w-full max-w-sm gap-4 px-6 py-8 text-center wz-glass rounded-wz-lg text-ink">
        <span className="wz-eyebrow !text-ink/70">Wooz Studio</span>
        <h2 id="wz-lite-title" className="wz-display text-[clamp(1.75rem,1.4rem+1.5vw,2.25rem)] leading-tight">
          {COPY[reason]}
        </h2>
        <p className="text-wz-sm text-ink-soft">
          No worries: the full collection is waiting on our 2D website.
        </p>
        <a href={LITE_URL} className="flex items-center h-12 px-8 mt-2 wz-btn-primary text-wz-base">
          Go to the 2D website
        </a>
        {reason === "slow" && (
          <button
            type="button"
            onClick={dismiss}
            className="px-3 py-2 text-sm font-medium underline rounded-full underline-offset-4 decoration-ink/30 hover:decoration-ink text-ink wz-focus"
          >
            Try 3D anyway
          </button>
        )}
      </div>
    </div>
  );
}
