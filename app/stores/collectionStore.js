import { create } from "zustand";

const collectionStore = create((set) => ({
  setProductHandle: (handle) => set({ productHandle: handle }),
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
