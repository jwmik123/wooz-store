"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
    }
    createCheckout();
  }, [productHandle, setProduct, setCheckout]);

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
      {/* {checkout && checkout.webUrl && (
        <button
          onClick={() => (window.location.href = checkout.webUrl)}
          className="p-4 mt-4 text-white bg-green-500"
        >
          Complete Checkout
        </button>
      )} */}
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

  const [loading, setLoading] = useState(true);

  return (
    <div className="relative">
      <div className="relative flex flex-col items-center w-full space-y-4 font-libre">
        {/* {product.variants.map((variant) => (
          <Link
            key={variant.id}
            rel="preload"
            as="image"
            className="hidden"
            href={variant.image.src}
          ></Link>
        ))} */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin"></div>
          </div>
        )}
        <Image
          src={
            selectedColor
              ? product.variants.find(
                  (variant) =>
                    variant.selectedOptions.find((opt) => opt.name === "Color")
                      ?.value === selectedColor
                )?.image.src
              : "https://cdn.shopify.com/s/files/1/0586/5727/6113/files/IMG_1197.jpg?v=1702159234"
          }
          alt={product.title}
          className="object-contain w-[90%]"
          quality={75}
          height={500}
          width={500}
          placeholder="empty"
          priority
          onLoadingComplete={() => setLoading(false)}
        />
        <h2 className="text-3xl font-libre">{product.title}</h2>
        <h3 className="text-xl font-bold text-green-800">
          €{product.variants[0].price.amount.replace("$", "")}0
        </h3>
        {/* Color selection */}
        <div className="w-full px-10">
          <label htmlFor="color" className="text-xs font-light">
            Color: {selectedColor}
          </label>
          <div className="flex mt-1 space-x-4">
            {colors.map((color) => {
              const colorClass = {
                Black: "bg-black",
                "Light grey": "bg-light-grey",
                Green: "bg-green-300",
                Navy: "bg-navy",
                White: "bg-white",
                "Ice Blue": "bg-blue-300",
              }[color];

              const selectedColorClass =
                selectedColor === color ? colorClass : `${colorClass}`;
              return (
                <label key={color} className={`flex items-center`}>
                  <input
                    type="radio"
                    name="color"
                    value={color}
                    checked={selectedColor === color}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="hidden"
                  />
                  <span
                    className={`p-4 border-2 cursor-pointer ${selectedColorClass} hover:border-green-800 ${
                      selectedColor === color ? "border-green-800" : ""
                    }`}
                  ></span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Size selection */}
        <div className="w-full px-10">
          <label htmlFor="size" className="text-xs font-light">
            Size: {selectedSize}
          </label>
          <div className="grid w-full grid-cols-2 gap-2 mt-1">
            {sizes.map((size) => (
              <label key={size} className="w-full">
                <input
                  type="radio"
                  name="size"
                  value={size}
                  checked={selectedSize === size}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="hidden"
                />
                <span
                  className={`block w-full p-2 border-2 cursor-pointer hover:border-green-800 ${
                    selectedSize === size ? "border-green-800" : ""
                  }`}
                >
                  {size}
                </span>
              </label>
            ))}
          </div>
          <div className="my-24">
            <h3 className="text-lg font-bold">Description:</h3>
            <p className="text-sm">{product.description}</p>
          </div>
        </div>
      </div>
      {/* Add to cart button */}
      <div className="sticky bottom-0 w-full p-5">
        <button
          onClick={handleAddToCart}
          className={`w-full text-white bg-green-800 p-4 font-libre text-lg ${
            !selectedColor || !selectedSize
              ? "opacity-50 cursor-not-allowed"
              : ""
          }`}
          disabled={!selectedColor || !selectedSize}
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}
