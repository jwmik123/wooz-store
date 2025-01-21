import { useState } from "react";
import ProductImage from "./ProductImage";
import ProductOptions from "./ProductOptions";
import ProductDescription from "./ProductDescription";

function ProductDetails({ product, addToCart }) {
  const [selectedColor, setSelectedColor] = useState(getInitialColor(product));
  const [selectedSize, setSelectedSize] = useState(getInitialSize(product));
  const [selectedImage, setSelectedImage] = useState(product.images[0].src);

  const handleAddToCart = () => {
    const selectedVariant = findVariant(product, selectedColor, selectedSize);
    if (selectedVariant) {
      addToCart(selectedVariant.id);
    }
  };

  return (
    <div className="relative flex flex-col w-full pt-5 space-y-4 overflow-hidden text-primary font-inter">
      <ProductHeader product={product} />
      <ProductImage
        product={product}
        selectedImage={selectedImage}
        setSelectedImage={setSelectedImage}
        selectedColor={selectedColor}
      />
      <ProductOptions
        product={product}
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        setSelectedColor={setSelectedColor}
        setSelectedSize={setSelectedSize}
        onAddToCart={handleAddToCart}
      />
      <ProductDescription description={product.descriptionHtml} />
    </div>
  );
}

function ProductHeader({ product }) {
  return (
    <div className="flex items-center justify-between mx-4 md:mx-10 font-inter">
      <h2 className="mb-2 text-xl font-bold md:text-2xl">{product.title}</h2>
      <h3 className="text-xl font-medium text-black">
        €{product.variants[0].price.amount.replace("$", "")}0
      </h3>
    </div>
  );
}
