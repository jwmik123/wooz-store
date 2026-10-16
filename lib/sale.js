"use client";

import { useEffect, useState } from "react";
import client from "@/lib/shopify";

/*
 * Sale = Shopify's compareAtPrice. Price something down in Shopify (set a
 * compare-at price above the price) and the UI picks it up automatically:
 * strike-through prices in the shop panel + bag, and "Sale" tags on the racks.
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

/** Set of rack/product handles that have at least one discounted variant. */
export function useSaleHandles() {
  const [handles, setHandles] = useState(() => cache ?? new Set());
  useEffect(() => {
    if (cache) return;
    let alive = true;
    Promise.all(
      RACK_HANDLES.map((handle) =>
        client
          .request(SALE_QUERY, { variables: { handle } })
          .then(({ data }) =>
            (data?.product?.variants?.edges ?? []).some(
              ({ node }) => discountPercent(node.price, node.compareAtPrice) > 0
            )
              ? handle
              : null
          )
          .catch(() => null)
      )
    ).then((res) => {
      cache = new Set(res.filter(Boolean));
      if (alive) setHandles(cache);
    });
    return () => {
      alive = false;
    };
  }, []);
  return handles;
}
