"use client";
import { useState } from "react";
import { useProgress } from "@react-three/drei";
import collectionStore from "../../stores/collectionStore";
import { LoaderCircle } from "lucide-react";

const IntroScreen = () => {
  const { progress } = useProgress();
  const setIntroScreen = collectionStore((state) => state.setIntroScreen);
  const [fadeOut, setFadeOut] = useState(false);

  const handleButtonClick = () => {
    setFadeOut(true);
    setTimeout(() => {
      setIntroScreen(false);
    }, 1000); // Match the duration of the CSS transition
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity  duration-1000 backdrop-blur-sm ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-4 text-center text-white">
        {progress === 100 ? (
          <>
            <h1 className="text-4xl font-bold">Welcome to Wooz Studio</h1>
            <button
              onClick={handleButtonClick}
              className="px-6 py-3 text-white transition-all duration-200 bg-transparent border border-white rounded-lg hover:border-2 hover:py-4 hover:px-7 "
            >
              Enter
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <LoaderCircle className="animate-spin" />
            {progress.toFixed(0) + "%"}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntroScreen;
