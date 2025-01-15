"use client";
import { useEffect } from "react";
import Experience from "./three/Experience";
import { Sidebar } from "./components/ui/Sidebar";
import IntroScreen from "./components/ui/IntroScreen";
import collectionStore from "./stores/collectionStore";
import PointsOfInterest from "./three/overlay/Overlay";
import Cart from "./components/ui/Cart";
import Navigation from "./components/ui/Navigation";
import useSoundStore from "./stores/soundStore";
export default function Home() {
  const introScreen = collectionStore((state) => state.introScreen);
  useEffect(() => {
    useSoundStore.getState().playSound("ambient");
  });
  return (
    <main className="h-screen overflow-hidden">
      {introScreen && <IntroScreen />}
      <Experience />
      <Sidebar />
      <PointsOfInterest />
      <Cart />
      <Navigation />
    </main>
  );
}
