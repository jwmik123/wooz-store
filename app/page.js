import ProductsClientComponent from "./products/ProductsClient";
import Experience from "./three/Experience";

export default function Home() {
  return (
    <main className="h-screen">
      <Experience />
      <ProductsClientComponent />
    </main>
  );
}
