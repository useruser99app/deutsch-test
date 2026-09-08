import { getTranslations } from "next-intl/server";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { logout } from "@/lib/actions/auth";
import { buttonClass } from "@/components/ui/button";

/** Compact account area: who is signed in, language, sign out. */
export default async function AccountControls({
  locale,
  email,
  tone = "light",
}: {
  locale: string;
  email: string;
  tone?: "light" | "dark";
}) {
  const t = await getTranslations("common");
  const isLight = tone === "light";

  return (
    <div className="space-y-2">
      <p
        className={`truncate text-xs ${isLight ? "text-ink-300" : "text-ink-500"}`}
        title={email}
      >
        {email}
      </p>
      <div className="flex items-center gap-2">
        <LocaleSwitcher persist tone={tone} />
        <form action={logout} className="flex-1">
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className={
              isLight
                ? "w-full rounded-md border border-white/15 px-3 py-1.5 text-sm font-medium text-ink-200 transition-colors hover:bg-white/10 hover:text-white"
                : buttonClass("secondary", "sm", "w-full")
            }
          >
            {t("logout")}
          </button>
        </form>
      </div>
    </div>
  );
}
