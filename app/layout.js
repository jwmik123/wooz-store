import { Inter } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";
import { ToastContainer } from "react-toastify";
import Sound from "./components/Sound";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Wooz Experience Store",
  description: "A 3D webshop experience for the Wooz collection",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head />
      <body className={inter.className}>
        <Sound />
        <GoogleAnalytics gaId="G-TDKEGF7JZ2" />
        {children}
        <ToastContainer position="bottom-left" />
      </body>
    </html>
  );
}
