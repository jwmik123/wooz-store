"use client";

import { useEffect } from "react";
import { useSaleHandles } from "@/lib/sale";
import { dropLabel, useDropClosed } from "@/lib/drop";
import { useLocale, useT } from "@/lib/i18n";
import useLoadingStore from "../loader/loadingStore";
import useCameraStore from "../../stores/cameraStore";

/*
 * Thin red marquee strip across the top while anything is on sale (Shopify
 * compare-at prices, lib/sale.js). Shows once the loader hands over, hides
 * during the coffee-cup cinematic. While shown it sets html[data-wz-sale],
 * which sets --wz-banner-h so the top chrome (menu, bag, clock, panels)
 * moves down below it. Before the sale drop (lib/drop.js) it announces the drop.
 */

const REPEAT = 8;

export default function SaleBanner() {
  const sale = useSaleHandles();
  const loading = useLoadingStore((s) => s.stage === "loading");
  const cinematic = useCameraStore((s) => s.cinematic);
  const drop = useDropClosed();
  const t = useT();
  const label = dropLabel(useLocale());
  const max = Math.max(0, ...sale.values());
  const shown = (max > 0 || drop) && !loading && !cinematic;

  useEffect(() => {
    const html = document.documentElement;
    if (shown) html.dataset.wzSale = "";
    else delete html.dataset.wzSale;
    return () => delete html.dataset.wzSale;
  }, [shown]);

  if (!max && !drop) return null;
  const items = Array.from({ length: REPEAT }, (_, i) => (
    <span key={i} className="wz-sale-item">
      {drop ? (
        <>
          Sale drop <b>{label}</b>
        </>
      ) : (
        <>
          Sale <b>{t("sale.upTo", { pct: max })}</b>
        </>
      )}
      <span aria-hidden className="wz-sale-dot" />
    </span>
  ));

  return (
    <div className="wz-sale-banner" data-shown={shown || undefined} role="status" aria-label={drop ? t("sale.dropAria", { date: label }) : t("sale.aria", { pct: max })}>
      <div className="wz-sale-track" aria-hidden>
        <div className="wz-sale-run">{items}</div>
        <div className="wz-sale-run">{items}</div>
      </div>
    </div>
  );
}
