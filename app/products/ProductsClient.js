"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import gsap from "gsap";
import useEmblaCarousel from "embla-carousel-react";
import { Rotate3d, Images, ChevronLeft, ChevronRight, ChevronDown, Hand } from "lucide-react";
import client from "@/lib/shopify";
import { discountPercent } from "@/lib/sale";
import collectionStore from "../stores/collectionStore";
import useCheckoutStore from "../stores/checkoutStore";
import ZoomImage from "../components/ui/ZoomImage";
import { openPhotoViewer } from "../components/ui/photoViewer";
import { EASE, STAGGER, formatPrice, prefersReducedMotion } from "../components/ui/tokens";
import { swatchFor, isLightSwatch } from "./swatches";
import { useLocale, useT } from "@/lib/i18n";

const ProductCanvas = dynamic(() => import("../three/ProductCanvas"), {
  ssr: false,
  loading: () => null,
});

const PRODUCT_QUERY = `
  query GetProductByHandle($handle: String!) {
    product(handle: $handle) {
      id
      title
      handle
      descriptionHtml
      priceRange {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      compareAtPriceRange {
        minVariantPrice { amount currencyCode }
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            availableForSale
            price { amount currencyCode }
            compareAtPrice { amount currencyCode }
            selectedOptions { name value }
            image { url altText }
          }
        }
      }
      options { name values }
      images(first: 20) {
        edges { node { url altText width height } }
      }
    }
  }
`;

// Only the description in the visitor's language (Shopify Translate & Adapt;
// falls back to the default text). Options / colours stay in the default
// language: swatches and variant matching key on those names.
const DESCRIPTION_QUERY = `
  query GetDescription($handle: String!, $language: LanguageCode) @inContext(language: $language) {
    product(handle: $handle) { descriptionHtml }
  }
`;
const descriptionCache = new Map();

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const productCache = new Map();
const opt = (node, name) => node.selectedOptions.find((o) => o.name === name)?.value;

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

