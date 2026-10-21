"use client";

import { forwardRef, useEffect, useState } from "react";
import useEnvironmentStore from "../../stores/environmentStore";
import { DROP_LONG, useDropStore } from "@/lib/drop";

// Same window the lamps/stars use: dusk → dawn.
const isDark = (h) => h >= 20.6 || h < 6.1;

/*
 * Welcome card over the intro shot (title, copy, the two entry buttons).
 * Purely presentational: components/loader/Loader.jsx choreographs it in
 * (letters rise out of their line) and out again on entry.
 */

const chars = (word) =>
  [...word].map((c, i) => (
    <span key={i} className="wz-welcome-char">
      {c}
    </span>
  ));

const IntroScreen = forwardRef(function IntroScreen(
  { onStart, interactive },
  ref,
) {
  // Read after mount: the server has no idea what time it is for the visitor.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = useEnvironmentStore((s) => isDark(s.timeOfDay)) && mounted;
  // Before the sale drop the greenhouse is closed: no way in, the countdown
  // board in the garden (three/v2/garden/DropBoard.jsx) is the call to action.
  const closed = useDropStore((s) => s.phase !== "open") && mounted;
  const openSheet = useDropStore((s) => s.openSheet);
  return (
    <div
      ref={ref}
      data-dark={dark || undefined}
      className="wz-intro fixed inset-0 z-[55] flex flex-col items-center justify-between px-6 pt-[13vh] pb-[max(7vh,env(safe-area-inset-bottom))] text-ink pointer-events-none"
      aria-hidden={!interactive}
      style={{ visibility: "hidden" }}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="wz-eyebrow !text-ink/70" data-intro="eyebrow">
          Welcome to
        </span>
        <h1 className="wz-display text-[clamp(3rem,2rem+5vw,6.5rem)] leading-[0.95] text-ink">
          <span className="sr-only">Wooz Studio</span>
          <span className="wz-welcome-line" aria-hidden>
            {chars("Wooz")}{" "}
            <em className="italic font-[350] text-primary">
              {chars("Studio")}
            </em>
          </span>
        </h1>
        <p
          className="wz-intro-copy max-w-[21rem] md:max-w-[30rem] mt-2 text-center text-wz-sm font-medium text-ink"
          data-intro="copy"
        >
          {closed ? (
            <>
              The glasshouse is closed until the sale drop on {DROP_LONG}. Press
              a button on the sign so you don&apos;t miss it.
            </>
          ) : (
            <>
              A little glasshouse at the end of a wild garden. Wander in, try
              things on, take something happy home.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col items-center gap-5">
        {closed && (
          // Keyboard / screen-reader route to the sheet the 3D buttons open.
          <div className={`flex gap-2 ${interactive ? "pointer-events-auto" : ""}`}>
            {[
              ["calendar", "Add the sale drop to your calendar"],
              ["remind", "Remind me about the sale drop"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => openSheet(key)}
                disabled={!interactive}
                className="sr-only focus:not-sr-only px-4 py-2 text-sm font-medium rounded-full wz-glass-chip text-ink wz-focus"
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div
          className={`${closed ? "hidden" : "flex wz-fade-in"} flex-col items-center gap-2 ${interactive ? "pointer-events-auto" : ""}`}
          data-intro="actions"
        >
          <button
            type="button"
            onClick={() => onStart(true)}
            disabled={!interactive}
            className="h-14 px-9 wz-btn-primary text-wz-base"
          >
            Step inside
          </button>
          <button
            type="button"
            onClick={() => onStart(false)}
            disabled={!interactive}
            className="px-3 py-2 text-sm font-medium underline rounded-full underline-offset-4 decoration-ink/30 hover:decoration-ink text-ink wz-focus wz-intro-copy"
          >
            Step inside without sound
          </button>
        </div>
      </div>
    </div>
  );
});

export default IntroScreen;
