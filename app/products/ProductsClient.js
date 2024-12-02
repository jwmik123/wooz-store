import { useEffect, useState } from "react";
import Image from "next/image";
import client from "@/lib/shopify";
import collectionStore from "../stores/collectionStore";
import useCheckoutStore from "../stores/checkoutStore";

// New function to preload images
function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = resolve;
    img.onerror = reject;
  });
}

export default function ProductsClientComponent() {
  const [product, setProduct] = useState();
  const [imagesPreloaded, setImagesPreloaded] = useState(false);
  const { productHandle } = collectionStore();
  const { checkout, initializeCheckout, addToCart } = useCheckoutStore();

  useEffect(() => {
    async function fetchAndPreloadProducts() {
      try {
        const product = await client.product.fetchByHandle(productHandle);
        setProduct(product);

        // Preload all product images in parallel
        if (product && product.images.length > 0) {
          await Promise.all(
            product.images.map((image) => preloadImage(image.src))
          );
          setImagesPreloaded(true);
        }
      } catch (error) {
        console.error("Error fetching or preloading:", error);
      }
    }

    fetchAndPreloadProducts();
    initializeCheckout();
  }, [productHandle, initializeCheckout]);

  return (
    <div>
      {product && (
        <ProductItem
          key={product.id}
          product={product}
          addToCart={addToCart}
          checkout={checkout}
          imagesPreloaded={imagesPreloaded}
        />
      )}
    </div>
  );
}

function ProductItem({ product, addToCart, imagesPreloaded }) {
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedImage, setSelectedImage] = useState(product.images[0].src);
  const [loading, setLoading] = useState(!imagesPreloaded);

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
    if (selectedColor) {
      const colorVariantImage = product.variants.find(
        (variant) =>
          variant.selectedOptions.find((opt) => opt.name === "Color")?.value ===
          selectedColor
      )?.image?.src;
      if (colorVariantImage) {
        setSelectedImage(colorVariantImage);
      }
    }
  }, [selectedColor, product.variants]);

  // Set loading to false when images are preloaded
  useEffect(() => {
    if (imagesPreloaded) {
      setLoading(false);
    }
  }, [imagesPreloaded]);

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

  return (
    <>
      <div className="relative flex flex-col w-full pt-5 space-y-4 text-primary font-inter">
        <div className="flex justify-between mx-10 mb-5 space-x-5 overflow-hidden h-[40rem]">
          <div className="h-full">
            {loading && (
              <div className="absolute top-[280px] left-[30%] flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin"></div>
              </div>
            )}
            <Image
              src={selectedImage}
              alt={product.title}
              className="object-cover w-full h-full mb-2 rounded-lg"
              quality={75}
              height={500}
              width={500}
              placeholder="empty"
              priority
              onLoad={() => setLoading(false)}
            />
          </div>
          <div className="flex flex-col w-1/5 gap-2 overflow-y-auto products-scrollbar">
            {product.images.map((image, index) => (
              <Image
                key={index}
                src={image.src}
                alt={`${product.title} thumbnail ${index + 1}`}
                className="object-cover w-full rounded-lg cursor-pointer aspect-square"
                quality={50}
                height={100}
                width={100}
                onClick={() => setSelectedImage(image.src)}
                placeholder="empty"
                priority={index < 4} // Prioritize loading first 4 thumbnails
              />
            ))}
          </div>
        </div>
        {/* Rest of the component remains the same */}
        <div className="mx-10 font-inter">
          <h2 className="mb-2 text-3xl">{product.title}</h2>
          <h3 className="text-xl font-medium text-green-500">
            €{product.variants[0].price.amount.replace("$", "")}0
          </h3>
        </div>

        {/* Color selection */}
        <div className="w-full px-10">
          <label htmlFor="color" className="text-base font-light">
            Color: {selectedColor}
          </label>
          <div className="flex mt-1 space-x-4">
            {colors.map((color) => {
              const colorClass = {
                Black: "bg-black",
                Brown: "bg-brown",
                "Dark grey/Taupe": "bg-gray-600",
                "Light grey": "bg-gray-300",
                "Light Grey Melange": "bg-gray-200",
                "Light green": "bg-[#B9BD8C]",
                Green: "bg-green-700",
                Navy: "bg-blue-900",
                Blue: "bg-blue-800",
                White: "bg-white",
                "Ice Blue": "bg-blue-300",
              }[color];

              const selectedColorClass =
                selectedColor === color
                  ? `${colorClass} border-green-500`
                  : `${colorClass} border-primary`;

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
                    className={`p-4 border-2 rounded-full cursor-pointer border-primary ${selectedColorClass} hover:border-green-500`}
                  ></span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Size selection */}
        <div className="w-full px-10">
          <label htmlFor="size" className="text-base font-light">
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
                  className={`block w-full text-center rounded-lg p-2 border-2  ${
                    isSizeAvailable(size)
                      ? "hover:border-green-500 hover:text-green-500 cursor-pointer"
                      : "cursor-not-allowed opacity-30"
                  } ${
                    selectedSize === size
                      ? "border-green-500 text-green-500"
                      : "border-primary text-primary"
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
          className={`w-full text-black font-bold transition-colors duration-200 bg-green-100 hover:text-white hover:bg-green-500 border-4 border-green-500 rounded-lg p-4 text-lg ${
            !selectedColor || !selectedSize
              ? "cursor-not-allowed opacity-50"
              : ""
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
