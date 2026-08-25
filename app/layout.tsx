import type { Metadata } from "next";
import { Quicksand, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/components/session-provider";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "DIP Quotation System",
  description: "K.U. Nomura Thai Ltd. — DIP見積計算システム",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ja"
      className={`${quicksand.variable} ${notoSansJp.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-knt-ivory text-knt-dark">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
