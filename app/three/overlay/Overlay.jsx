import { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import collectionStore from "../../stores/collectionStore";

const PointsOfInterest = () => {
  const pointRef = useRef([]);
  const selectedCollection = collectionStore(
    (state) => state.selectedCollection
  );

  console.log(selectedCollection);

  const collections = ["Hoodie", "Splatter", "Polo", "Longsleeve"];

  useEffect(() => {
    if (selectedCollection) {
      console.log("selectedCollection", selectedCollection);
      // Find the index of the selected collection
      const selectedIndex = collections.findIndex(
        (label) => label.toLowerCase() === selectedCollection.toLowerCase()
      );

      // Only animate the selected point
      if (selectedIndex !== -1 && pointRef.current[selectedIndex]) {
        // Then animate the selected point
        gsap.fromTo(
          pointRef.current[selectedIndex],
          {
            y: 0,
            duration: 0.5,
          },
          {
            y: -60,
            duration: 0.5,
          }
        );
      } else {
        // If no collection is selected, reset all points
        pointRef.current.forEach((point) => {
          gsap.to(point, {
            y: -100,
            duration: 0.5,
          });
        });
      }
    }
  }, [selectedCollection]);

  return (
    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
      {["Hoodie", "Splatter", "Polo", "Longsleeve"].map((label, index) => (
        <div key={index} className={`point point-${index}`}>
          <div className="label ripple"></div>
          <div
            className="overflow-hidden text-center -translate-x-1/2 label-text"
            ref={(el) => (pointRef.current[index] = el)}
          >
            <p className="text-xl font-bold uppercase pointer-events-none">
              {label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PointsOfInterest;
