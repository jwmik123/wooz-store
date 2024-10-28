"use client";

import ProductsClientComponent from "../products/ProductsClient";
import collectionStore from "../stores/collectionStore";

export const Sidebar = () => {
  const { sidebarOpen, setSidebarOpen, setSidebarClose } = collectionStore();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <button onClick={toggleSidebar} className="toggle-button">
        {sidebarOpen ? "Close" : "Open"} Sidebar
      </button>
      {sidebarOpen && (
        <div className="absolute top-0 right-0 w-[450px] h-full bg-white">
          <div className="">
            <ProductsClientComponent />
          </div>
          <div className="sidebar-close" onClick={setSidebarClose}>
            <p className="text-black cursor-pointer">Close</p>
          </div>
        </div>
      )}
    </div>
  );
};
