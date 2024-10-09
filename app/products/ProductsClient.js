"use client";

import { useEffect, useState } from "react";
import client from "@/lib/shopify";

export default function ProductsClientComponent() {
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    async function fetchProducts() {
      const products = await client.product.fetchAll();
      setProducts(products);
    }

    async function fetchCollections() {
      const collections = await client.collection
        .fetchAllWithProducts()
        .then((collections) => {
          return collections;
        });
      setCollections(collections);
    }

    fetchProducts();
    fetchCollections();
  }, []);

  return (
    <div>
      {collections.map((collection) => (
        <div key={collection.id}>
          <h2 className="text-2xl font-bold">{collection.title}</h2>
          {collection.products.map((product) => (
            <div key={product.id}>
              <h3>{product.title}</h3>
              {/* <img src={product.images[0].src} alt={product.title} /> */}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
