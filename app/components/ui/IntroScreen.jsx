import { useState, useEffect, useRef } from "react";
import { useProgress } from "@react-three/drei";
import { gsap } from "gsap";
import collectionStore from "../../stores/collectionStore";
import SmoothProgress from "./SmoothProgress";
import { InfoIcon } from "lucide-react";
import useSoundStore from "../../stores/soundStore";
import useQualityStore from "../../three/v2/perf/quality";

/** Resolves once the quality tier is calibrated (perf/QualityMonitor), or after `ms`. */
const whenCalibrated = (ms) =>
  new Promise((resolve) => {
    if (useQualityStore.getState().calibrated) return resolve();
    const t = setTimeout(done, ms);
    const unsub = useQualityStore.subscribe((s) => s.calibrated && done());
    function done() {
      clearTimeout(t);
      unsub();
      resolve();
    }
  });

const IntroScreen = () => {
  const { progress } = useProgress();
  const setIntroScreen = collectionStore((state) => state.setIntroScreen);
  const { setSoundEnabled, initialize } = useSoundStore();
  const loadingRef = useRef(null);
  const welcomeRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (progress !== 100) return;
    let cancelled = false;
    let timeline;
    // The canvas renders at a tiny DPR while this opaque loader covers it; the
    // quality tier is measured behind it, then the scene is revealed at full res.
    whenCalibrated(3000).then(() => {
      if (cancelled) return;
      useQualityStore.getState().setVeiled(false);
      timeline = gsap.timeline();

      timeline
        .to(loadingRef.current, {
          clipPath: "circle(0% at 50% 50%)",
          ease: "power3.inOut",
          duration: 1.5,
        })
        .call(() => {
          setIsLoading(false);
        })
        .set(welcomeRef.current, {
          display: "flex",
        })
        .to(welcomeRef.current, {
          opacity: 1,
          duration: 1,
          delay: 0.1,
        });
    });
    return () => {
      cancelled = true;
      timeline?.kill();
    };
  }, [progress]);

  const handleButtonClick = (withSound = true) => {
    gsap.to(welcomeRef.current, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        setSoundEnabled(withSound);
        setIntroScreen(false);
      },
    });
  };

  return (
    <>
      <div
        ref={welcomeRef}
        className="fixed inset-0 z-50 flex-col items-center justify-between hidden px-6 opacity-0 pt-[14vh] pb-[7vh] text-ink"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="wz-eyebrow !text-ink/70">Welcome to</span>
          <h1 className="wz-display text-[clamp(3rem,2rem+5vw,6.5rem)] leading-[0.95] text-ink">
            Wooz <em className="italic font-[350] text-primary">Studio</em>
          </h1>
          <p className="max-w-xs mt-2 text-wz-sm text-ink/75">
            A tiny glasshouse studio in a wild garden. Tap a rack, play with the clothes, take something happy home.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => handleButtonClick(true)}
            className="h-14 px-8 wz-btn-primary text-wz-base"
          >
            Start the experience
          </button>
          <button
            onClick={() => handleButtonClick(false)}
            className="px-3 py-2 text-sm underline rounded-full underline-offset-4 decoration-ink/30 hover:decoration-ink font-medium text-ink wz-focus"
          >
            Start without sound
          </button>
        </div>
      </div>

      <div
        ref={loadingRef}
        className="fixed inset-0 z-50 flex items-center justify-center bg-primary text-paper"
        style={{
          clipPath: "circle(150% at 50% 50%)", // Initial state: full screen
        }}
      >
        <div className="absolute flex flex-col items-center justify-center w-full h-full gap-6">
          <span className="wz-eyebrow !text-paper/70">Opening the studio</span>
          <div className="wz-display tabular-nums">
            <SmoothProgress actualProgress={progress} />
          </div>
          <div className="w-40 h-[3px] overflow-hidden rounded-full bg-paper/20" aria-hidden>
            <div
              className="h-full rounded-full bg-paper transition-[width] duration-300 ease-wz-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="absolute flex items-center gap-2 px-3 py-2 text-xs rounded-full bottom-4 left-4 bg-paper/15 backdrop-blur-sm text-paper">
          <InfoIcon className="w-4 h-4" strokeWidth={1.75} />
          <span>Tap the pulsing dots to explore.</span>
        </div>
      </div>
    </>
  );
};

export default IntroScreen;
