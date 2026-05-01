import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import AccessibilityPanel from "@/components/AccessibilityPanel";
import ChatWidget from "@/components/ChatWidget";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "PantherTutor | GSU P2P Tutoring Platform",
  description:
    "Connect with fellow Georgia State University students for peer-to-peer tutoring. AI-powered matching, scheduling, and progress tracking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <a href="#main-content" className="skip-to-content">
              Skip to Content
            </a>
            <Navbar />
            <main id="main-content" style={{ paddingTop: 64 }}>{children}</main>
            <ChatWidget />
            <AccessibilityPanel />
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
