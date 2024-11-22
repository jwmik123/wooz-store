import { create } from "zustand";

const collectionStore = create((set) => ({
  selectedCollection: null,
  setProductHandle: (handle) => set({ productHandle: handle }),
  setSelectedCollection: (collection) =>
    set({ selectedCollection: collection }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarClose: () => set({ sidebarOpen: false, cameraPosition: [0, 0, 5] }),
  introScreen: true,
  setIntroScreen: (value) => set({ introScreen: value }),
}));

export default collectionStore;
