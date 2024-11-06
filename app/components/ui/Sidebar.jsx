"use client";

import { useEffect } from "react";
import ProductsClientComponent from "../../products/ProductsClient";
import collectionStore from "../../stores/collectionStore";

export const Sidebar = () => {
  const { sidebarOpen, setSidebarOpen, setProductHandle } = collectionStore();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // for testing ------------------------------------------------------------
  // useEffect(() => {
  //   setSidebarOpen(true);
  //   setProductHandle("longsleeve");
  // }, []);
  // ------------------------------------------------------------------------

  return (
    <>
      {sidebarOpen && (
        <div className="sidebar absolute top-0 right-0 w-full h-screen p-5 lg:w-1/2 xl:w-2/5 md:max-w-[650px]">
          <div className="w-full h-full overflow-x-hidden overflow-y-scroll bg-opacity-50 border rounded-lg glass border-slate-500 backdrop-blur-md scrollbar scrollbar-thumb-green-600 scrollbar-track-light-grey">
            <ProductsClientComponent />
          </div>
        </div>
      )}
    </>
  );
};
