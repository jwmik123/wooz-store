"use client";

import { useState } from "react";

const IntroScreen = ({ onEnterWorld }) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleEnterWorld = () => {
    setIsVisible(false);
    if (onEnterWorld) {
      onEnterWorld();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="text-center text-white">
        <h1 className="mb-4 text-4xl">Welcome to the World</h1>
        <button
          onClick={handleEnterWorld}
          className="px-6 py-3 text-white bg-green-500 rounded-lg hover:bg-green-700"
        >
          Enter World
        </button>
      </div>
    </div>
  );
};

export default IntroScreen;
