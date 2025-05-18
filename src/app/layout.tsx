import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter as per PRD suggestion
import "./globals.css";
import Layout from "@/components/Layout"; // Import the new Layout component

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Hurvesthub - Organic Farm Management",
  description: "Manage planting, inventory, sales, and finances for your organic farm.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
