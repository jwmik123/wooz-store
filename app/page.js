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
import cameraStore from "./stores/cameraStore";
import gsap from "gsap";
import { X } from "lucide-react";

export default function Home() {
  const introScreen = collectionStore((state) => state.introScreen);
  useEffect(() => {
    useSoundStore.getState().playSound("ambient");
  });

  const cinematic = cameraStore((state) => state.cinematic);
  const setCinematic = cameraStore((state) => state.setCinematic);
  const resetCamera = cameraStore((state) => state.resetCamera);

  useEffect(() => {
    if (cinematic) {
      gsap.to(".cin-top", {
        duration: 1,
        ease: "power1.inOut",
        y: "0%",
      });
      gsap.to(".cin-bottom", {
        duration: 1,
        ease: "power1.inOut",
        y: "0%",
      });
    } else {
      gsap.to(".cin-top", {
        duration: 1,
        ease: "power1.inOut",
        y: "-100%",
      });
      gsap.to(".cin-bottom", {
        duration: 1,
        ease: "power1.inOut",
        y: "100%",
      });
    }
  }, [cinematic]);

  const handleClose = () => {
    setCinematic(false);
    resetCamera(introScreen);
  };

  return (
    <main className="h-screen max-h-screen overflow-hidden">
      <div onClick={() => handleClose()} className="pointer-events-auto ">
        <div className="cin-top z-10 fixed top-0 left-0 w-full h-[13%] bg-black translate-y-[-100%]">
          <X className="absolute text-white cursor-pointer right-4 top-4" />
        </div>
        <div className="cin-bottom z-10 fixed bottom-0 left-0 w-full h-[13%] bg-black translate-y-[100%]"></div>
      </div>

      {introScreen && <IntroScreen />}
      <Experience />
      <Sidebar />
      <PointsOfInterest />
      <Cart />
      <Navigation />
    </main>
  );
}
