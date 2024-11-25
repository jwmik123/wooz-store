"use client";

import { useEffect } from "react";
import ProductsClientComponent from "../../products/ProductsClient";
import collectionStore from "../../stores/collectionStore";
import { Undo2, X } from "lucide-react";
export const Sidebar = () => {
  const { sidebarOpen, setSidebarClose } = collectionStore();

  const closeSidebar = () => {
    setSidebarClose();
  };

  // for testing ------------------------------------------------------------
  // useEffect(() => {
  //   setSidebarOpen(true);
  //   setProductHandle("longsleeve");
  // }, []);
  // ------------------------------------------------------------------------
  // scrollbar scrollbar-thumb-green-600 scrollbar-track-light-grey
  return (
    <>
      {sidebarOpen && (
        <div className="sidebar absolute top-0 right-0 w-full h-screen  lg:w-1/2 xl:w-2/5 md:max-w-[650px]">
          {/* <div className="w-full h-full overflow-x-hidden bg-opacity-50 border rounded-lg sidebar-inner glass border-slate-500 backdrop-blur-md"> */}
          <div className="w-full h-full overflow-x-hidden bg-white sidebar-inner ">
            <div className="flex justify-end mx-10 mt-5">
              <button
                onClick={closeSidebar}
                className="flex items-center gap-1 text-primary"
              >
                {/* <span className="text-base">Go back</span> */}
                <X width={20} height={20} />
              </button>
            </div>
            <ProductsClientComponent />
          </div>
        </div>
      )}
    </>
  );
};
