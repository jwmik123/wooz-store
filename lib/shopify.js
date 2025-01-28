// import Client from "shopify-buy";
import { createStorefrontApiClient } from "@shopify/storefront-api-client";

// const client = Client.buildClient({
//   domain: process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN,
//   storefrontAccessToken:
//     process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN,
// });

const client = createStorefrontApiClient({
  storeDomain: process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN,
  apiVersion: "2024-04",
  publicAccessToken: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN,
});

export default client;
