"use client";

import Image from "next/image";
import { Plus, Minus, Trash2 } from "lucide-react";
import useCheckoutStore from "../../stores/checkoutStore";
import { formatPrice } from "./tokens";

function EmptySmiley() {
  return (
    <svg viewBox="0 0 120 120" className="w-28 h-28" aria-hidden>
      <circle cx="60" cy="60" r="56" fill="rgb(var(--wz-mint))" />
      <circle cx="44" cy="50" r="6" fill="rgb(var(--wz-leaf))" />
      <circle cx="76" cy="50" r="6" fill="rgb(var(--wz-leaf))" />
      <path
        d="M34 70 Q60 96 86 70"
        fill="none"
        stroke="rgb(var(--wz-leaf))"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

const CartList = ({ onClose }) => {
  const cart = useCheckoutStore((s) => s.cart);
  const isLoading = useCheckoutStore((s) => s.isLoading);
  const updateQuantity = useCheckoutStore((s) => s.updateQuantity);
  const removeFromCart = useCheckoutStore((s) => s.removeFromCart);
  const clearCart = useCheckoutStore((s) => s.clearCart);

  const lines = cart?.lines?.edges || [];

  if (!lines.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 px-8 pb-16 text-center">
        <EmptySmiley />
        <div className="flex flex-col gap-2">
          <h2 className="wz-display text-wz-xl text-ink">Your bag is still empty</h2>
          <p className="text-wz-sm text-ink-soft max-w-[18rem] mx-auto">
            Wander through the studio and tap a clothing rack to find something that makes you smile.
          </p>
        </div>
        <button type="button" onClick={onClose} className="h-12 px-6 mt-2 wz-btn-primary text-wz-sm">
          Explore the studio
        </button>
      </div>
    );
  }

  const currency = lines[0]?.node.merchandise.price.currencyCode;
  const subtotal = lines.reduce(
    (total, { node }) => total + parseFloat(node.merchandise.price.amount) * node.quantity,
    0
  );
  const count = lines.reduce((n, { node }) => n + node.quantity, 0);

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-5 pt-2 pb-4 md:px-7">
        <h2 className="wz-display text-wz-display text-ink">
          Your bag <span className="text-ink-soft/70 text-wz-xl tabular-nums">({count})</span>
        </h2>
      </div>

      <ul className="flex flex-col gap-2 px-3 md:px-4" aria-busy={isLoading}>
        {lines.map(({ node }) => {
          const color = node.merchandise?.selectedOptions?.find((o) => o.name === "Color")?.value;
          const size = node.merchandise?.selectedOptions?.find((o) => o.name === "Size")?.value;
          const title = node.merchandise.product.title;
          return (
            <li
              key={node.id}
              className="flex items-center gap-4 p-2.5 pr-3 rounded-wz-md bg-paper/60 shadow-wz-sm"
            >
              <div className="relative w-20 h-24 overflow-hidden shrink-0 rounded-wz-sm bg-cloud">
                {node.merchandise.image?.url && (
                  <Image
                    src={node.merchandise.image.url}
                    alt={title}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex flex-col flex-1 min-w-0 gap-1">
                <h3 className="text-sm font-semibold leading-snug text-ink line-clamp-2">{title}</h3>
                <p className="text-xs text-ink-soft">{[color, size].filter(Boolean).join(" · ")}</p>
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <div className="flex items-center h-9 rounded-full shadow-[inset_0_0_0_1px_var(--wz-line-strong)]">
                    <button
                      type="button"
                      className="w-9 h-9 wz-icon-btn"
                      onClick={() =>
                        node.quantity === 1
                          ? removeFromCart(node.id)
                          : updateQuantity(node.id, node.quantity - 1)
                      }
                      aria-label={node.quantity === 1 ? `Remove ${title}` : `Decrease quantity of ${title}`}
                    >
                      {node.quantity === 1 ? (
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                      ) : (
                        <Minus className="w-3.5 h-3.5" strokeWidth={2} />
                      )}
                    </button>
                    <span className="w-5 text-sm font-semibold text-center tabular-nums" aria-live="polite">
                      {node.quantity}
                    </span>
                    <button
                      type="button"
                      className="w-9 h-9 wz-icon-btn"
                      onClick={() => updateQuantity(node.id, node.quantity + 1)}
                      aria-label={`Increase quantity of ${title}`}
                    >
                      <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                  <span className="flex flex-col items-end font-display tabular-nums text-ink">
                    {parseFloat(node.merchandise.compareAtPrice?.amount) >
                      parseFloat(node.merchandise.price.amount) && (
                      <s className="text-xs text-ink-soft">
                        {formatPrice(
                          parseFloat(node.merchandise.compareAtPrice.amount) * node.quantity,
                          node.merchandise.price.currencyCode
                        )}
                      </s>
                    )}
                    {formatPrice(
                      parseFloat(node.merchandise.price.amount) * node.quantity,
                      node.merchandise.price.currencyCode
                    )}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 px-3 pt-6 pb-3 mt-auto md:px-4 md:pb-4 bg-gradient-to-t from-paper via-paper/90 to-transparent">
        <div className="flex items-baseline justify-between px-2 mb-3">
          <span className="wz-eyebrow">Subtotal</span>
          <span className="text-xl font-display tabular-nums text-ink">
            {formatPrice(subtotal, currency)}
          </span>
        </div>
        <p className="px-2 mb-3 text-xs text-ink-soft">Shipping & taxes calculated at checkout.</p>
        <button
          type="button"
          className="w-full h-14 wz-btn-primary text-wz-base"
          onClick={() => {
            window.location.href = cart.checkoutUrl;
            clearCart();
          }}
        >
          Checkout
        </button>
      </div>
    </div>
  );
};

export default CartList;
