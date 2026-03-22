import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "chess",
  description: "Premium online chess with local play, Stockfish analysis, multiplayer rooms, and saved game history.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
