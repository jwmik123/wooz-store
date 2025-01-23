import { Inter } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";
import { ToastContainer } from "react-toastify";
import Sound from "./components/Sound";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "WOOZ Experience",
  description: "A 3D webshop experience for the Wooz collection",

  // Basic metadata
  keywords:
    "WOOZ, 3D webshop, fashion, sustainable, sustainability, collection, virtual shopping, e-commerce, Dutch, Dutch fashion, Dutch sustainable fashion, Dutch sustainable",
  author: "WOOZ",
  viewport: "width=device-width, initial-scale=1",
  robots: "index, follow",
  language: "en",

  // Open Graph metadata for social sharing
  openGraph: {
    title: "WOOZ Experience",
    description: "A 3D webshop experience for the Wooz collection",
    type: "website",
    url: "https://wooz.store/",
    site_name: "WOOZ",
    images: [
      {
        url: "/assets/coverimage.png",
        width: 1200,
        height: 630,
        alt: "WOOZ Experience Preview",
      },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, width=device-width, user-scalable=no"
        />
      </head>
      <body className={inter.className}>
        <Sound />
        <GoogleAnalytics gaId="G-TDKEGF7JZ2" />
        {children}
        <ToastContainer position="bottom-left" />
      </body>
    </html>
  );
}
