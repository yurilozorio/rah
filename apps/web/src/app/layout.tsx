import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchStrapi, normalizeSingle } from "@/lib/strapi";

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"]
});

const displayFont = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Rayssa Lozorio",
  description: "Estética que realça sua beleza natural"
};

type HomeContent = {
  siteName?: string;
  heroCtaLabel?: string;
  heroCtaLink?: string;
};

type ContactContent = {
  whatsapp?: string;
  address?: string;
  footerNote?: string;
  paymentMethodsText?: string;
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const homeResponse = await fetchStrapi<{ id: number; attributes: HomeContent }>("/api/home");
  const contactResponse = await fetchStrapi<{ id: number; attributes: ContactContent }>("/api/contact");
  const home = normalizeSingle(homeResponse.data);
  const contact = normalizeSingle(contactResponse.data);

  return (
    <html lang="pt-BR">
      <body className={`${bodyFont.variable} ${displayFont.variable} font-sans antialiased`}>
        <div className="flex min-h-screen flex-col">
          <SiteHeader siteName={home?.siteName} ctaLabel={home?.heroCtaLabel} ctaLink={home?.heroCtaLink} />
          <main className="flex-1">{children}</main>
          <SiteFooter siteName={home?.siteName} contact={contact} />
        </div>
      </body>
    </html>
  );
}
