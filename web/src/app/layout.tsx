import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./premium.css";
import { SpaceEntryTransition } from "@/components/SpaceEntryTransition";

export const metadata: Metadata = {
  title: "Orbi — Virtual FSOC System",
  description:
    "Software-in-the-loop optical communication testing with the Scintilla event-based detection and control pipeline.",
  applicationName: "Orbi",
};

export const viewport: Viewport = {
  themeColor: "#fbfcff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><SpaceEntryTransition>{children}</SpaceEntryTransition></body>
    </html>
  );
}
