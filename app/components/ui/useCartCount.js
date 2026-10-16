"use client";

import { useEffect, useState } from "react";
import useCheckoutStore from "../../stores/checkoutStore";

/**
 * Total quantity in the bag. Returns 0 until mounted: the cart is restored
 * from localStorage on the client only, so this keeps SSR and hydration equal.
 */
export default function useCartCount() {
  const [mounted, setMounted] = useState(false);
  const count = useCheckoutStore(
    (s) => s.cart?.lines?.edges?.reduce((n, { node }) => n + node.quantity, 0) || 0
  );
  useEffect(() => setMounted(true), []);
  return mounted ? count : 0;
}
