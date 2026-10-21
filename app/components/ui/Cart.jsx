"use client";

import { ShoppingBag } from "lucide-react";
import collectionStore from "../../stores/collectionStore";
import useCartCount from "./useCartCount";

/** Floating bag button (top centre) — opens the panel on the bag view. */
const Cart = () => {
  const setSidebarOpen = collectionStore((s) => s.setSidebarOpen);
  const setCartOpen = collectionStore((s) => s.setCartOpen);
  const count = useCartCount();

  return (
    <button
      type="button"
      aria-label={`Open bag, ${count} item${count === 1 ? "" : "s"}`}
      className="fixed z-wz-chrome flex items-center gap-2 h-10 pl-3.5 pr-2 rounded-full top-[calc(var(--wz-banner-h)+1rem)] right-4 md:right-auto md:left-1/2 md:-translate-x-1/2 wz-glass-chip text-ink wz-focus transition-transform duration-wz-fast ease-wz-out hover:scale-[1.03] active:scale-[0.97]"
      onClick={() => {
        setCartOpen(true);
        setSidebarOpen(true);
      }}
    >
      <ShoppingBag className="w-[17px] h-[17px]" strokeWidth={1.75} />
      <span className="text-xs font-semibold tracking-wide">Bag</span>
      <span
        key={count}
        className={`grid place-items-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold tabular-nums ${
          count > 0 ? "bg-leaf text-paper wz-pop" : "bg-ink/10 text-ink-soft"
        }`}
      >
        {count}
      </span>
    </button>
  );
};

export default Cart;
