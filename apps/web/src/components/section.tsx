import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Section = ({
  title,
  subtitle,
  children,
  className
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) => {
  return (
    <section className={cn("py-12", className)}>
      <div className="mx-auto w-full max-w-6xl px-4">
        {title ? <h2 className="text-2xl font-semibold font-display">{title}</h2> : null}
        {subtitle ? <p className="mt-2 text-muted-foreground">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
};
