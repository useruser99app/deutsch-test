"use client";

import { Link, usePathname } from "@/i18n/navigation";

/**
 * Navigation entry with an active-state indicator. The only client component
 * in the shell — the active state needs the current path.
 */
export default function NavLink({
  href,
  label,
  badge,
  variant = "sidebar",
}: {
  href: string;
  label: string;
  badge?: number;
  variant?: "sidebar" | "topbar";
}) {
  const pathname = usePathname();
  // Exact match for section roots, prefix match for their sub-pages.
  const isActive =
    pathname === href ||
    (href !== "/admin" && href !== "/candidate" && pathname.startsWith(`${href}/`));

  if (variant === "topbar") {
    return (
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={`inline-flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
          isActive
            ? "border-accent text-ink-900"
            : "border-transparent text-ink-500 hover:border-ink-200 hover:text-ink-800"
        }`}
      >
        {label}
        {badge ? (
          <span className="rounded-full bg-attention-soft px-1.5 py-0.5 text-[11px] font-semibold text-attention">
            {badge}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-white/10 text-white"
          : "text-ink-200 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={`h-4 w-0.5 rounded-full ${
            isActive ? "bg-white" : "bg-transparent"
          }`}
        />
        {label}
      </span>
      {badge ? (
        <span className="rounded-full bg-attention px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
