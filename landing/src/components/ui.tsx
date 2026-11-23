import React from "react";

export const Container: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <div className={`mx-auto w-full max-w-[1200px] px-4 sm:px-6 ${className}`}>{children}</div>;

export const Section: React.FC<{
  id?: string;
  children: React.ReactNode;
  tone?: "page" | "surface" | "soft";
  labelledBy?: string;
}> = ({ id, children, tone = "page", labelledBy }) => {
  const bg = tone === "surface" ? "bg-surface" : tone === "soft" ? "bg-brand-soft" : "bg-page";
  return (
    <section id={id} aria-labelledby={labelledBy} className={`${bg} py-14 sm:py-20`}>
      <Container>{children}</Container>
    </section>
  );
};

export const SectionTitle: React.FC<{ id: string; children: React.ReactNode; subtitle?: string }> = ({
  id,
  children,
  subtitle,
}) => (
  <div className="mb-8 sm:mb-10 max-w-2xl">
    <h2 id={id} className="font-display text-[32px] sm:text-[40px] leading-tight text-ink">
      {children}
    </h2>
    {subtitle && <p className="mt-3 text-[17px] text-ink-muted">{subtitle}</p>}
  </div>
);

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-page hover:bg-brand",
  secondary: "border-2 border-ink text-ink bg-surface hover:bg-brand-soft",
  ghost: "text-brand hover:bg-brand-soft",
};

export function buttonClass(variant: Variant = "primary", extra = ""): string {
  return `inline-flex min-h-touch items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors ${VARIANTS[variant]} ${extra}`;
}

export const ButtonLink: React.FC<{
  href: string;
  variant?: Variant;
  external?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ href, variant = "primary", external = false, children, className = "" }) => (
  <a
    href={href}
    className={buttonClass(variant, className)}
    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
  >
    {children}
  </a>
);
