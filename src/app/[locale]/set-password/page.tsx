import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import PasswordForm from "@/components/PasswordForm";

export default async function SetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);

  const session = await getSessionProfile();
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations("auth.setPassword");

  return (
    <PasswordForm
      locale={locale}
      from="set"
      title={t("title")}
      description={t("description")}
      error={error}
    />
  );
}
