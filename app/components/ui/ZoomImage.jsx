import React, { useState, useRef } from "react";
import Image from "next/image";
import { Loader } from "lucide-react";
// import { useMousePosition } from "@/hooks/useMousePosition";

const useMousePosition = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    setPosition({ x: e.clientX, y: e.clientY });
  };

  return {
    position,
    handleMouseMove,
  };
};

const ZoomImage = ({
  src,
  alt,
  width,
  height,
  quality = 75,
  priority = false,
}) => {
  const [showZoom, setShowZoom] = useState(false);
  const imageContainerRef = useRef(null);
  const { position, handleMouseMove } = useMousePosition();
  const ZOOM_LEVEL = 2;

  const getRelativePosition = () => {
    if (!imageContainerRef.current) return { x: 0, y: 0 };

    const bounds = imageContainerRef.current.getBoundingClientRect();
    return {
      x: (position.x - bounds.left) / bounds.width,
      y: (position.y - bounds.top) / bounds.height,
    };
  };

  const relativePosition = getRelativePosition();

  return (
    <div
      ref={imageContainerRef}
      className="relative w-full overflow-hidden "
      onMouseEnter={() => setShowZoom(true)}
      onMouseLeave={() => setShowZoom(false)}
      onMouseMove={handleMouseMove}
    >
      <div className="relative flex justify-center w-full md:block md:w-auto">
        <Image
          src={src}
          alt={alt}
          className="object-cover w-[90%] rounded-lg md:w-full"
          quality={quality}
          height={height}
          width={width}
          placeholder="empty"
          priority={priority}
        />
      </div>

      {showZoom && (
        <div
          className="absolute flex items-center justify-center transition-transform duration-75 ease-out transform -translate-x-1/2 -translate-y-1/2 bg-white bg-opacity-50 border rounded-lg shadow-lg pointer-events-none"
          style={{
            width: "200px",
            height: "200px",
            left: `${relativePosition.x * 100}%`,
            top: `${relativePosition.y * 100}%`,
            overflow: "hidden",
          }}
        >
          <Loader className="w-5 h-5 animate-spin " />
          <div
            className="absolute w-[1000px] h-[1000px]"
            style={{
              backgroundImage: `url(${src})`,
              backgroundPosition: `${relativePosition.x * 100}% ${
                relativePosition.y * 100
              }%`,
              backgroundSize: `${ZOOM_LEVEL * 100}%`,
              backgroundRepeat: "no-repeat",
              transform: "translate(-50%, -50%)",
              left: "50%",
              top: "50%",
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ZoomImage;
