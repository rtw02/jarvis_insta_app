import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "J.A.R.V.I.S — Instagram Analyzer",
  description: "Subject identification and photo ranking system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="crt-overlay min-h-screen bg-jarvis-bg antialiased">
        {children}
      </body>
    </html>
  );
}
