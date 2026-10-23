import { create } from "zustand";
import { track } from "@vercel/analytics";

const collectionStore = create((set) => ({
  productHandle: null,
  setProductHandle: (handle) =>
    set((s) => {
      if (handle && handle !== s.productHandle) track("product_view", { product: handle });
      return { productHandle: handle };
    }),
  setSelectedCollection: (collection) =>
    set({ selectedCollection: collection }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCartOpen: (open) => set({ cartOpen: open }),
  setSidebarClose: () => set({ sidebarOpen: false, cameraPosition: [0, 0, 5] }),
  introScreen: true,
  setIntroScreen: (value) => set({ introScreen: value }),
  setGlobalCheckout: (checkout) => set({ globalCheckout: checkout }),
  bookVisible: false,
  setBookVisible: (bookVisible) => set({ bookVisible: bookVisible }),
}));

export default collectionStore;
