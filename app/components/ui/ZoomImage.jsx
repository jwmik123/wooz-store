"use client";

import { useRef, useState } from "react";
import Image from "next/image";

/**
 * A product photo that fills its frame and zooms in place on click (desktop):
 * the zoom origin follows the pointer, so moving the mouse pans the detail.
 * Touch devices keep plain swiping (zoom is pointer-fine only).
 */
const ZoomImage = ({
  src,
  alt,
  sizes = "(max-width: 768px) 100vw, 1040px",
  priority = false,
  zoom = 2.2,
  onZoomChange,
  className = "",
}) => {
  const ref = useRef(null);
  const [zoomed, setZoomed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");

  const canZoom = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const updateOrigin = (e) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setOrigin(`${x}% ${y}%`);
  };

  const toggle = (e) => {
    if (!canZoom()) return;
    updateOrigin(e);
    const next = !zoomed;
    setZoomed(next);
    onZoomChange?.(next);
  };

  return (
    <div
      ref={ref}
      className={`relative w-full h-full overflow-hidden ${
        zoomed ? "cursor-zoom-out" : "md:cursor-zoom-in"
      } ${className}`}
      onClick={toggle}
      onPointerMove={zoomed ? updateOrigin : undefined}
      onPointerLeave={() => {
        if (zoomed) {
          setZoomed(false);
          onZoomChange?.(false);
        }
      }}
    >
      {!loaded && <div className="absolute inset-0 wz-skeleton" aria-hidden />}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        quality={85}
        priority={priority}
        draggable={false}
        onLoad={() => setLoaded(true)}
        className="object-cover object-[50%_30%] select-none transition-[transform,opacity] duration-wz-slow ease-wz-out"
        style={{
          transform: `scale(${zoomed ? zoom : 1})`,
          transformOrigin: origin,
          opacity: loaded ? 1 : 0,
        }}
      />
    </div>
  );
};

export default ZoomImage;
