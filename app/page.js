import ProductsClientComponent from "./products/ProductsClient";
import Experience from "./three/Experience";
import ShowCollection from "./ShowCollection";
import collectionStore from "./stores/collectionStore";

export default function Home() {
  return (
    <main className="h-screen">
      <Experience />
      <ShowCollection />
      <ProductsClientComponent />
    </main>
  );
}
