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
        <div className="absolute top-0 right-0 w-full h-full overflow-x-hidden overflow-y-scroll bg-green-800 bg-opacity-90 md:w-1/3 scrollbar scrollbar-thumb-green-600 scrollbar-track-light-grey">
          <ProductsClientComponent />
          {/* <div className="sidebar-close" onClick={setSidebarClose}>
            <p className="text-black cursor-pointer">Close</p>
          </div> */}
        </div>
      )}
    </>
  );
};
