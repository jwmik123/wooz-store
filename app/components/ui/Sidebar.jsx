"use client";

import ProductsClientComponent from "../../products/ProductsClient";
import collectionStore from "../../stores/collectionStore";

export const Sidebar = () => {
  const { sidebarOpen, setSidebarOpen, setSidebarClose } = collectionStore();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <>
      {sidebarOpen && (
        <div className="absolute top-0 right-0 w-[450px] h-full overflow-y-scroll overflow-x-hidden bg-white">
          <ProductsClientComponent />
          <div className="sidebar-close" onClick={setSidebarClose}>
            <p className="text-black cursor-pointer">Close</p>
          </div>
        </div>
      )}
    </>
  );
};
