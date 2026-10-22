import { Fraunces, Instrument_Sans, Lobster } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";
import { ToastContainer } from "react-toastify";
import Sound from "./components/Sound";
// Type system (see docs/UI-TOKENS.md):
// - Fraunces: soft, slightly wonky display serif for titles & numbers.
// - Instrument Sans: crisp grotesk for UI, labels and body copy.
// - Libre Baskerville (local): legacy serif used by intro + menu modal.
const display = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  style: ["normal", "italic"],
  variable: "--wz-font-display",
  display: "swap",
});
const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--wz-font-sans",
  display: "swap",
});
// Lobster: fat retro script for the 3D "Sale" marquee sign (drawn to a canvas
// texture by app/three/v2/garden/SaleSign.jsx, which reads --wz-font-sign).
const signScript = Lobster({
  subsets: ["latin"],
  weight: "400",
  variable: "--wz-font-sign",
  display: "swap",
  preload: false,
});
const libre = localFont({
  src: [
    { path: "../public/assets/fonts/libre-reg.ttf", weight: "400", style: "normal" },
    { path: "../public/assets/fonts/libre-italic.ttf", weight: "400", style: "italic" },
    { path: "../public/assets/fonts/libre-bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--wz-font-libre",
  display: "swap",
});

export const metadata = {
  // Resolves the relative OG / Twitter image URLs below.
  metadataBase: new URL("https://wooz.store"),
  title: "WOOZ Experience",
  description: "A 3D webshop experience for the Wooz collection",

  // Basic metadata
  keywords:
    "WOOZ, 3D webshop, fashion, sustainable, sustainability, collection, virtual shopping, e-commerce, Dutch, Dutch fashion, Dutch sustainable fashion, Dutch sustainable",
  author: "WOOZ",
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
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${libre.variable} ${signScript.variable}`}
    >
      <head>
        <meta
          name="viewport"
          content="initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, width=device-width, user-scalable=no"
        />
      </head>
      <body className="font-sans antialiased">
        <Sound />
        <GoogleAnalytics gaId="G-TDKEGF7JZ2" />
        {children}
        <ToastContainer position="bottom-left" />
      </body>
    </html>
  );
}
