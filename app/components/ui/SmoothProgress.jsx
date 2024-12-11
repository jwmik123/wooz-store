import React, { useEffect, useState, useRef } from "react";

const SmoothProgress = ({ actualProgress }) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const animationFrameId = useRef(null);
  const lastTimeRef = useRef(null);

  // Animation settings
  const ANIMATION_DURATION = 500; // milliseconds
  const STEPS_PER_SECOND = 60;

  // Easing function (ease-out cubic)
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  useEffect(() => {
    let startProgress = displayProgress;
    let startTime = null;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      // Apply easing
      const easedProgress = easeOutCubic(progress);

      // Calculate the current display value
      const currentValue =
        startProgress + (actualProgress - startProgress) * easedProgress;

      setDisplayProgress(Math.round(currentValue));

      if (progress < 1) {
        animationFrameId.current = requestAnimationFrame(animate);
      }
    };

    // Start the animation
    animationFrameId.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [actualProgress]);

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="font-light text-9xl">{displayProgress}</div>
    </div>
  );
};

export default SmoothProgress;
