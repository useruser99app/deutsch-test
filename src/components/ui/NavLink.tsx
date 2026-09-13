"use client";

import { Link, usePathname } from "@/i18n/navigation";
import Icon, { type IconName } from "@/components/shell/Icon";

/**
 * One sidebar entry. The only client component in the shell — the active
 * state needs the current path.
 *
 * The active state is carried by three things at once (a filled ground, a
 * brighter label and a solid rail on the inline-start edge) so it survives
 * both dark and light rendering and does not depend on colour alone.
 */
export default function NavLink({
  href,
  label,
  icon,
  badge,
  exact = false,
}: {
  href: string;
  label: string;
  icon?: IconName;
  badge?: number;
  /** Section roots match exactly; their sub-pages match by prefix. */
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === href || (!exact && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`group relative flex items-start gap-2.5 rounded-md py-2 ps-3 pe-2.5 text-sm transition-colors ${
        isActive
          ? "bg-white/10 font-semibold text-white"
          : "font-medium text-ink-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-1.5 start-0 w-0.5 rounded-full transition-colors ${
          isActive ? "bg-accent" : "bg-transparent"
        }`}
      />
      {icon && (
        <Icon
          name={icon}
          className={`mt-px h-[18px] w-[18px] transition-colors ${
            isActive ? "text-white" : "text-ink-400 group-hover:text-ink-200"
          }`}
        />
      )}
      {/* Wraps instead of truncating: a navigation label that reads
          "Proposer des modificati…" is worse than one on two lines, and
          this holds for every locale rather than the longest one today. */}
      <span className="min-w-0 flex-1 break-words leading-snug">{label}</span>
      {badge ? (
        <span
          className="shrink-0 rounded-full bg-attention px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white"
          aria-label={`${badge}`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
