"use client";

import { useEffect, useState } from "react";
import collectionStore from "@/app/stores/collectionStore";
import useCheckoutStore from "@/app/stores/checkoutStore";
import { LITE_URL } from "@/app/three/v2/perf/quality";

/*
 * Links from the 3D garden to the owner's 2D storefront (shop.wooz.store, the
 * Shopify theme on the same store, so handles and variant ids match).
 *
 *   bag has items   cart permalink with ?storefront=true: the theme cart opens
 *                   with the same lines (replaces the theme cart, no doubles)
 *   product open    /products/<handle>
 *   otherwise       the storefront home
 *
 * Every link carries UTM tags (utm_content = where it was clicked), so Shopify
 * Analytics shows what the 3D site sends to the 2D shop.
 */

const BASE = LITE_URL.replace(/\/$/, "");

const variantNumber = (gid) => String(gid ?? "").split("/").pop();

export function shopUrl({ placement, handle, cart } = {}) {
  const lines = (cart?.lines?.edges ?? [])
    .map(({ node }) => ({ id: variantNumber(node?.merchandise?.id), qty: node?.quantity }))
    .filter((l) => /^\d+$/.test(l.id) && l.qty > 0);

  const url = lines.length
    ? new URL(`${BASE}/cart/${lines.map((l) => `${l.id}:${l.qty}`).join(",")}`)
    : new URL(handle ? `${BASE}/products/${encodeURIComponent(handle)}` : `${BASE}/`);

  if (lines.length) url.searchParams.set("storefront", "true");
  url.searchParams.set("utm_source", "wooz.store");
  url.searchParams.set("utm_medium", "3d");
  url.searchParams.set("utm_campaign", "switch-2d");
  if (placement) url.searchParams.set("utm_content", placement);
  return url.toString();
}

/**
 * Reactive href: follows the bag and the open product. The bag lives in
 * localStorage, so the first (server-matching) render links without it.
 */
export function useShopHref(placement, { withProduct = false } = {}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cart = useCheckoutStore((s) => (mounted ? s.cart : null));
  const handle = collectionStore((s) =>
    withProduct && s.sidebarOpen && !s.cartOpen ? s.productHandle : null
  );
  return shopUrl({ placement, handle, cart });
}
