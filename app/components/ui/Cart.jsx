import React from "react";
import { ShoppingCart } from "lucide-react";
import collectionStore from "../../stores/collectionStore";
import useCheckoutStore from "../../stores/checkoutStore";
const Cart = () => {
  const { setSidebarOpen, setCartOpen } = collectionStore();
  const { checkout } = useCheckoutStore();

  return (
    <div
      className="absolute flex items-center gap-1 p-2 -translate-x-1/2 bg-white rounded-lg cursor-pointer text-primary top-4 left-1/2"
      onClick={() => {
        setSidebarOpen(true);
        setCartOpen(true);
      }}
    >
      <ShoppingCart width={20} height={20} />
      {checkout && (
        <span className="absolute -top-3 -right-3 px-2.5 py-1 text-xs text-white bg-red-500 rounded-full">
          {checkout.lineItems.length}
        </span>
      )}
    </div>
  );
};

export default Cart;
