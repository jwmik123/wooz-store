import { useEffect, useState } from "react";

/** True while the URL hash is `#debug`. */
export default function useDebug() {
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    const check = () => setDebug(window.location.hash === "#debug");
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);
  return debug;
}
