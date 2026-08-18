import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import PasswordForm from "@/components/PasswordForm";

export default async function ResetPasswordPage({
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

  const t = await getTranslations("auth.reset");

  return (
    <PasswordForm
      locale={locale}
      from="reset"
      title={t("title")}
      error={error}
    />
  );
}
