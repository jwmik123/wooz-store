// next/image loader: let Shopify's CDN resize and re-encode (WebP/AVIF via the
// Accept header) instead of Vercel's optimizer. The store's originals are
// 3000×4500 PNGs of ~18 MB, so routing them through /_next/image meant every
// cold width/quality pulled and decoded the full file first.
const MAX_WIDTH = 2048;

export default function shopifyImageLoader({ src, width }) {
  if (!src.startsWith("https://cdn.shopify.com/")) return src;
  const url = new URL(src);
  url.searchParams.set("width", String(Math.min(width, MAX_WIDTH)));
  return url.toString();
}
