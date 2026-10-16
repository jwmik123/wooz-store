import { useEffect, useRef, useState } from "react";
import { InfoIcon } from "lucide-react";
import { useRackHover } from "../v2/signs/signState";

/**
 * Small chip next to the cursor while a rack / signboard / table piece is hovered
 * ("Hoodies · 4 colours"). Positioned from pointermove events only.
 */
function HoverChip() {
  const label = useRackHover((s) => s.label);
  const ref = useRef(null);
  const last = useRef(null); // keep the text while the chip fades out
  if (label) last.current = label;

  useEffect(() => {
    const onMove = (e) => {
      const el = ref.current;
      if (el) el.style.transform = `translate3d(${e.clientX + 16}px, ${e.clientY + 18}px, 0)`;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="wz-glass-chip wz-hover-chip"
      data-on={label ? "true" : "false"}
    >
      {last.current}
    </div>
  );
}

const PointsOfInterest = () => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <HoverChip />
      <div className="absolute flex items-center gap-2 p-2 rounded-md bottom-2 left-2 bg-white/20 backdrop-blur-sm">
        <InfoIcon
          className="w-6 h-6 cursor-pointer"
          onPointerEnter={() => setShowInfo(true)}
          onPointerLeave={() => setShowInfo(false)}
          onClick={() => setShowInfo(!showInfo)}
        />
        {showInfo && (
          <div className="text-center text-black">
            tap a rack (or its sign) to shop it.
          </div>
        )}
      </div>
    </>
  );
};

export default PointsOfInterest;
