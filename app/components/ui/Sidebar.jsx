"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import ProductsClientComponent from "../../products/ProductsClient";
import collectionStore from "../../stores/collectionStore";
import { X } from "lucide-react";
import CartList from "./CartList";

export const Sidebar = () => {
  const { sidebarOpen, setSidebarClose, setCartOpen, cartOpen } =
    collectionStore();
  const sidebarRef = useRef(null);

  const closeSidebar = () => {
    setSidebarClose();
    setTimeout(() => {
      setCartOpen(false);
    }, 500);
  };

  useEffect(() => {
    if (sidebarOpen) {
      gsap.to(sidebarRef.current, {
        x: "0%",
        duration: 0.5,
        ease: "power3.out",
      });
    } else {
      gsap.to(sidebarRef.current, {
        x: "100%",
        duration: 0.5,
        ease: "power3.in",
      });
    }
  }, [sidebarOpen]);

  return (
    <div
      ref={sidebarRef}
      className="sidebar fixed top-0 right-0 w-full h-screen lg:w-1/2 xl:w-2/5 md:max-w-[550px] bg-white transform translate-x-full"
    >
      <div className="w-full h-full overflow-x-hidden sidebar-inner">
        <div className="flex justify-end mx-10 mt-5">
          <button
            onClick={closeSidebar}
            className="flex items-center gap-1 text-primary"
          >
            <X width={20} height={20} />
          </button>
        </div>
        {cartOpen ? <CartList /> : <ProductsClientComponent />}
      </div>
    </div>
  );
};
