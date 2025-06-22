import "./globals.css";
import type { Metadata } from "next";
import { Syne } from "next/font/google";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const inter = Syne({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lassi",
  description: "buy nfts with lassi, I mean using USDC instead of SOL",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={cn(inter.className, "bg-black")}>
        <WalletContextProvider>
          {children}
          <Toaster />
        </WalletContextProvider>
      </body>
    </html>
  );
}
