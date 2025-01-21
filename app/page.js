"use client";
import { useEffect, useState, useRef } from "react";
import Experience from "./three/Experience";
import { Sidebar } from "./components/ui/Sidebar";
import IntroScreen from "./components/ui/IntroScreen";
import collectionStore from "./stores/collectionStore";
import PointsOfInterest from "./three/overlay/Overlay";
import Cart from "./components/ui/Cart";
import Navigation from "./components/ui/Navigation";
import cameraStore from "./stores/cameraStore";
import Menu from "./components/Menu";
import useSoundStore from "./stores/soundStore";
import gsap from "gsap";
import { X, AlignLeft } from "lucide-react";

export default function Home() {
  const introScreen = collectionStore((state) => state.introScreen);

  const [isNavOpen, setIsNavOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const { setSoundEnabled } = useSoundStore();

  const cinematic = cameraStore((state) => state.cinematic);
  const setCinematic = cameraStore((state) => state.setCinematic);
  const resetCamera = cameraStore((state) => state.resetCamera);
  const bookVisible = collectionStore((state) => state.bookVisible);
  const setBookVisible = collectionStore((state) => state.setBookVisible);

  useEffect(() => {
    // Initialize sound store
    useSoundStore.getState().initialize();

    return () => {
      useSoundStore.getState().cleanup();
    };
  }, []);

  // Update sound state when toggle is clicked
  useEffect(() => {
    setSoundEnabled(soundOn);
  }, [soundOn, setSoundEnabled]);

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

  return (
    <main className="h-screen max-h-screen overflow-hidden">
      <div onClick={() => handleClose()} className="pointer-events-auto ">
        <div className="cin-top z-10 fixed top-0 left-0 w-full h-[11%] bg-black translate-y-[-100%]">
          <X className="absolute text-white cursor-pointer right-4 top-4" />
        </div>
        <div className="cin-bottom z-10 fixed bottom-0 left-0 w-full h-[11%] text-sm bg-black translate-y-[100%]">
          <div className="flex flex-col justify-center h-full ml-4 text-left text-white/80">
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

      <div className="fixed z-50 flex items-center gap-10 text-white top-4 left-4">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setIsNavOpen(!isNavOpen)}
        >
          <AlignLeft className="w-8 h-8 stroke-[1.5]" />
          <span className="text-sm">Menu</span>
        </div>
        <div
          className="sb-cnt overflow-hidden w-[20px]"
          onClick={() => {
            setSoundOn(!soundOn);
          }}
        >
          <svg
            width="73"
            height="9"
            viewBox="0 0 73 9"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`cursor-pointer stroke-[1.5] stroke-white ${
              soundOn ? "animate-sound" : ""
            }`}
          >
            <g className="sound-paths" strokeMiterlimit="10">
              {soundOn ? (
                <g className="soundon">
                  <path d="M0 0.5C3.33 0.5 3.33 8.5 6.66 8.5C9.99 8.5 10 0.5 13.33 0.5C16.66 0.5 16.66 8.5 20 8.5"></path>
                  <path d="M53 0.5C56.33 0.5 56.33 8.5 59.66 8.5C62.99 8.5 63 0.5 66.33 0.5C69.66 0.5 69.66 8.5 73 8.5"></path>
                  <path d="M20 8.50008C22.5 8.50008 23 1.99994 26 1C29 5.50151e-05 29.33 6.50008 32.66 6.50008C35.99 6.50008 36 3.00008 39.33 3.00008C42.66 3.00008 42.66 8 46 8C49 7.99992 49.8 0.5 53 0.5"></path>
                </g>
              ) : (
                <path className="soundoff" d="M0 4.5L20 4.5"></path>
              )}
            </g>
          </svg>
        </div>
      </div>

      <Menu isNavOpen={isNavOpen} />

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
