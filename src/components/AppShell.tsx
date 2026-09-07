import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { logout } from "@/lib/actions/auth";

export interface NavItem {
  href: string;
  label: string;
}

export default async function AppShell({
  locale,
  email,
  nav,
  children,
}: {
  locale: string;
  email: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const t = await getTranslations("common");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <span className="text-lg font-bold tracking-tight text-gray-900">
            {t("appName")}
          </span>
          <div className="ms-auto flex items-center gap-2">
            <span className="hidden max-w-[14rem] truncate text-xs text-gray-500 sm:inline">
              {email}
            </span>
            <LocaleSwitcher persist />
            <form action={logout}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                {t("logout")}
              </button>
            </form>
          </div>
        </div>

        {/* Horizontally scrollable on narrow screens instead of wrapping. */}
        <nav className="mx-auto max-w-5xl overflow-x-auto px-4 pb-2">
          <ul className="flex gap-1 whitespace-nowrap">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
