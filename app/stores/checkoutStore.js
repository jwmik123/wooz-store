import { create } from "zustand";
import client from "@/lib/shopify";

const STORAGE_KEY = "shopify_cart";

const CREATE_CART = `
  mutation CreateCart {
    cartCreate {
      cart {
        id
        checkoutUrl
        lines(first: 100) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  selectedOptions {
                    name
                    value
                  }
                  price {
                    amount
                    currencyCode
                  }
                  image {
                    url
                    altText
                  }
                  product {
                    title
                    handle
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const ADD_TO_CART = `
  mutation AddToCart($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
        lines(first: 100) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  selectedOptions {
                    name
                    value
                  }
                  price {
                    amount
                    currencyCode
                  }
                  image {
                    url
                    altText
                  }
                  product {
                    title
                    handle
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const REMOVE_FROM_CART = `
  mutation RemoveFromCart($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        id
        checkoutUrl
        lines(first: 100) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  selectedOptions {
                    name
                    value
                  }
                  price {
                    amount
                    currencyCode
                  }
                  image {
                    url
                    altText
                  }
                  product {
                    title
                    handle
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const UPDATE_CART = `
  mutation UpdateCart($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
        lines(first: 100) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  selectedOptions {
                    name
                    value
                  }
                  price {
                    amount
                    currencyCode
                  }
                  image {
                    url
                    altText
                  }
                  product {
                    title
                    handle
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const GET_CART = `
  query GetCart($cartId: ID!) {
    cart(id: $cartId) {
      id
      checkoutUrl
      lines(first: 100) {
        edges {
          node {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                selectedOptions {
                  name
                  value
                }
                price {
                  amount
                  currencyCode
                }
                image {
                  url
                  altText
                }
                product {
                  title
                  handle
                }
              }
            }
          }
        }
      }
    }
  }
`;

const getStoredCart = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
};

const useCheckoutStore = create((set, get) => ({
  cart: getStoredCart(),
  isLoading: false,
  error: null,

  initializeCart: async () => {
    try {
      const { cart } = get();
      if (cart?.id) {
        try {
          // Verify if the cart still exists and is valid
          const response = await client.request(GET_CART, {
            variables: { cartId: cart.id },
          });

          if (response.data.cart) {
            set({ cart: response.data.cart });
            return;
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      // Create a new cart
      const response = await client.request(CREATE_CART);
      const newCart = response.data.cartCreate.cart;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCart));
      set({ cart: newCart });
    } catch (error) {
      set({ error: error.message });
    }
  },

  addToCart: async (variantId) => {
    set({ isLoading: true, error: null });
    try {
      const { cart } = get();

      if (!cart?.id) {
        await get().initializeCart();
      }

      const response = await client.request(ADD_TO_CART, {
        variables: {
          cartId: get().cart.id,
          lines: [{ merchandiseId: variantId, quantity: 1 }],
        },
      });

      const updatedCart = response.data.cartLinesAdd.cart;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCart));
      set({ cart: updatedCart, isLoading: false });
      return updatedCart;
    } catch (error) {
      console.error("Error adding to cart:", error);
      if (error.message.includes("Cart not found")) {
        await get().initializeCart();
        return get().addToCart(variantId);
      }
      set({ error: error.message, isLoading: false });
    }
  },

  removeFromCart: async (lineId) => {
    set({ isLoading: true, error: null });
    try {
      const { cart } = get();
      if (!cart?.id) return;

      const response = await client.request(REMOVE_FROM_CART, {
        variables: {
          cartId: cart.id,
          lineIds: [lineId],
        },
      });

      const updatedCart = response.data.cartLinesRemove.cart;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCart));
      set({ cart: updatedCart, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateQuantity: async (lineId, quantity) => {
    set({ isLoading: true, error: null });
    try {
      const { cart } = get();
      if (!cart?.id) return;

      const response = await client.request(UPDATE_CART, {
        variables: {
          cartId: cart.id,
          lines: [{ id: lineId, quantity }],
        },
      });

      const updatedCart = response.data.cartLinesUpdate.cart;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCart));
      set({ cart: updatedCart, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  clearCart: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ cart: null });
  },
}));

export default useCheckoutStore;
