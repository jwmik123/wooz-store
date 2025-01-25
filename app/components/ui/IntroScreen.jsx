import { useState, useEffect, useRef } from "react";
import { useProgress } from "@react-three/drei";
import { gsap } from "gsap";
import collectionStore from "../../stores/collectionStore";
import SmoothProgress from "./SmoothProgress";
import { InfoIcon, LoaderIcon } from "lucide-react";
import useSoundStore from "../../stores/soundStore";

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
    if (progress === 100) {
      const timeline = gsap.timeline();

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
    }
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
        className="fixed inset-0 z-50 items-center justify-center hidden opacity-0 font-libre"
      >
        <div className="flex flex-col items-center gap-4 text-center text-primary">
          <h2 className="text-3xl italic font-light">Welcome to</h2>
          <h1 className="text-5xl font-base md:text-7xl">Wooz Studio</h1>

          <button
            onClick={() => handleButtonClick(true)}
            className="px-6 py-3 mt-12 text-white uppercase duration-300 border-2 border-white rounded-lg transition-color hover:bg-transparent hover:text-primary bg-primary hover:border-primary"
          >
            Start Experience
          </button>
        </div>
        <button
          onClick={() => handleButtonClick(false)}
          className="absolute w-full py-3 underline -translate-x-1/2 bottom-2 left-1/2 underline-offset-2 text-primary"
        >
          Start Experience without sound
        </button>
      </div>

      <div
        ref={loadingRef}
        className="fixed inset-0 z-50 flex items-center justify-center text-white bg-primary font-libre"
        style={{
          clipPath: "circle(150% at 50% 50%)", // Initial state: full screen
        }}
      >
        <div className="absolute flex flex-col items-center justify-center w-full h-full gap-2">
          <SmoothProgress actualProgress={progress} />
          <div className="mt-10 text-4xl font-light">
            <LoaderIcon className="animate-spin" />
          </div>
          <div
            className="fixed bottom-0 left-0 h-4 bg-white transition-[width] duration-300 will-change-transform"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="absolute flex items-center gap-2 p-2 rounded-md bottom-2 left-2 bg-white/20 backdrop-blur-sm">
          <InfoIcon className="w-6 h-6 cursor-pointer" />
          <div className="text-center text-black">
            click on the pulsing dots to interact.
          </div>
        </div>
      </div>
    </>
  );
};

export default IntroScreen;
