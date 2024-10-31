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
      setCheckout(checkout);
    }
    createCheckout();
  }, [productHandle, setProduct, setCheckout]);

  const addToCart = async (variantId) => {
    if (!checkout) {
      console.error("No checkout available");
      return;
    }

    const lineItemsToAdd = [{ variantId, quantity: 1 }];

    const newCheckout = await client.checkout
      .addLineItems(checkout.id, lineItemsToAdd)
      .then((checkout) => {
        console.log("Product added to checkout:", checkout.lineItems);
        return checkout;
      });

    setCheckout(newCheckout);
  };

  return (
    <div>
      {product && (
        <ProductItem
          key={product.id}
          product={product}
          addToCart={addToCart}
          checkout={checkout}
        />
      )}
      {/* {checkout && checkout.webUrl && (
        <button
          onClick={() => (window.location.href = checkout.webUrl)}
          className="p-2 text-white bg-green-500 rounded-lg"
        >
          Complete Checkout
        </button>
      )} */}
    </div>
  );
}

function ProductItem({ product, addToCart, checkout }) {
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);

  const colors = [
    ...new Set(
      product.variants
        .map(
          (variant) =>
            variant.selectedOptions.find((opt) => opt.name === "Color")?.value
        )
        .filter(Boolean)
    ),
  ];

  useEffect(() => {
    setSelectedColor(colors[0]);
  }, []);

  const sizes = [
    ...new Set(
      product.variants
        .map(
          (variant) =>
            variant.selectedOptions.find((opt) => opt.name === "Size")?.value
        )
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

  const isSizeAvailable = (size) => {
    return product.variants.some(
      (variant) =>
        variant.selectedOptions.find((opt) => opt.name === "Color")?.value ===
          selectedColor &&
        variant.selectedOptions.find((opt) => opt.name === "Size")?.value ===
          size &&
        variant.available
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
  const [selectedImage, setSelectedImage] = useState(product.images[0].src);

  return (
    <>
      <div className="relative flex flex-col w-full pt-5 space-y-4 text-green-100 font-inter">
        <div className="flex justify-between mx-10 mb-5 overflow-hidden space-x-5 h-[600px]">
          <div className="h-full">
            {loading && (
              <div className="absolute top-[280px] left-[30%] flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin"></div>
              </div>
            )}
            <Image
              src={
                selectedColor
                  ? product.variants.find(
                      (variant) =>
                        variant.selectedOptions.find(
                          (opt) => opt.name === "Color"
                        )?.value === selectedColor
                    )?.image?.src
                  : product.images[0].src
              }
              alt={product.title}
              className="object-cover w-full h-full mb-2"
              quality={75}
              height={500}
              width={500}
              placeholder="empty"
              priority
              onLoad={() => setLoading(false)}
            />
          </div>
          <div className="flex flex-col w-1/4 gap-2 overflow-x-scroll">
            {product.images.map((image, index) => (
              <Image
                key={index}
                src={image.src}
                alt={`${product.title} thumbnail ${index + 1}`}
                className="object-cover w-full cursor-pointer"
                quality={50}
                height={100}
                onClick={() => setSelectedImage(image.src)}
                width={100}
                placeholder="empty"
              />
            ))}
          </div>
        </div>
        <div className="mx-10 font-inter">
          <h2 className="text-3xl">{product.title}</h2>
          <h3 className="text-3xl font-medium text-green-500">
            €{product.variants[0].price.amount.replace("$", "")}0
          </h3>
        </div>

        {/* Color selection */}
        <div className="w-full px-10">
          <label htmlFor="color" className="text-xs font-light">
            Color: {selectedColor}
          </label>
          <div className="flex mt-1 space-x-4">
            {colors.map((color) => {
              const colorClass = {
                Black: "bg-black",
                Brown: "bg-brown",
                "Light grey": "bg-gray-300",
                Green: "bg-green-700",
                Navy: "bg-blue-900",
                Blue: "bg-blue-800",
                White: "bg-white",
                "Ice Blue": "bg-blue-300",
              }[color];

              const selectedColorClass =
                selectedColor === color
                  ? `${colorClass} border-green-100`
                  : `${colorClass} border-slate-400`;

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
                    className={`p-4 border rounded-full cursor-pointer ${selectedColorClass} hover:border-green-100`}
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
          <div className="flex w-full gap-2 mt-1">
            {sizes.map((size) => (
              <label key={size} className="w-full">
                <input
                  type="radio"
                  name="size"
                  value={size}
                  checked={selectedSize === size}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="hidden"
                  disabled={!isSizeAvailable(size)}
                />
                <span
                  className={`block w-full text-center rounded-lg p-2 border  ${
                    isSizeAvailable(size)
                      ? "hover:border-green-100 cursor-pointer"
                      : "cursor-not-allowed opacity-50"
                  } ${
                    selectedSize === size
                      ? "border-green-400"
                      : "border-green-100"
                  }`}
                >
                  {size}
                </span>
              </label>
            ))}
          </div>
          <div className="my-24">
            <h3 className="text-lg font-bold">Description:</h3>
            <p className="text-base">{product.description}</p>
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 flex items-center justify-center w-full px-5 pb-5">
        <button
          onClick={handleAddToCart}
          className={`w-full text-black transition-colors duration-200 bg-green-100 hover:bg-green-100 hover:text-green-900 rounded-lg  p-4 text-lg ${
            !selectedColor || !selectedSize ? " cursor-not-allowed" : ""
          }`}
          disabled={!selectedColor || !selectedSize}
        >
          <div className="text-center uppercase">
            {!selectedColor || !selectedSize
              ? "Select color and size"
              : "Add to Cart"}
          </div>
        </button>
      </div>
    </>
  );
}
