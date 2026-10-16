"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "./components/ui/Sidebar";
import Loader from "./components/loader/Loader";
import collectionStore from "./stores/collectionStore";
import PointsOfInterest from "./three/overlay/Overlay";
import Cart from "./components/ui/Cart";
import Navigation from "./components/ui/Navigation";
import cameraStore from "./stores/cameraStore";
import Menu from "./components/Menu";
import MoosChat from "./components/moos/MoosChat";
import TimeClock from "./components/ui/TimeClock";
import useSoundStore from "./stores/soundStore";
import { AlignLeft } from "lucide-react";
import CinematicOverlay from "./components/cinematic/CinematicOverlay";

// WebGPU scene is client-only (three/webgpu touches navigator.gpu / canvas).
const Scene = dynamic(() => import("./three/v2/Scene"), { ssr: false });

export default function Home() {
  const introScreen = collectionStore((state) => state.introScreen);

  const [isNavOpen, setIsNavOpen] = useState(false);
  const [openModel, setOpenModel] = useState(false);
  // The chip mirrors the store, so "Step inside without sound" shows as muted.
  const soundOn = useSoundStore((s) => s.isSoundEnabled);
  const setSoundOn = (on) => useSoundStore.getState().setSoundEnabled(on);

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

  const handleCloseBook = () => {
    setBookVisible(false);
    resetCamera(introScreen);
  };

  return (
    <main className="h-[100dvh] max-h-[100dvh] overflow-hidden">
      <div className="fixed z-wz-chrome flex items-center gap-1 p-1 rounded-full top-4 left-4 wz-glass-chip text-ink">
        <button
          type="button"
          className="flex items-center h-8 gap-2 pl-2.5 pr-3.5 rounded-full transition-colors duration-wz-fast hover:bg-ink/5 wz-focus"
          aria-expanded={isNavOpen}
          onClick={() => {
            setIsNavOpen(!isNavOpen);
            setOpenModel(false);
          }}
        >
          <AlignLeft className="w-[18px] h-[18px]" strokeWidth={1.75} />
          <span className="text-xs font-semibold tracking-wide">Menu</span>
        </button>
        <span className="w-px h-4 bg-ink/10" aria-hidden />
        <button
          type="button"
          aria-label={soundOn ? "Mute sound" : "Turn sound on"}
          aria-pressed={soundOn}
          className="grid h-8 px-3 rounded-full place-items-center transition-colors duration-wz-fast hover:bg-ink/5 wz-focus"
          onClick={() => {
            setSoundOn(!soundOn);
          }}
        >
          <span className="sb-cnt block overflow-hidden w-[20px]">
            <svg
              width="73"
              height="9"
              viewBox="0 0 73 9"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`stroke-[1.5] stroke-[rgb(var(--wz-ink))] ${
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
          </span>
        </button>
      </div>

      <Menu
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        openModel={openModel}
        setOpenModel={setOpenModel}
      />

      <Loader />

      {bookVisible && (
        <div
          onClick={() => handleCloseBook()}
          className="absolute z-10 flex items-center justify-center w-32 h-12 -translate-x-1/2 bg-white rounded-md cursor-pointer bottom-4 left-1/2 text-primary"
        >
          <span>close book</span>
        </div>
      )}

      <Scene />
      <Sidebar />
      <PointsOfInterest />
      <Cart />
      <Navigation />
      <MoosChat />
      <TimeClock />
      <CinematicOverlay />
    </main>
  );
}
