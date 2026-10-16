// Shopify "Color" option value -> swatch colour. Also used to tint the
// product stage so each colourway gets its own soft pastel backdrop.
export const SWATCHES = {
  Black: "#1d1d1f",
  Brown: "#5a2d0c",
  "Dark grey/Taupe": "#5f5a55",
  "Light Grey": "#cfd1d3",
  "Light Grey Melange": "#9aa3ad",
  "Sage Green": "#b9bd8c",
  "Foam Green": "#bdcfbd",
  Green: "#028370",
  Navy: "#1e2f5c",
  Blue: "#2f56b0",
  White: "#fbfbf8",
  "Sky Blue": "#68b0c6",
  "Ice Blue": "#a9c8ea",
  Beige: "#c8c5b9",
};

export const swatchFor = (name) => SWATCHES[name] || "#d6ecdd";

/** Light colours need a visible edge on a paper background. */
export function isLightSwatch(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 200;
}
