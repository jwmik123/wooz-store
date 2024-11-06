"use client";

import Experience from "./three/Experience";
import { Sidebar } from "./components/ui/Sidebar";
import { useState } from "react";
import IntroScreen from "./components/ui/IntroScreen";

export default function Home() {
  const [isIntroVisible, setIsIntroVisible] = useState(true);

  return (
    <main className="h-screen">
      <IntroScreen onEnterWorld={() => setIsIntroVisible(false)} />
      <Experience />
      <Sidebar />
    </main>
  );
}
