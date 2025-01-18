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
  const bookVisible = collectionStore((state) => state.bookVisible);
  const setBookVisible = collectionStore((state) => state.setBookVisible);

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

  const handleCloseBook = () => {
    setBookVisible(false);
    resetCamera(introScreen);
  };

  console.log(
    "Code by: Joël Mik (https://mikdevelopment.nl)",
    "3D Design by: Kevin Schipper"
  );

  return (
    <main className="h-screen max-h-screen overflow-hidden">
      <div onClick={() => handleClose()} className="pointer-events-auto ">
        <div className="cin-top z-10 fixed top-0 left-0 w-full h-[11%] bg-black translate-y-[-100%]">
          <X className="absolute text-white cursor-pointer right-4 top-4" />
        </div>
        <div className="cin-bottom z-10 fixed bottom-0 left-0 w-full h-[11%] text-sm bg-black translate-y-[100%]">
          <div className="flex flex-col justify-center h-full ml-4 text-left text-white/40">
            <div className="">
              <span>Code by: Joël Mik </span>(
              <a href="https://joelmik.nl" className="font-bold underline">
                https://joelmik.nl
              </a>
              )
            </div>
            <div className="">
              <span>3D Design by: Kevin Schipper </span>(
              <a
                href="https://kevinschipper.com"
                className="font-bold underline"
              >
                https://kevinschipper.com
              </a>
              )
            </div>
          </div>
        </div>
      </div>

      {introScreen && <IntroScreen />}

      {bookVisible && (
        <div
          onClick={() => handleCloseBook()}
          className="absolute z-10 flex items-center justify-center w-32 h-12 -translate-x-1/2 bg-white rounded-md cursor-pointer bottom-4 left-1/2 text-primary"
        >
          <span>close book</span>
        </div>
      )}

      <Experience />
      <Sidebar />
      <PointsOfInterest />
      <Cart />
      <Navigation />
    </main>
  );
}
