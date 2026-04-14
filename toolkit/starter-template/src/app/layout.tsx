import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
import { SolanaProvider } from "@/components/providers/solana-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solana Starter",
  description: "A production-ready Solana dApp starter template",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <SolanaProvider>
          <QueryProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <Toaster position="bottom-right" richColors closeButton />
          </QueryProvider>
        </SolanaProvider>
      </body>
    </html>
  );
}
