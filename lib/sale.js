"use client";

import { useEffect, useState } from "react";
import client from "@/lib/shopify";

/*
 * Sale = Shopify's compareAtPrice. Price something down in Shopify (set a
 * compare-at price above the price) and the UI picks it up automatically:
 * strike-through prices in the shop panel + bag, and a red "−X%" corner ribbon on
 * the signboards above the racks (app/three/v2/signs).
 */

/** Discount in whole percent, or 0 when `price` isn't below `compareAt`. */
export function discountPercent(price, compareAt) {
  const p = parseFloat(price?.amount);
  const c = parseFloat(compareAt?.amount);
  if (!(p > 0) || !(c > p)) return 0;
  return Math.round((1 - p / c) * 100);
}

const RACK_HANDLES = ["hoodie", "splatter", "polo", "longsleeve", "totebag"];

const SALE_QUERY = `
  query RackSale($handle: String!) {
    product(handle: $handle) {
      variants(first: 100) {
        edges { node { price { amount } compareAtPrice { amount } } }
      }
    }
  }
`;

let cache = null;

/**
 * Map of rack/product handle -> max discount in whole percent, for handles with
 * at least one discounted variant (so `.has(handle)` still reads "on sale").
 */
export function useSaleHandles() {
  const [handles, setHandles] = useState(() => cache ?? new Map());
  useEffect(() => {
    if (cache) return;
    let alive = true;
    Promise.all(
      RACK_HANDLES.map((handle) =>
        client
          .request(SALE_QUERY, { variables: { handle } })
          .then(({ data }) => {
            const max = Math.max(
              0,
              ...(data?.product?.variants?.edges ?? []).map(({ node }) =>
                discountPercent(node.price, node.compareAtPrice)
              )
            );
            return max > 0 ? [handle, max] : null;
          })
          .catch(() => null)
      )
    ).then((res) => {
      cache = new Map(res.filter(Boolean));
      if (alive) setHandles(cache);
    });
    return () => {
      alive = false;
    };
  }, []);
  return handles;
}
