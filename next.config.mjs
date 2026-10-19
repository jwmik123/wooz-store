/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Shopify's CDN does the resizing; see lib/shopifyImageLoader.js.
    loader: 'custom',
    loaderFile: './lib/shopifyImageLoader.js',
  },
};

export default nextConfig;
