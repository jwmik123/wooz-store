import { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import collectionStore from "../../stores/collectionStore";
import { InfoIcon } from "lucide-react";
import { useSaleHandles } from "@/lib/sale";

const PointsOfInterest = () => {
  const pointRef = useRef([]);
  const selectedCollection = collectionStore(
    (state) => state.selectedCollection
  );

  const [showInfo, setShowInfo] = useState(false);
  const saleHandles = useSaleHandles();

  const collections = ["Hoodie", "Splatter", "Polo", "Longsleeve", "Totebag"];

  useEffect(() => {
    if (selectedCollection) {
      const selectedIndex = collections.findIndex(
        (label) => label.toLowerCase() === selectedCollection.toLowerCase()
      );

      if (selectedIndex !== -1 && pointRef.current[selectedIndex]) {
        // Animate selected text characters
        const chars = pointRef.current[selectedIndex].querySelectorAll(".char");
        gsap.to(chars, {
          y: -40,
          opacity: 0.9,
          duration: 0.3,
          stagger: 0.05,
        });
      }
    }
  }, [selectedCollection]);

  return (
    <>
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        {[
          "Hoodie",
          "Splatter",
          "Polo",
          "Longsleeve",
          "Totebag",
          "Coffee",
          "Lookbook",
        ].map((label, index) => (
          <div key={index} className={`point point-${index}`}>
            <div className="label ripple"></div>
            {saleHandles.has(label.toLowerCase()) && (
              <span className="wz-sale-tag" aria-label={`${label} on sale`}>
                Sale
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="absolute flex items-center gap-2 p-2 rounded-md bottom-2 left-2 bg-white/20 backdrop-blur-sm">
        <InfoIcon
          className="w-6 h-6 cursor-pointer"
          onPointerEnter={() => setShowInfo(true)}
          onPointerLeave={() => setShowInfo(false)}
          onClick={() => setShowInfo(!showInfo)}
        />
        {showInfo && (
          <div className="text-center text-black">
            click on the pulsing dots to interact.
          </div>
        )}
      </div>
    </>
  );
};

export default PointsOfInterest;
