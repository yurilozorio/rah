import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings2, Menu } from "lucide-react";

const navItems = [
  { href: "/services", label: "Serviços" },
  { href: "/about", label: "Sobre" },
  { href: "/testimonials", label: "Depoimentos" },
  { href: "/contact", label: "Contato" },
  { href: "/agenda", label: "Agenda" }
];

export const SiteHeader = ({
  siteName,
  ctaLabel,
  ctaLink
}: {
  siteName?: string;
  ctaLabel?: string;
  ctaLink?: string;
}) => {
  return (
    <header className="sticky top-0 z-50 border-b border-pink-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        {siteName ? (
          <Link href="/" className="text-xl font-semibold text-foreground font-display bg-gradient-to-r from-primary to-accent-warm bg-clip-text text-transparent">
            {siteName}
          </Link>
        ) : null}
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="animated-underline text-muted-foreground transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-pink-50 hover:text-primary"
            title="Admin"
          >
            <Settings2 className="h-5 w-5" />
          </Link>
          {ctaLabel ? (
            <Button asChild className="bg-gradient-to-r from-primary to-accent-warm text-white shadow-md shadow-pink-200/50 hover:shadow-lg hover:shadow-pink-300/50 transition-all">
              <Link href={ctaLink ?? "/agenda"}>{ctaLabel}</Link>
            </Button>
          ) : null}
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-pink-50 hover:text-primary md:hidden">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
