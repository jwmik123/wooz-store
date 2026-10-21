"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { X, ChevronLeft, ChevronRight, ArrowLeft, ShoppingBag } from "lucide-react";
import ProductsClient from "../../products/ProductsClient";
import collectionStore from "../../stores/collectionStore";
import useCartCount from "./useCartCount";
import CartList from "./CartList";
import { useCollectionNav } from "./Navigation";
import { EASE, DUR, STAGGER, prefersReducedMotion } from "./tokens";
import { useT } from "@/lib/i18n";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const isMobileViewport = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

/**
 * The shop panel: a frosted-glass card floating over the 3D studio on desktop,
 * a draggable bottom sheet on mobile. Hosts the product view and the bag view
 * (stacked layers, so the 3D viewer stays mounted while the bag is open).
 */
export const Sidebar = () => {
  const sidebarOpen = collectionStore((s) => s.sidebarOpen);
  const cartOpen = collectionStore((s) => s.cartOpen);
  const productHandle = collectionStore((s) => s.productHandle);
  const setSidebarOpen = collectionStore((s) => s.setSidebarOpen);
  const setCartOpen = collectionStore((s) => s.setCartOpen);
  const count = useCartCount();
  const t = useT();

  const panelRef = useRef(null);
  const productLayerRef = useRef(null);
  const cartLayerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const { index, total, go } = useCollectionNav();

  const close = () => setSidebarOpen(false);

  // Panel enter / exit choreography.
  useIsoLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const reduce = prefersReducedMotion();
    const mobile = isMobileViewport();
    const hidden = mobile ? { yPercent: 105, xPercent: 0 } : { xPercent: 112, yPercent: 0 };

    document.documentElement.dataset.wzPanel = sidebarOpen ? "open" : "closed";
    if (sidebarOpen) {
      setVisible(true);
      gsap.killTweensOf(panel);
      gsap.set(panel, { y: 0 });
      gsap.fromTo(
        panel,
        { ...hidden, scale: mobile ? 1 : 0.97, autoAlpha: 1 },
        {
          xPercent: 0,
          yPercent: 0,
          scale: 1,
          duration: reduce ? 0.001 : DUR.panel,
          ease: EASE.out,
        }
      );
      const items = panel.querySelectorAll("[data-reveal-header]");
      gsap.fromTo(
        items,
        { y: 14, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: reduce ? 0.001 : 0.7,
          ease: EASE.out,
          stagger: STAGGER,
          delay: reduce ? 0 : 0.25,
        }
      );
      requestAnimationFrame(() => panel.focus({ preventScroll: true }));
    } else {
      gsap.killTweensOf(panel);
      gsap.to(panel, {
        ...hidden,
        scale: mobile ? 1 : 0.98,
        duration: reduce ? 0.001 : 0.5,
        ease: EASE.in,
        onComplete: () => {
          gsap.set(panel, { autoAlpha: 0, y: 0 });
          setVisible(false);
          setCartOpen(false);
        },
      });
    }
  }, [sidebarOpen]);

  // Bag layer slides over the product layer.
  const firstCart = useRef(true);
  useIsoLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    const dur = reduce || firstCart.current ? 0.001 : 0.6;
    firstCart.current = false;
    gsap.to(cartLayerRef.current, {
      xPercent: cartOpen ? 0 : 100,
      autoAlpha: cartOpen ? 1 : 0,
      duration: dur,
      ease: EASE.out,
    });
    gsap.to(productLayerRef.current, {
      xPercent: cartOpen ? -12 : 0,
      autoAlpha: cartOpen ? 0 : 1,
      duration: dur,
      ease: EASE.out,
    });
  }, [cartOpen]);

  // Mobile: drag the sheet down to dismiss.
  const drag = useRef(null);
  const onHandleDown = (e) => {
    if (!isMobileViewport() || e.target.closest("button")) return;
    drag.current = { y0: e.clientY, t0: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onHandleMove = (e) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.y0;
    drag.current.dy = dy;
    // rubber-band upwards, follow finger downwards
    gsap.set(panelRef.current, { y: dy > 0 ? dy : dy * 0.15 });
  };
  const onHandleUp = () => {
    if (!drag.current) return;
    const { dy, t0 } = drag.current;
    const v = dy / Math.max(performance.now() - t0, 1);
    drag.current = null;
    if (dy > 120 || (dy > 30 && v > 0.6)) close();
    else gsap.to(panelRef.current, { y: 0, duration: 0.5, ease: EASE.spring });
  };

  const showProductNav = productHandle && !cartOpen;

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={cartOpen ? t("panel.bag") : t("panel.product")}
      tabIndex={-1}
      inert={!sidebarOpen ? true : undefined}
      style={{ visibility: "hidden" }}
      className="wz-panel fixed z-wz-panel outline-none
        inset-x-0 bottom-0 h-[86dvh]
        md:inset-x-auto md:h-auto md:top-[calc(var(--wz-banner-h)+var(--wz-panel-inset))] md:bottom-[var(--wz-panel-inset)] md:right-[var(--wz-panel-inset)] md:w-[var(--wz-panel-width)]"
    >
      <div className="relative flex flex-col h-full overflow-hidden wz-glass rounded-t-wz-xl md:rounded-wz-xl text-ink">
        {/* Header (also the drag zone on mobile) */}
        <div
          className="relative shrink-0 touch-none md:touch-auto"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <div className="flex justify-center pt-2.5 md:hidden" aria-hidden>
            <span className="h-1.5 w-11 rounded-full bg-ink/15" />
          </div>
          <header className="flex items-center justify-between gap-3 px-4 pt-2 pb-2 md:px-5 md:pt-4">
            {showProductNav ? (
              <div className="flex items-center gap-1" data-reveal-header>
                <button
                  type="button"
                  className="wz-icon-btn"
                  onClick={() => go("prev")}
                  aria-label={t("panel.prev")}
                >
                  <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={1.75} />
                </button>
                <div className="min-w-[3.75rem] text-center tabular-nums" aria-live="polite">
                  <span className="text-sm font-semibold font-display">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="mx-1 text-ink-soft/60">/</span>
                  <span className="text-sm text-ink-soft">
                    {String(total).padStart(2, "0")}
                  </span>
                </div>
                <button
                  type="button"
                  className="wz-icon-btn"
                  onClick={() => go("next")}
                  aria-label={t("panel.next")}
                >
                  <ChevronRight className="w-[18px] h-[18px]" strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1" data-reveal-header>
                {cartOpen && productHandle && (
                  <button
                    type="button"
                    className="wz-icon-btn"
                    onClick={() => setCartOpen(false)}
                    aria-label={t("panel.back")}
                  >
                    <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-1" data-reveal-header>
              {!cartOpen && (
                <button
                  type="button"
                  className="relative wz-icon-btn"
                  onClick={() => setCartOpen(true)}
                  aria-label={t("bag.open", { n: count })}
                >
                  <ShoppingBag className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  {count > 0 && (
                    <span
                      key={count}
                      className="wz-pop absolute top-1 right-1 grid place-items-center min-w-[16px] h-4 px-1 rounded-full bg-leaf text-[10px] font-bold text-paper"
                    >
                      {count}
                    </span>
                  )}
                </button>
              )}
              <button
                type="button"
                className="wz-icon-btn"
                onClick={close}
                aria-label={t("panel.close")}
              >
                <X className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </button>
            </div>
          </header>
        </div>

        {/* Layers */}
        <div className="relative flex-1 min-h-0">
          <div
            ref={productLayerRef}
            className="absolute inset-0 overflow-x-hidden overflow-y-auto wz-no-scrollbar overscroll-contain"
            aria-hidden={cartOpen || undefined}
            inert={cartOpen ? true : undefined}
          >
            <ProductsClient active={visible && sidebarOpen && !cartOpen} />
          </div>
          <div
            ref={cartLayerRef}
            className="absolute inset-0 overflow-x-hidden overflow-y-auto wz-no-scrollbar overscroll-contain"
            style={{ visibility: "hidden" }}
            inert={!cartOpen ? true : undefined}
          >
            {(cartOpen || visible) && <CartList onClose={close} />}
          </div>
        </div>
      </div>
    </aside>
  );
};
