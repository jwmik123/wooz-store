"use client";

import { useEffect, useState } from "react";
import client from "@/lib/shopify";
import collectionStore from "../stores/collectionStore";

export default function ProductsClientComponent() {
  const [product, setProduct] = useState();
  const [checkout, setCheckout] = useState(null);
  const { productHandle } = collectionStore();

  useEffect(() => {
    async function fetchProducts() {
      const product = await client.product.fetchByHandle(productHandle);
      setProduct(product);
      console.log(product); // TODO: remove
    }
    fetchProducts();

    async function createCheckout() {
      const checkout = await client.checkout.create();
      setCheckout(checkout); // Correctly setting the checkout state
      console.log(checkout); // TODO: remove
    }
    createCheckout();
  }, []);

  const addToCart = async (variantId) => {
    if (!checkout) {
      console.error("No checkout available");
      return;
    }

    const lineItemsToAdd = [
      {
        variantId,
        quantity: 1,
      },
    ];

    const newCheckout = await client.checkout
      .addLineItems(checkout.id, lineItemsToAdd)
      .then((checkout) => {
        console.log("Product added to checkout:", checkout.lineItems);
        return checkout;
      });

    setCheckout(newCheckout); // Update the checkout state with the newly updated checkout
  };

  return (
    <div>
      {product && (
        <ProductItem key={product.id} product={product} addToCart={addToCart} />
      )}

      {/* Complete Checkout button */}
      {checkout && checkout.webUrl && (
        <button
          onClick={() => (window.location.href = checkout.webUrl)}
          className="p-4 mt-4 text-white bg-green-500"
        >
          Complete Checkout
        </button>
      )}
    </div>
  );
}

function ProductItem({ product, addToCart }) {
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);

  const colors = [
    ...new Set(
      product.variants
        .map((variant) => {
          const colorOption = variant.selectedOptions.find(
            (opt) => opt.name === "Color"
          );
          return colorOption ? colorOption.value : null;
        })
        .filter(Boolean)
    ),
  ];

  const sizes = [
    ...new Set(
      product.variants
        .map((variant) => {
          const sizeOption = variant.selectedOptions.find(
            (opt) => opt.name === "Size"
          );
          return sizeOption ? sizeOption.value : null;
        })
        .filter(Boolean)
    ),
  ];

  const findVariant = () => {
    return product.variants.find(
      (variant) =>
        variant.selectedOptions.find((opt) => opt.name === "Color")?.value ===
          selectedColor &&
        variant.selectedOptions.find((opt) => opt.name === "Size")?.value ===
          selectedSize
    );
  };

  const handleAddToCart = () => {
    const selectedVariant = findVariant();
    if (selectedVariant) {
      addToCart(selectedVariant.id);
    } else {
      console.error("No variant selected or variant not found");
    }
  };

  return (
    <div className="mb-6">
      <h3>{product.title}</h3>
      <img
        src={product.images[0].src}
        alt={product.title}
        className="object-cover w-48 h-48"
      />

      {/* Color selection */}
      <div>
        <label htmlFor="color">Color:</label>
        <select
          id="color"
          value={selectedColor || ""}
          onChange={(e) => setSelectedColor(e.target.value)}
          className="p-2 border"
        >
          <option value="" disabled>
            Select Color
          </option>
          {colors.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
      </div>

      {/* Size selection */}
      <div>
        <label htmlFor="size">Size:</label>
        <select
          id="size"
          value={selectedSize || ""}
          onChange={(e) => setSelectedSize(e.target.value)}
          className="p-2 border"
        >
          <option value="" disabled>
            Select Size
          </option>
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      {/* Add to cart button */}
      <button
        onClick={handleAddToCart}
        className={`p-2 mt-2 text-white bg-green-800 ${
          !selectedColor || !selectedSize ? "opacity-50 cursor-not-allowed" : ""
        }`}
        disabled={!selectedColor || !selectedSize}
      >
        Add to Cart
      </button>
    </div>
  );
}
