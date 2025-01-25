import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { Loader2Icon } from "lucide-react";

const SmoothProgress = ({ actualProgress }) => {
  const progressRef = useRef(null);
  const displayRef = useRef({ value: 0 });

  useEffect(() => {
    gsap.to(displayRef.current, {
      value: actualProgress,
      duration: 0.5,
      ease: "power3.out",
      onUpdate: () => {
        if (progressRef.current) {
          progressRef.current.textContent = `${Math.round(
            displayRef.current.value
          )}%`;
        }
      },
    });
  }, [actualProgress]);

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div ref={progressRef} className="font-light text-7xl">
        0%
      </div>
    </div>
  );
};

export default SmoothProgress;
