import "./globals.css";

import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import SWRegistration from "./sw-registration";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GradioGround",
  description: "An editor for Gradio apps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://gradio-lite-2026.s3.ap-southeast-2.amazonaws.com/lite.css"
        />
        <script
          src="https://gradio-lite-2026.s3.ap-southeast-2.amazonaws.com/lite.js"
          type="module"
          crossOrigin="anonymous"
        />
      </head>
      <body className={`${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class">
          <SWRegistration />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
