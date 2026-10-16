"use client";

import { forwardRef } from "react";

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
  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[55] flex flex-col items-center justify-between px-6 pt-[13vh] pb-[max(7vh,env(safe-area-inset-bottom))] text-ink pointer-events-none"
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
          A little glasshouse at the end of a wild garden. Wander in, try things
          on, take something happy home.
        </p>
      </div>

      <div className="flex flex-col items-center gap-5">
        <div
          className={`flex flex-col items-center gap-2 ${interactive ? "pointer-events-auto" : ""}`}
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
