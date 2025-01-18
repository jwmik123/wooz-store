import { Inter, Libre_Baskerville } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "./components/GoogleAnalytics";

const inter = Inter({ subsets: ["latin"] });
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata = {
  title: "Wooz Store",
  description: "A 3D experience called Wooz",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <GoogleAnalytics GA_MEASUREMENT_ID="G-TDKEGF7JZ2" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