export default function ProductsClient({ active = true }) {
  const productHandle = collectionStore((s) => s.productHandle);
  const initializeCart = useCheckoutStore((s) => s.initializeCart);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeCart();
  }, [initializeCart]);

  useEffect(() => {
    if (!productHandle || typeof productHandle !== "string") return;
    let cancelled = false;
    setError(null);
    if (productCache.has(productHandle)) {
      setProduct(productCache.get(productHandle));
      return;
    }
    client
      .request(PRODUCT_QUERY, { variables: { handle: productHandle } })
      .then((res) => {
        const p = res?.data?.product;
        if (!p) throw new Error(res?.errors?.message || "Product not found");
        productCache.set(productHandle, p);
        if (!cancelled) setProduct(p);
      })
      .catch((e) => {
        console.error("Error fetching product:", e.message, { handle: productHandle });
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [productHandle]);

  // Translated description (NL), swapped in when it arrives.
  const locale = useLocale();
  const t = useT();
  const [description, setDescription] = useState(null);
  useEffect(() => {
    setDescription(null);
    if (!productHandle || locale === "en") return;
    const key = `${locale}:${productHandle}`;
    if (descriptionCache.has(key)) return setDescription(descriptionCache.get(key));
    let cancelled = false;
    client
      .request(DESCRIPTION_QUERY, { variables: { handle: productHandle, language: locale.toUpperCase() } })
      .then((res) => {
        const html = res?.data?.product?.descriptionHtml;
        if (!html) return;
        descriptionCache.set(key, html);
        if (!cancelled) setDescription(html);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productHandle, locale]);

  if (!productHandle) return null;
  if (error && !product)
    return (
      <div className="px-6 py-16 text-center text-ink-soft">
        {t("product.error")}
      </div>
    );

  return (
    <ProductView
      product={product && product.handle === productHandle ? product : null}
      description={description}
      productHandle={productHandle}
      active={active}
    />
  );
}

function ProductView({ product, productHandle, active, description }) {
  const t = useT();
  const addToCart = useCheckoutStore((s) => s.addToCart);
  const reduceMotion = useReducedMotion();
  const rootRef = useRef(null);
  const sizeGroupRef = useRef(null);

  const variants = useMemo(() => product?.variants.edges.map((e) => e.node) || [], [product]);
  const colors = useMemo(
    () => [...new Set(variants.map((v) => opt(v, "Color")).filter(Boolean))],
    [variants]
  );
  const sizes = useMemo(
    () => [...new Set(variants.map((v) => opt(v, "Size")).filter(Boolean))],
    [variants]
  );
  const images = useMemo(() => product?.images.edges.map((e) => e.node) || [], [product]);

  const [mode, setMode] = useState("3d");
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | loading | added
  const [openSection, setOpenSection] = useState("details");

  // Reset choices when the collection changes.
  useEffect(() => {
    if (!product) return;
    setSelectedColor(colors[0] || null);
    setSelectedSize(sizes.length === 1 ? sizes[0] : null);
    setImageIndex(0);
    setStatus("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // Jump the gallery to the photo of the chosen colourway.
  useEffect(() => {
    if (!selectedColor) return;
    const url = variants.find((v) => opt(v, "Color") === selectedColor)?.image?.url;
    const i = url ? images.findIndex((img) => img.url === url) : -1;
    if (i >= 0) setImageIndex(i);
  }, [selectedColor, variants, images]);

  // Staggered reveal of the details whenever a new product lands.
  useIsoLayoutEffect(() => {
    if (!product || !rootRef.current) return;
    const items = rootRef.current.querySelectorAll("[data-reveal]");
    const reduce = prefersReducedMotion();
    gsap.fromTo(
      items,
      { y: 22, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: reduce ? 0.001 : 0.8,
        ease: EASE.out,
        stagger: STAGGER,
        delay: reduce ? 0 : 0.12,
      }
    );
  }, [product?.id]);

  const isSizeAvailable = (size) =>
    variants.some(
      (v) => opt(v, "Color") === selectedColor && opt(v, "Size") === size && v.availableForSale
    );
  const colorAvailable = (color) => variants.some((v) => opt(v, "Color") === color && v.availableForSale);

  const selectedVariant = variants.find(
    (v) =>
      (!colors.length || opt(v, "Color") === selectedColor) &&
      (!sizes.length || opt(v, "Size") === selectedSize)
  );
  const price = selectedVariant?.price || product?.priceRange.minVariantPrice;
  const compareAt = selectedVariant
    ? selectedVariant.compareAtPrice
    : product?.compareAtPriceRange?.minVariantPrice;
  const discount = discountPercent(price, compareAt);
  const soldOut = selectedColor && sizes.length > 0 && !sizes.some(isSizeAvailable);

  // If the chosen size isn't available in the new colour, clear it.
  useEffect(() => {
    if (selectedSize && sizes.length > 1 && !isSizeAvailable(selectedSize)) setSelectedSize(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColor]);

  const nudgeSizes = () => {
    const el = sizeGroupRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    if (!prefersReducedMotion())
      gsap.to(el, { duration: 0.5, ease: "none", keyframes: { x: [0, -8, 8, -5, 5, 0] } });
    el.querySelector("input:not(:disabled)")?.focus({ preventScroll: true });
  };

  const handleAddToCart = async () => {
    if (!selectedVariant || !selectedVariant.availableForSale) return nudgeSizes();
    setStatus("loading");
    const res = await addToCart(selectedVariant.id);
    if (!res) {
      setStatus("idle");
      return;
    }
    setStatus("added");
    setTimeout(() => setStatus("idle"), 2200);
  };

  const [kind, title] = useMemo(() => {
    if (!product) return ["", ""];
    const parts = product.title.split(/\s[-–]\s/);
    if (parts.length > 1) return [parts.slice(1).join(" – "), parts[0]];
    return [productHandle, product.title];
  }, [product, productHandle]);

  return (
    <div ref={rootRef} className="relative flex flex-col min-h-full">
      <div className="px-3 md:px-4">
        <ProductStage
          productHandle={productHandle}
          product={product}
          images={images}
          mode={mode}
          setMode={setMode}
          color={selectedColor}
          imageIndex={imageIndex}
          setImageIndex={setImageIndex}
          active={active}
          reduceMotion={reduceMotion}
        />
      </div>

      {!product ? (
        <DetailsSkeleton />
      ) : (
        <div className="flex flex-col gap-7 px-5 pt-6 pb-8 md:px-7">
          {/* Title */}
          <div data-reveal className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="capitalize wz-eyebrow">{kind}</span>
              <span className="w-1 h-1 rounded-full bg-ink/25" aria-hidden />
              <span className="wz-eyebrow !text-leaf">{t("product.made")}</span>
            </div>
            <div className="flex items-end justify-between gap-4">
              <h2 className="wz-display text-wz-display text-ink text-balance">{title}</h2>
              <div className="flex flex-col items-end pb-1 whitespace-nowrap">
                {discount > 0 && (
                  <span className="flex items-center gap-1.5 text-wz-sm tabular-nums">
                    <span className="px-1.5 py-0.5 rounded-full bg-[#e4483b] text-white text-[10px] font-bold tracking-wide">
                      −{discount}%
                    </span>
                    <s className="text-ink-soft">{formatPrice(compareAt.amount, compareAt.currencyCode)}</s>
                  </span>
                )}
                <p className={`text-xl font-display tabular-nums ${discount > 0 ? "text-[#c8352a]" : "text-ink"}`}>
                  {price && formatPrice(price.amount, price.currencyCode)}
                </p>
              </div>
            </div>
          </div>

          {/* Colour */}
          {colors.length > 0 && (
            <fieldset data-reveal className="flex flex-col gap-3">
              <legend className="flex items-baseline justify-between w-full mb-3">
                <span className="wz-eyebrow">{t("product.colour")}</span>
                <span className="text-sm text-ink">{selectedColor}</span>
              </legend>
              <div className="flex flex-wrap gap-2.5">
                {colors.map((color) => {
                  const hex = swatchFor(color);
                  const checked = selectedColor === color;
                  const available = colorAvailable(color);
                  return (
                    <label key={color} className="relative cursor-pointer group" title={color}>
                      <input
                        type="radio"
                        name="wz-color"
                        value={color}
                        checked={checked}
                        onChange={() => setSelectedColor(color)}
                        className="sr-only peer"
                        aria-label={`${color}${available ? "" : t("product.soldOutSuffix")}`}
                      />
                      <span
                        className={`block w-10 h-10 rounded-full transition-transform duration-wz-base ease-wz-spring
                          ring-offset-2 ring-offset-paper peer-focus-visible:ring-2 peer-focus-visible:ring-primary
                          group-hover:scale-[1.06] group-active:scale-95
                          ${checked ? "ring-2 ring-ink scale-[1.06]" : "ring-0"}`}
                        style={{
                          background: `radial-gradient(circle at 32% 28%, rgb(255 255 255 / 0.45), transparent 46%), ${hex}`,
                          boxShadow: `inset 0 -3px 6px rgb(0 0 0 / 0.14), inset 0 0 0 1px ${
                            isLightSwatch(hex) ? "rgb(27 51 39 / 0.14)" : "rgb(0 0 0 / 0.06)"
                          }`,
                        }}
                      />
                      {!available && (
                        <span className="absolute inset-0 grid pointer-events-none place-items-center" aria-hidden>
                          <span className="block w-[120%] h-px rotate-45 bg-ink/50" />
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Size */}
          {sizes.length > 0 && (
            <fieldset data-reveal ref={sizeGroupRef} className="flex flex-col">
              <legend className="flex items-baseline justify-between w-full mb-3">
                <span className="wz-eyebrow">{t("product.size")}</span>
                <span className="text-sm text-ink-soft">
                  {selectedSize ? selectedSize : t("product.pickFit")}
                </span>
              </legend>
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${Math.min(sizes.length, 5)}, minmax(0, 1fr))` }}
              >
                {sizes.map((size) => {
                  const available = isSizeAvailable(size);
                  const checked = selectedSize === size;
                  return (
                    <label key={size} className={available ? "cursor-pointer" : "cursor-not-allowed"}>
                      <input
                        type="radio"
                        name="wz-size"
                        value={size}
                        checked={checked}
                        disabled={!available}
                        onChange={() => setSelectedSize(size)}
                        className="sr-only peer"
                        aria-label={`${t("product.sizeAria", { size })}${available ? "" : t("product.soldOutSuffix")}`}
                      />
                      <span
                        className={`relative flex items-center justify-center h-12 rounded-wz-sm text-sm font-semibold
                          transition-[background-color,color,box-shadow,transform] duration-wz-base ease-wz-out
                          peer-focus-visible:shadow-wz-focus active:scale-[0.97]
                          ${
                            checked
                              ? "bg-ink text-paper shadow-wz-md"
                              : available
                              ? "bg-paper/70 text-ink shadow-[inset_0_0_0_1px_var(--wz-line-strong)] hover:bg-paper hover:shadow-[inset_0_0_0_1.5px_rgb(var(--wz-ink))]"
                              : "bg-transparent text-ink/30 line-through shadow-[inset_0_0_0_1px_var(--wz-line)]"
                          }`}
                      >
                        {size}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Details accordion */}
          <div data-reveal className="border-t border-[color:var(--wz-line)]">
            <Accordion
              id="details"
              title={t("product.details")}
              open={openSection === "details"}
              onToggle={(id) => setOpenSection((s) => (s === id ? null : id))}
            >
              <div className="wz-prose" dangerouslySetInnerHTML={{ __html: description || product.descriptionHtml }} />
            </Accordion>
            <Accordion
              id="care"
              title={t("product.care")}
              open={openSection === "care"}
              onToggle={(id) => setOpenSection((s) => (s === id ? null : id))}
            >
              <div className="wz-prose">
                <p>{t("product.careCopy")}</p>
                <p>
                  <a
                    className="underline rounded-sm underline-offset-4 decoration-ink/30 hover:decoration-ink wz-focus"
                    href="https://shop.wooz.store/policies/terms-of-service"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("product.terms")}
                  </a>
                </p>
              </div>
            </Accordion>
          </div>
        </div>
      )}

      {/* Sticky add to bag */}
      {product && (
        <div className="sticky bottom-0 z-10 px-3 pt-6 pb-3 mt-auto md:px-4 md:pb-4 bg-gradient-to-t from-paper via-paper/85 to-transparent">
          <AddToBagButton
            status={status}
            soldOut={soldOut}
            needsSize={!selectedSize && sizes.length > 0}
            price={price}
            compareAt={discount > 0 ? compareAt : null}
            summary={[selectedColor, selectedSize].filter(Boolean).join(" · ")}
            onClick={handleAddToCart}
          />
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Stage ───────────────────────────── */

function ProductStage({
  productHandle,
  product,
  images,
  mode,
  setMode,
  color,
  imageIndex,
  setImageIndex,
  active,
  reduceMotion,
}) {
  const t = useT();
  const threeRef = useRef(null);
  const photoRef = useRef(null);
  const thumbsRef = useRef(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [hint, setHint] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const viewerRef = useRef(null);
  const firstMode = useRef(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("wz-drag-hint") === "seen") setHint(false);
    } catch {}
  }, []);

  const onInteract = useCallback(() => {
    setHint((h) => {
      if (h) {
        try {
          sessionStorage.setItem("wz-drag-hint", "seen");
        } catch {}
      }
      return false;
    });
  }, []);

  // 3D <-> photo morph.
  useIsoLayoutEffect(() => {
    const show = mode === "3d" ? threeRef.current : photoRef.current;
    const hide = mode === "3d" ? photoRef.current : threeRef.current;
    const reduce = prefersReducedMotion();
    if (firstMode.current || reduce) {
      firstMode.current = false;
      gsap.set(show, { autoAlpha: 1, scale: 1, filter: "blur(0px)" });
      gsap.set(hide, { autoAlpha: 0 });
      return;
    }
    gsap.killTweensOf([show, hide]);
    gsap.to(hide, {
      autoAlpha: 0,
      scale: mode === "3d" ? 1.04 : 0.92,
      filter: "blur(10px)",
      duration: 0.45,
      ease: EASE.inOut,
    });
    gsap.fromTo(
      show,
      { autoAlpha: 0, scale: mode === "3d" ? 0.9 : 1.06, filter: "blur(12px)" },
      { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.75, ease: EASE.out, delay: 0.12 }
    );
  }, [mode]);

  // Photo slider. Dragging pauses while a desktop photo is zoomed in.
  const [emblaRef, emblaApi] = useEmblaCarousel({ watchDrag: !zoomed, duration: 26 });

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setImageIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, setImageIndex]);

  // Thumbnails, colour picks and arrows set imageIndex; follow along.
  useEffect(() => {
    if (!emblaApi || emblaApi.selectedScrollSnap() === imageIndex) return;
    emblaApi.scrollTo(imageIndex, prefersReducedMotion() || mode !== "photo");
  }, [emblaApi, imageIndex, mode, images.length]);

  // Keep the active thumbnail in view (horizontal only; never scrolls the panel).
  useEffect(() => {
    const strip = thumbsRef.current;
    const thumb = strip?.children[imageIndex];
    if (!strip || !thumb) return;
    const left = thumb.offsetLeft - strip.clientWidth / 2 + thumb.clientWidth / 2;
    strip.scrollTo({ left, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [imageIndex]);

  const openViewer = async () => {
    if (viewerRef.current) return;
    viewerRef.current = true;
    const pswp = await openPhotoViewer({
      images,
      index: imageIndex,
      alt: product?.title || t("product.fallbackTitle"),
      getSlideEl: (i) => emblaApi?.slideNodes()[i],
      onChange: setImageIndex,
      titles: { prev: t("product.prevPhoto"), next: t("product.nextPhoto"), close: t("product.closePhotos") },
    });
    viewerRef.current = pswp;
    pswp.on("destroy", () => (viewerRef.current = null));
  };
  useEffect(() => () => viewerRef.current?.destroy?.(), []);

  const step = (dir) => {
    if (!images.length) return;
    setImageIndex((imageIndex + dir + images.length) % images.length);
  };

  const hex = swatchFor(color);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative w-full overflow-hidden aspect-square md:aspect-[5/6] max-h-[52dvh] md:max-h-[60vh] rounded-wz-lg isolate shadow-wz-inner"
        style={{
          backgroundColor: `color-mix(in oklab, ${hex} ${isLightSwatch(hex) ? 34 : 16}%, rgb(var(--wz-paper)))`,
          transition: "background-color 700ms var(--wz-ease-out)",
        }}
      >
        {/* Studio backdrop: soft top light + floor fade */}
        <div
          className="absolute inset-0 pointer-events-none -z-10"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 18%, rgb(255 255 255 / 0.85), rgb(255 255 255 / 0) 62%), linear-gradient(to bottom, transparent 62%, rgb(27 51 39 / 0.06))",
          }}
        />

        {/* 3D layer */}
        <div ref={threeRef} className="absolute inset-0" style={{ visibility: "hidden" }}>
          <svg
            viewBox="0 0 100 100"
            className="absolute left-1/2 top-1/2 w-[112%] -translate-x-1/2 -translate-y-1/2 text-paper/50 pointer-events-none"
            aria-hidden
          >
            <circle cx="35" cy="34" r="6.5" fill="currentColor" />
            <circle cx="65" cy="34" r="6.5" fill="currentColor" />
            <path d="M18 54 Q50 92 82 54" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
          </svg>
          <div
            className="absolute inset-0 transition-opacity duration-700 ease-wz-out"
            style={{ opacity: canvasReady ? 1 : 0 }}
          >
            <ProductCanvas
              productHandle={productHandle}
              selectedColor={color}
              active={active && mode === "3d"}
              onInteract={onInteract}
              onReady={() => setCanvasReady(true)}
              reducedMotion={reduceMotion}
            />
          </div>
          {!canvasReady && (
            <div className="absolute inset-0 grid place-items-center" aria-hidden>
              <span className="w-10 h-10 border-2 rounded-full border-ink/15 border-t-ink/60 animate-spin" />
            </div>
          )}
          <div
            className={`absolute bottom-4 left-1/2 -translate-x-1/2 transition-all duration-wz-slow ease-wz-out pointer-events-none ${
              hint && canvasReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
            aria-hidden={!hint}
          >
            <div className="flex items-center gap-2 py-2 pl-3 pr-4 rounded-full wz-glass-chip text-ink">
              <Hand className="w-4 h-4 wz-nudge" strokeWidth={1.75} />
              <span className="text-xs font-semibold tracking-wide">{t("product.drag")}</span>
            </div>
          </div>
        </div>

        {/* Photo layer */}
        <div ref={photoRef} className="absolute inset-0 group/photos" style={{ visibility: "hidden" }}>
          <div
            ref={emblaRef}
            tabIndex={mode === "photo" ? 0 : -1}
            aria-roledescription="carousel"
            aria-label={t("product.photos")}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                e.stopPropagation();
                step(e.key === "ArrowRight" ? 1 : -1);
              }
            }}
            className="w-full h-full overflow-hidden outline-none focus-visible:shadow-[inset_0_0_0_3px_rgb(var(--wz-green))]"
          >
            <div className="flex h-full touch-pan-y">
            {images.map((img, i) => (
              <div
                key={img.url}
                data-slide={i}
                className="relative w-full h-full min-w-0 shrink-0 grow-0 basis-full"
                aria-roledescription="slide"
                aria-label={t("product.photoOf", { i: i + 1, n: images.length })}
              >
                {(mode === "photo" || Math.abs(i - imageIndex) < 1) && (
                  <ZoomImage
                    src={img.url}
                    alt={img.altText || t("product.photoAlt", { title: product?.title || t("product.fallbackTitle"), i: i + 1 })}
                    priority={i === 0}
                    onZoomChange={setZoomed}
                    onOpen={openViewer}
                  />
                )}
              </div>
            ))}
            </div>
          </div>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={t("product.prevPhoto")}
                className="absolute hidden opacity-0 md:grid left-3 top-[calc(50%-1.25rem)] wz-icon-btn wz-glass-chip group-hover/photos:opacity-100 focus-visible:opacity-100 transition-[opacity,transform] duration-wz-base"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={t("product.nextPhoto")}
                className="absolute hidden opacity-0 md:grid right-3 top-[calc(50%-1.25rem)] wz-icon-btn wz-glass-chip group-hover/photos:opacity-100 focus-visible:opacity-100 transition-[opacity,transform] duration-wz-base"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </button>
              {images.length <= 8 ? (
                <div className="absolute flex gap-1.5 -translate-x-1/2 bottom-4 left-1/2 px-2.5 py-2 rounded-full wz-glass-chip" aria-hidden>
                  {images.map((img, i) => (
                    <span
                      key={img.url}
                      className={`h-1.5 rounded-full transition-all duration-wz-slow ease-wz-out ${
                        i === imageIndex ? "w-5 bg-ink" : "w-1.5 bg-ink/25"
                      }`}
                    />
                  ))}
                </div>
              ) : (
                <div className="absolute px-3 py-1.5 text-xs font-semibold -translate-x-1/2 rounded-full bottom-4 left-1/2 wz-glass-chip tabular-nums text-ink" aria-live="polite">
                  {imageIndex + 1}
                  <span className="mx-1 text-ink-soft/60">/</span>
                  <span className="text-ink-soft">{images.length}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* View switch */}
        <ViewSwitch mode={mode} setMode={setMode} />
      </div>

      {/* Thumbnails (photo mode) */}
      <div className="wz-collapse" data-open={mode === "photo" && images.length > 1}>
        <div>
          <div ref={thumbsRef} className="relative flex gap-2 p-1 overflow-x-auto wz-no-scrollbar" role="tablist" aria-label={t("product.choosePhoto")}>
            {images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                role="tab"
                aria-selected={i === imageIndex}
                aria-label={t("product.photo", { i: i + 1 })}
                tabIndex={mode === "photo" ? 0 : -1}
                onClick={() => setImageIndex(i)}
                className={`relative shrink-0 w-14 h-14 overflow-hidden rounded-wz-sm transition-all duration-wz-base ease-wz-out wz-focus ${
                  i === imageIndex ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : "opacity-60 hover:opacity-100"
                }`}
              >
                <Image src={img.url} alt="" fill sizes="56px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewSwitch({ mode, setMode }) {
  const t = useT();
  const options = [
    { id: "3d", label: "3D", Icon: Rotate3d },
    { id: "photo", label: t("product.viewPhotos"), Icon: Images },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={t("product.view")}
      className="absolute top-3 left-3 z-10 grid grid-cols-2 p-1 rounded-full wz-glass-chip"
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-ink shadow-wz-md transition-transform duration-wz-slow ease-wz-spring"
        style={{ transform: `translateX(${mode === "3d" ? "0%" : "100%"})` }}
      />
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          onClick={() => setMode(id)}
          className={`relative z-10 flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold transition-colors duration-wz-base wz-focus ${
            mode === id ? "text-paper" : "text-ink hover:text-ink/70"
          }`}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
          {label}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────────── Bits ───────────────────────────── */

function Accordion({ id, title, open, onToggle, children }) {
  return (
    <div className="border-b border-[color:var(--wz-line)]">
      <h3>
        <button
          type="button"
          id={`acc-${id}`}
          aria-expanded={open}
          aria-controls={`acc-panel-${id}`}
          onClick={() => onToggle(id)}
          className="flex items-center justify-between w-full py-4 text-left rounded-sm group wz-focus"
        >
          <span className="text-wz-base font-semibold text-ink">{title}</span>
          <ChevronDown
            className={`w-4 h-4 text-ink-soft transition-transform duration-wz-slow ease-wz-out ${open ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </button>
      </h3>
      <div className="wz-collapse" data-open={open} id={`acc-panel-${id}`} role="region" aria-labelledby={`acc-${id}`}>
        <div>
          <div className="pb-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Smiley({ drawn }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <circle cx="8.5" cy="9" r="1.6" fill="currentColor" className="transition-transform duration-300 origin-center" style={{ transform: drawn ? "scale(1)" : "scale(0)", transformBox: "fill-box" }} />
      <circle cx="15.5" cy="9" r="1.6" fill="currentColor" className="transition-transform duration-300 delay-75 origin-center" style={{ transform: drawn ? "scale(1)" : "scale(0)", transformBox: "fill-box" }} />
      <path
        d="M5.5 13.5 Q12 21 18.5 13.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        pathLength="1"
        strokeDasharray="1"
        style={{ strokeDashoffset: drawn ? 0 : 1, transition: "stroke-dashoffset 520ms var(--wz-ease-out) 120ms" }}
      />
    </svg>
  );
}

function AddToBagButton({ status, soldOut, needsSize, price, compareAt, summary, onClick }) {
  const t = useT();
  const added = status === "added";
  const loading = status === "loading";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={soldOut || loading}
      aria-live="polite"
      className={`wz-btn-primary w-full h-14 px-5 text-wz-base overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed ${
        added ? "!bg-leaf" : ""
      }`}
    >
      <span className="relative flex items-center justify-between w-full gap-3">
        {added ? (
          <span className="flex items-center justify-center w-full gap-2">
            <Smiley drawn />
            {t("product.added")}
          </span>
        ) : loading ? (
          <span className="flex items-center justify-center w-full gap-2">
            <span className="w-4 h-4 border-2 rounded-full border-paper/30 border-t-paper animate-spin" />
            {t("product.adding")}
          </span>
        ) : (
          <>
            <span className="flex flex-col items-start leading-tight">
              <span>{soldOut ? t("product.soldOut") : needsSize ? t("product.selectSize") : t("product.add")}</span>
              {summary && !soldOut && (
                <span className="text-[11px] font-medium tracking-wide text-paper/60">{summary}</span>
              )}
            </span>
            {price && (
              <span className="flex items-baseline gap-1.5 font-display text-lg tabular-nums">
                {compareAt && (
                  <s className="text-xs text-paper/50">{formatPrice(compareAt.amount, compareAt.currencyCode)}</s>
                )}
                {formatPrice(price.amount, price.currencyCode)}
              </span>
            )}
          </>
        )}
      </span>
    </button>
  );
}

function DetailsSkeleton() {
  const t = useT();
  return (
    <div className="flex flex-col gap-6 px-5 pt-6 pb-8 md:px-7" aria-busy="true" aria-label={t("product.loading")}>
      <div className="w-24 h-3 rounded-full wz-skeleton" />
      <div className="w-3/4 h-10 rounded-wz-sm wz-skeleton" />
      <div className="flex gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-10 h-10 rounded-full wz-skeleton" />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-wz-sm wz-skeleton" />
        ))}
      </div>
    </div>
  );
}
