import type { Metadata } from "next";
import Script from "next/script";
import { Space_Grotesk, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ErrorCenter } from "@/components/shared/ErrorCenter";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/config/themes";

// Display / headings / logo — distinctive tech-startup grotesk
const fontDisplay = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
// UI / body — clean, highly legible
const fontSans = DM_Sans({ subsets: ["latin"], variable: "--font-dmsans" });
// Data / monospace / Cyber theme
const fontMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono" });

export const metadata: Metadata = {
  title: "STiDY — Your Academic Operating System",
  description:
    "STiDY unifies grades, syllabi, resources, flashcards, and focus into one intelligent command center.",
};

// Runs before paint: restores the saved theme so there's no flash of the default.
const themeBootScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* beforeInteractive: Next hoists this into <head> and runs it before
            hydration/paint, restoring the saved theme with no flash — and it
            renders via next/script, not a raw React <script> (clears the
            React 19 "script tag while rendering" console error). */}
        <Script id="theme-boot" strategy="beforeInteractive">
          {themeBootScript}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
        <ErrorCenter />
      </body>
    </html>
  );
}
