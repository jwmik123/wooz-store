// stores/checkoutStore.js
import { create } from "zustand";
import client from "@/lib/shopify";

const STORAGE_KEY = "shopify_checkout";

const getStoredCheckout = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
};

const useCheckoutStore = create((set, get) => ({
  checkout: getStoredCheckout(),
  isLoading: false,
  error: null,

  initializeCheckout: async () => {
    try {
      const { checkout } = get();
      if (checkout) {
        try {
          const currentCheckout = await client.checkout.fetch(checkout.id);

          // if the checkout is empty or completed, create a new one
          if (
            currentCheckout.completedAt ||
            currentCheckout.lineItems.length === 0
          ) {
            throw new Error("Checkout expired or empty");
          }
          return;
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      // Create a new checkout
      const newCheckout = await client.checkout.create();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCheckout));
      set({ checkout: newCheckout });
    } catch (error) {
      set({ error: error.message });
    }
  },

  addToCart: async (variantId) => {
    set({ isLoading: true, error: null });
    try {
      const { checkout } = get();

      if (!checkout) {
        await get().initializeCheckout();
      }

      const currentCheckout = await client.checkout.fetch(get().checkout.id);
      const lineItemsToAdd = [{ variantId, quantity: 1 }];

      const newCheckout = await client.checkout.addLineItems(
        currentCheckout.id,
        lineItemsToAdd
      );

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCheckout));
      set({ checkout: newCheckout, isLoading: false });
      return newCheckout;
    } catch (error) {
      console.error("Error adding to cart:", error);
      // If checkout not found, reinitialize and retry
      if (error.message.includes("Checkout not found")) {
        await get().initializeCheckout();
        return get().addToCart(variantId);
      }
      set({ error: error.message, isLoading: false });
    }
  },

  removeFromCart: async (lineItemId) => {
    set({ isLoading: true, error: null });
    try {
      const { checkout } = get();
      if (!checkout) return;

      const newCheckout = await client.checkout.removeLineItems(checkout.id, [
        lineItemId,
      ]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCheckout));
      set({ checkout: newCheckout, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateQuantity: async (lineItemId, quantity) => {
    set({ isLoading: true, error: null });
    try {
      const { checkout } = get();
      if (!checkout) return;

      const newCheckout = await client.checkout.updateLineItems(checkout.id, [
        {
          id: lineItemId,
          quantity,
        },
      ]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCheckout));
      set({ checkout: newCheckout, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  clearCheckout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ checkout: null });
  },
}));

export default useCheckoutStore;
