import React from "react";
import { ShoppingCart } from "lucide-react";

const Cart = () => {
  return (
    <div className="flex items-center gap-1 text-green-300">
      <ShoppingCart width={20} height={20} />
    </div>
  );
};

export default Cart;
