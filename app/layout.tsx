import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tegami.avapp.in"),
  title: "Tegami",
  description: "Find what's available nearby — instantly.",
  openGraph: {
    title: "Tegami",
    description: "Find what's available nearby — instantly.",
    url: "https://tegami.avapp.in",
    siteName: "Tegami",
    type: "website",
  },
};

import { GoogleOAuthProvider } from "@react-oauth/google";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-inter antialiased bg-[#F5F5F5]`}>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
          {children}
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}