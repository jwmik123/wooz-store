import React from "react";
import useCheckoutStore from "../../stores/checkoutStore";
import Image from "next/image";

const CartList = () => {
  const { checkout, updateQuantity, removeFromCart } = useCheckoutStore();

  if (!checkout || !checkout.lineItems.length) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <p className="text-xl text-gray-500">Your cart is empty</p>
      </div>
    );
  }

  return (
    <div className="p-5">
      <h2 className="mb-6 text-2xl font-bold text-primary">Your Cart</h2>
      <div className="flex flex-col gap-4 divide-y divide-gray-200">
        {checkout.lineItems.map((item) => {
          const colorOption = item.variant.selectedOptions.find(
            (opt) => opt.name === "Color"
          );
          const sizeOption = item.variant.selectedOptions.find(
            (opt) => opt.name === "Size"
          );

          return (
            <div key={item.id} className="flex items-center p-4 ">
              <Image
                src={item.variant.image.src}
                alt={item.title}
                width={100}
                height={100}
                className="object-cover w-20 mr-4 rounded-lg aspect-square"
              />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-primary">
                  {item.title}
                </h3>
                <div className="mt-1 text-sm text-gray-600">
                  {colorOption && <p>Color: {colorOption.value}</p>}
                  {sizeOption && <p>Size: {sizeOption.value}</p>}
                </div>
              </div>
              <div className="text-lg font-medium text-primary">
                {item.quantity}x
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end mt-6">
        <button
          className="px-4 py-2 text-white rounded-lg bg-primary"
          onClick={() => (window.location.href = checkout.webUrl)}
        >
          Checkout
        </button>
      </div>
    </div>
  );
};

export default CartList;