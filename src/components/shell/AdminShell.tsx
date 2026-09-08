import BrandMark from "@/components/shell/BrandMark";
import AccountControls from "@/components/shell/AccountControls";
import NavLink from "@/components/ui/NavLink";

export interface NavGroup {
  label?: string;
  items: { href: string; label: string; badge?: number }[];
}

/**
 * Admin workspace shell: a fixed navy sidebar from `lg` up, a top bar with a
 * disclosure drawer below it. RTL works structurally — the sidebar sits on
 * the inline-start side and the border uses a logical property, so no
 * direction-specific rules are needed.
 */
export default async function AdminShell({
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
    <nav className="space-y-6">
      {groups.map((group, index) => (
        <div key={group.label ?? index}>
          {group.label && (
            <p className="t-label mb-2 px-3 text-ink-400">{group.label}</p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  label={item.label}
                  badge={item.badge}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-e border-white/5 bg-ink-900 px-4 py-5 lg:flex">
        <div>
          <div className="px-3 pb-6">
            <BrandMark subtitle={workspaceLabel} />
          </div>
          {nav}
        </div>
        <div className="border-t border-white/10 px-3 pt-4">
          <AccountControls locale={locale} email={email} tone="light" />
        </div>
      </aside>

      {/* Mobile / tablet bar with a disclosure drawer — no JS required. */}
      <header className="sticky top-0 z-20 bg-ink-900 lg:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
            <BrandMark subtitle={workspaceLabel} />
            <span className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-ink-200">
              <span className="group-open:hidden">☰</span>
              <span className="hidden group-open:inline">✕</span>
            </span>
          </summary>
          <div className="border-t border-white/10 px-4 py-4">
            {nav}
            <div className="mt-5 border-t border-white/10 pt-4">
              <AccountControls locale={locale} email={email} tone="light" />
            </div>
          </div>
        </details>
      </header>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
