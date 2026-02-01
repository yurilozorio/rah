type ContactInfo = {
  whatsapp?: string;
  address?: string;
  footerNote?: string;
};

export const SiteFooter = ({ siteName, contact }: { siteName?: string; contact?: ContactInfo | null }) => {
  return (
    <footer className="border-t bg-secondary/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          {siteName ? <span className="font-display text-base text-foreground">{siteName}</span> : null}
          {(contact?.address || contact?.footerNote) && (
            <span>
              {contact?.address ?? ""}
              {contact?.address && contact?.footerNote ? " • " : ""}
              {contact?.footerNote ?? ""}
            </span>
          )}
          {contact?.whatsapp ? <span>WhatsApp: {contact.whatsapp}</span> : null}
        </div>
      </div>
    </footer>
  );
};
