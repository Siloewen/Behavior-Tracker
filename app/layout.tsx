import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mirror",
  description: "What kind of person am I becoming?",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-base text-white antialiased">
        {children}
      </body>
    </html>
  );
}
