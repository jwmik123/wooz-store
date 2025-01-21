import { useEffect, useState } from "react";
import client from "@/lib/shopify";
import collectionStore from "../stores/collectionStore";
import useCheckoutStore from "../stores/checkoutStore";
import ProductDetails from "./ProductDetails";

export default function ProductsClientComponent() {
  const [product, setProduct] = useState();
  const { productHandle } = collectionStore();
  const { checkout, initializeCheckout, addToCart } = useCheckoutStore();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const product = await client.product.fetchByHandle(productHandle);
        setProduct(product);
      } catch (error) {
        console.error("Error fetching product:", error);
      }
    };

    fetchProducts();
    initializeCheckout();
  }, [productHandle, initializeCheckout]);

  if (!product) return null;

  return (
    <ProductDetails
      product={product}
      addToCart={addToCart}
      checkout={checkout}
    />
  );
}
