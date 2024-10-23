import { create } from "zustand";

const collectionStore = create((set) => ({
  selectedCollection: null,
  setSelectedCollection: (collection) =>
    set({ selectedCollection: collection }),
}));

export default collectionStore;
