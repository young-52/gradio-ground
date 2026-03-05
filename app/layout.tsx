import "./globals.css";

import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import SWRegistration from "@/components/sw-registration";

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
  // https://github.com/gradio-app/gradio/issues/12262#issuecomment-3586472658
  return (
    <html lang="en" suppressHydrationWarning>
      <head></head>
      <body className={`${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class">
          <SWRegistration />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
