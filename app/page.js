"use client";
import Experience from "./three/Experience";
import { Sidebar } from "./components/ui/Sidebar";
import IntroScreen from "./components/ui/IntroScreen";
import collectionStore from "./stores/collectionStore";
import PointsOfInterest from "./three/overlay/Overlay";
import Cart from "./components/ui/Cart";
export default function Home() {
  const introScreen = collectionStore((state) => state.introScreen);

  return (
    <main className="h-screen">
      {introScreen && <IntroScreen />}
      <Experience />
      <Sidebar />
      <PointsOfInterest />
      <Cart />
    </main>
  );
}
