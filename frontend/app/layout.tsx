import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal",
  description: "Private messaging, calls, and video — Signal keeps your conversations private.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {children}
      </body>
    </html>
  );
}
