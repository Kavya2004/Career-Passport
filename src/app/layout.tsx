import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Passport - Translate Your International Credentials",
  description: "Career Passport helps you understand how your foreign education and experience translates to U.S. career opportunities.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>{children}</body>
    </html>
  );
}
