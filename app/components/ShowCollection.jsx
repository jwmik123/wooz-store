"use client";
import React from "react";
import collectionStore from "../stores/collectionStore";

export default function ShowCollection() {
  const selectedCollection = collectionStore(
    (state) => state.selectedCollection
  );
  const shopifyProducts = collectionStore((state) => state.shopifyProducts);
  return (
    <div className="absolute top-0 right-0 p-4 bg-white bg-opacity-75">
      {selectedCollection ? (
        <h1>Selected Collection: {selectedCollection} Jalla</h1>
      ) : (
        <h1>No Collection Selected</h1>
      )}
    </div>
  );
}
