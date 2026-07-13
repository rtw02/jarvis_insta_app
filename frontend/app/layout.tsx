import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ryan.AI",
  description: "Personal AI dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="crt-overlay min-h-screen bg-jarvis-bg antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
