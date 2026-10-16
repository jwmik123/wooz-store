/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Qualities used by <Image quality> (thumbnails 50, zoom 85, default 75).
    qualities: [50, 75, 85],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
