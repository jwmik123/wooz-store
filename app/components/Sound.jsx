"use client";
import { useEffect } from "react";
import useSoundStore from "../stores/soundStore";

export default function Sound() {
  useEffect(() => {
    // Initialize sound store
    useSoundStore.getState().initialize();
    useSoundStore.getState().setSoundEnabled(true);

    return () => {
      useSoundStore.getState().cleanup();
    };
  }, []);
}
