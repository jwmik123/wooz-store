"use client";
import { useState, useEffect } from "react";
import { useProgress } from "@react-three/drei";
import collectionStore from "../../stores/collectionStore";
import SmoothProgress from "./SmoothProgress";
import { Loader, InfoIcon } from "lucide-react";
import useSoundStore from "../../stores/soundStore";

const IntroScreen = () => {
  const { progress } = useProgress();
  const setIntroScreen = collectionStore((state) => state.setIntroScreen);
  const { setSoundEnabled, initialize } = useSoundStore();
  const [fadeOut, setFadeOut] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeFadeIn, setWelcomeFadeIn] = useState(false);

  useEffect(() => {
    initialize();

    return () => {
      useSoundStore.getState().cleanup();
    };
  }, [initialize]);

  useEffect(() => {
    if (progress === 100) {
      setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => {
          setShowWelcome(true);
          setTimeout(() => {
            setWelcomeFadeIn(true);
          }, 100);
        }, 1000);
      }, 1000);
    }
  }, [progress]);

  const handleButtonClick = (withSound = true) => {
    setSoundEnabled(withSound);
    setFadeOut(true);
    setIntroScreen(false);
  };

  const handleNoSoundClick = () => {
    handleButtonClick(false);
  };

  return (
    <>
      {showWelcome ? (
        <div
          className={`fixed font-libre inset-0 z-50 flex items-center justify-center transition-opacity duration-1000 ${
            welcomeFadeIn ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex flex-col items-center gap-4 text-center text-primary">
            <h2 className="text-3xl italic font-light">Welcome to</h2>
            <h1 className="font-base text-7xl">Wooz Studio</h1>

            <button
              onClick={handleButtonClick}
              className="px-6 py-3 mt-12 text-white uppercase transition-opacity duration-200 border-2 border-white rounded-lg hover:bg-transparent hover:text-primary bg-primary hover:border-primary"
            >
              Start Experience
            </button>
            <button
              onClick={handleNoSoundClick}
              className="py-3 underline underline-offset-2 text-primary"
            >
              Start Experience without sound
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`fixed font-libre inset-0 z-50 bg-white flex items-center justify-center transition-opacity duration-300 ${
            fadeOut ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="absolute flex flex-col items-center justify-center w-full h-full gap-2">
            <Loader className="animate-spin" />
            <SmoothProgress actualProgress={progress} />
            <div className="absolute flex items-center gap-2 p-2 rounded-md bottom-2 left-2 bg-white/20 backdrop-blur-sm">
              <InfoIcon className="w-6 h-6 cursor-pointer" />

              <div className="text-center text-black">
                click on the pulsing dots to interact.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default IntroScreen;
