import BrandMark from "@/components/shell/BrandMark";
import AccountControls from "@/components/shell/AccountControls";
import Icon from "@/components/shell/Icon";
import NavLink from "@/components/ui/NavLink";
import type { IconName } from "@/components/shell/Icon";

export interface NavItem {
  href: string;
  label: string;
  icon?: IconName;
  badge?: number;
  /** Section roots match exactly; sub-pages match by prefix. */
  exact?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/**
 * The one application shell, shared by the admin, employer and candidate
 * workspaces. Using a single shell is the point: the three portals are one
 * product, so they get one navigation rail, one content rhythm and one
 * account area, and differ only in the routes they list.
 *
 * RTL works structurally — the rail sits on the inline-start side and every
 * edge uses a logical property, so no direction-specific rule is needed.
 *
 * The mobile navigation is a native <details> disclosure: it needs no
 * JavaScript, is keyboard operable and screen-reader announced out of the
 * box, and cannot desynchronise from the route the way a state-held drawer
 * can.
 */
export default async function AppShell({
  locale,
  email,
  workspaceLabel,
  groups,
  children,
}: {
  locale: string;
  email: string;
  workspaceLabel: string;
  groups: NavGroup[];
  children: React.ReactNode;
}) {
  const nav = (
    <nav aria-label={workspaceLabel} className="space-y-5">
      {groups.map((group, index) => (
        <div key={group.label ?? index}>
          {group.label && (
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink {...item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col bg-ink-900 lg:flex">
        <div className="border-b border-white/10 px-5 py-4">
          <BrandMark subtitle={workspaceLabel} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">{nav}</div>
        <div className="border-t border-white/10 px-4 py-3">
          <AccountControls locale={locale} email={email} tone="light" />
        </div>
      </aside>

      {/* Compact bar with a disclosure drawer below `lg` */}
      <header className="sticky top-0 z-20 bg-ink-900 lg:hidden">
        <details className="group">
          <summary
            className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3"
            aria-label={workspaceLabel}
          >
            <BrandMark subtitle={workspaceLabel} />
            <span className="rounded-md border border-white/15 p-2 text-ink-200 transition-colors group-hover:bg-white/10 group-hover:text-white">
              <Icon name="menu" className="h-5 w-5 group-open:hidden" />
              <Icon name="close" className="hidden h-5 w-5 group-open:block" />
            </span>
          </summary>
          <div className="border-t border-white/10 px-3 pb-4 pt-3">
            {nav}
            <div className="mt-4 border-t border-white/10 px-1 pt-3">
              <AccountControls locale={locale} email={email} tone="light" />
            </div>
          </div>
        </details>
      </header>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
