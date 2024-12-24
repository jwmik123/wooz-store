import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import client from "@/lib/shopify";
import collectionStore from "../stores/collectionStore";
import useCheckoutStore from "../stores/checkoutStore";
import { Canvas } from "@react-three/fiber";
import Product from "../three/Product";
import gsap from "gsap";
import { Rotate3d, Image as ImageIcon, Loader } from "lucide-react";
import { Suspense } from "react";
// New function to preload images
function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    img.onload = resolve;
    img.onerror = reject;
    img.src = src;
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

  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedImage, setSelectedImage] = useState(product.images[0].src);
  const [loading, setLoading] = useState(!imagesPreloaded);
  const [isLoaded, setIsLoaded] = useState(false);
  const [openCanvas, setOpenCanvas] = useState(true);
  const canvasRef = useRef();

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

  useEffect(() => {
    setTimeout(() => {
      setIsLoaded(true);
    }, 1500);
    if (openCanvas) {
      gsap.to(canvasRef.current, { opacity: 1, duration: 0.5 });
    }
  }, [isLoaded, openCanvas]);

  return (
    <>
      <div className="relative flex flex-col w-full pt-5 space-y-4 text-primary font-inter">
        <div className="flex items-center justify-between mx-4 md:mx-10 font-inter">
          <h2 className="mb-2 text-3xl">{product.title}</h2>
          <h3 className="text-xl font-medium text-black">
            €{product.variants[0].price.amount.replace("$", "")}0
          </h3>
        </div>
        <div className="flex flex-col relative overflow-hidden justify-between mx-4 mb-5 space-y-4 md:h-[31.3rem] md:flex-row md:mx-10 md:space-x-5 md:space-y-0">
          {openCanvas ? (
            <div
              ref={canvasRef}
              className="w-full h-[450px] md:h-full opacity-0"
            >
              <button
                className="absolute top-0 right-0 z-10 flex items-center justify-center w-12 h-12 mt-2 mr-2 bg-white rounded-md"
                onClick={() => setOpenCanvas(false)}
              >
                <ImageIcon />
              </button>
              <Suspense
                fallback={
                  <div className="flex items-center justify-center w-full h-full overflow-hidden border rounded-lg bg-primary">
                    <Loader className="animate-spin" />
                  </div>
                }
              >
                <Canvas
                  className="w-full h-full overflow-hidden border rounded-lg bg-primary"
                  camera={{ position: [0, 0, 1.3], fov: 55 }}
                >
                  <Product selectedColor={selectedColor} />
                </Canvas>
              </Suspense>
            </div>
          ) : (
            <>
              <div className="flex justify-center w-full h-full md:block md:w-auto">
                {loading && (
                  <div className="absolute top-[280px] left-1/2 md:left-[30%] transform -translate-x-1/2 flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin"></div>
                  </div>
                )}
                <div className="relative flex justify-center w-full h-full md:block md:w-auto">
                  <Image
                    src={selectedImage}
                    alt={product.title}
                    className="object-cover w-[90%] rounded-lg md:w-full"
                    quality={75}
                    height={500}
                    width={500}
                    placeholder="empty"
                    priority
                    onLoad={() => setLoading(false)}
                  />
                  <button
                    className="absolute top-0 right-0 flex items-center justify-center w-12 h-12 mt-2 mr-2 bg-white rounded-md"
                    onClick={() => setOpenCanvas(true)}
                  >
                    <Rotate3d />
                  </button>
                </div>
              </div>
              <div className="flex flex-row w-full gap-2 overflow-x-auto md:flex-col md:w-2/5 md:overflow-y-auto products-scrollbar">
                {product.images.map((image, index) => (
                  <Image
                    key={index}
                    src={image.src}
                    alt={`${product.title} thumbnail ${index + 1}`}
                    className="flex-shrink-0 object-cover w-24 rounded-lg cursor-pointer md:w-full aspect-square"
                    quality={50}
                    height={100}
                    width={100}
                    onClick={() => setSelectedImage(image.src)}
                    placeholder="empty"
                    priority={index < 4}
                  />
                ))}
              </div>
              <div className="absolute bottom-0 right-0 z-10 w-32 h-12 pointer-events-none bg-gradient-to-t from-white to-transparent"></div>
            </>
          )}
        </div>

        {/* Color selection */}
        <div className="w-full px-4 md:px-10">
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
                "Sage Green": "bg-[#B9BD8C]",
                Green: "bg-[#028370]",
                Navy: "bg-blue-900",
                Blue: "bg-blue-500",
                White: "bg-white",
                "Ice Blue": "bg-blue-500",
                Beige: "bg-[#C8C5B9]",
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
                    className={` relative p-4 shadow-inner shadow-gray-400/50 rounded-full cursor-pointer  ${selectedColorClass}] after:content-[''] ${
                      selectedColor === color
                        ? "after:absolute after:-bottom-3 after:left-[15px] after:w-1 after:h-1 after:rounded-full after:bg-primary"
                        : ""
                    }`}
                  ></span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Size selection */}
        <div className="w-full px-4 md:px-10">
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
          <button
            onClick={handleAddToCart}
            disabled={!selectedColor || !selectedSize}
            className={`w-full  bg-primary transition-colors duration-200 
              hover:bg-white hover:text-primary border border-primary 
              text-white rounded-lg mt-4 mb-6 p-4 text-lg
              ${
                !selectedColor || !selectedSize
                  ? "opacity-50 pointer-events-none"
                  : ""
              }
              `}
          >
            <div className="text-center uppercase">Add To Cart</div>
          </button>
          <div className="mb-10">
            <h3 className="text-lg font-bold">Description:</h3>
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 flex items-center justify-center w-full px-5 pb-5"></div>
    </>
  );
}
