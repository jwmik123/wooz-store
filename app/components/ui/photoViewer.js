"use client";

import "photoswipe/style.css";
import shopifyImageLoader from "@/lib/shopifyImageLoader";

const WIDTHS = [750, 1080, 1600, 2048];

/**
 * Open the fullscreen photo viewer (PhotoSwipe) on `index`.
 *
 * `getSlideEl(i)` returns the stage slide for photo i: the viewer zooms out of
 * its <img> and back into it, and uses the already-loaded file as placeholder.
 */
export async function openPhotoViewer({ images, index, alt, getSlideEl, onChange, titles = {} }) {
  const { default: PhotoSwipe } = await import("photoswipe");

  const dataSource = images.map((img, i) => {
    const w = Math.min(img.width || 2048, 2048);
    const h = img.width && img.height ? Math.round((img.height / img.width) * w) : w;
    const el = getSlideEl(i);
    const thumb = el?.querySelector("img");
    return {
      src: shopifyImageLoader({ src: img.url, width: 2048 }),
      srcset: WIDTHS.map((x) => `${shopifyImageLoader({ src: img.url, width: x })} ${x}w`).join(", "),
      width: w,
      height: h,
      msrc: thumb?.complete ? thumb.currentSrc : undefined,
      element: el,
      thumbCropped: true, // stage photos are object-cover
      alt: img.altText || `${alt} photo ${i + 1}`,
    };
  });

  const pswp = new PhotoSwipe({
    dataSource,
    index,
    bgOpacity: 1,
    loop: false,
    showHideAnimationType: "zoom",
    padding: { top: 64, bottom: 24, left: 0, right: 0 },
    imageClickAction: "zoom",
    tapAction: "toggle-controls",
    doubleTapAction: "zoom",
    secondaryZoomLevel: 2.5,
    maxZoomLevel: 4,
    arrowPrevTitle: titles.prev ?? "Previous photo",
    arrowNextTitle: titles.next ?? "Next photo",
    closeTitle: titles.close ?? "Close photos",
    zoomTitle: "Zoom",
  });
  pswp.on("change", () => onChange?.(pswp.currIndex));
  pswp.init();
  return pswp;
}
