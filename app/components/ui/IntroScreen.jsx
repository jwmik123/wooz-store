"use client";
import { useState, useEffect } from "react";
import { useProgress } from "@react-three/drei";
import collectionStore from "../../stores/collectionStore";
import { LoaderCircle } from "lucide-react";

import gsap from "gsap";

const IntroScreen = () => {
  const { progress } = useProgress();
  const setIntroScreen = collectionStore((state) => state.setIntroScreen);
  const [fadeOut, setFadeOut] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeFadeIn, setWelcomeFadeIn] = useState(false);

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

  const handleButtonClick = () => {
    setFadeOut(true);
    setIntroScreen(false);
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
              className="px-6 py-3 mt-12 text-white uppercase transition-all duration-200 border-2 border-white rounded-lg hover:bg-transparent hover:text-primary bg-primary hover:border-primary"
            >
              Start Experience
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`fixed font-libre inset-0 z-50 bg-white flex items-center justify-center transition-opacity duration-1000 ${
            fadeOut ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <LoaderCircle className="w-10 h-10 animate-spin" />
            <span className="text-2xl">{progress.toFixed(0) + "%"}</span>
          </div>
        </div>
      )}
    </>
  );
};

export default IntroScreen;
