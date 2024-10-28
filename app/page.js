import Experience from "./three/Experience";
import { Sidebar } from "./components/ui/Sidebar";
export default function Home() {
  return (
    <main className="h-screen">
      <Experience />
      <Sidebar />
    </main>
  );
}
