import BrandMark from "@/components/shell/BrandMark";
import AccountControls from "@/components/shell/AccountControls";
import NavLink from "@/components/ui/NavLink";

/**
 * Shell for the candidate and employer surfaces: same product family as the
 * admin workspace but deliberately lighter — a single top bar, no sidebar,
 * no operational chrome.
 */
export default async function PortalShell({
  locale,
  email,
  workspaceLabel,
  nav,
  children,
}: {
  locale: string;
  email: string;
  workspaceLabel: string;
  nav: { href: string; label: string; badge?: number }[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 pt-3 sm:px-6">
          <BrandMark tone="dark" subtitle={workspaceLabel} />
          <div className="ms-auto w-auto max-w-[60%]">
            <AccountControls locale={locale} email={email} tone="dark" />
          </div>
        </div>

        <nav className="mx-auto max-w-5xl overflow-x-auto px-4 sm:px-6">
          <ul className="flex gap-6 whitespace-nowrap">
            {nav.map((item) => (
              <li key={item.href}>
                <NavLink
                href={item.href}
                label={item.label}
                badge={item.badge}
                variant="topbar"
              />
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
