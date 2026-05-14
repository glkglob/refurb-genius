import { Link } from "@tanstack/react-router";

import type { ProductConfig } from "@/core/platform";

type ProductCardProps = {
  product: ProductConfig;
  eyebrow?: string;
  ctaLabel?: string;
};

export function ProductCard({
  product,
  eyebrow = "Platform module",
  ctaLabel = "Open",
}: ProductCardProps) {
  const isComingSoon = product.status !== "live";
  const isExternalHref = /^https?:\/\//.test(product.basePath);

  const content = (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </p>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">{product.name}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{product.description}</p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          {isComingSoon ? "Coming soon" : ctaLabel}
        </span>
      </div>
    </>
  );

  if (isComingSoon) {
    return (
      <div
        className="block cursor-default rounded-2xl border border-border bg-card p-6 text-card-foreground opacity-60 shadow-sm"
        role="article"
        aria-disabled="true"
      >
        {content}
      </div>
    );
  }

  const className =
    "block rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";

  if (isExternalHref) {
    return (
      <a href={product.basePath} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link to={product.basePath} className={className}>
      {content}
    </Link>
  );
}
