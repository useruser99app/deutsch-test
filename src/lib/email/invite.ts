import "server-only";

import { sendEmail } from "@/lib/email/provider";
import { localeCodes, type LocaleCode } from "@/lib/domain";

/**
 * The invitation e-mail.
 *
 * It carries ALLEMARO's own /auth/confirm URL — the same link the "generate
 * link" mode shows — so both invitation modes run through one server-side
 * verification instead of two competing auth flows.
 *
 * Delivery goes through the existing provider abstraction, which is a no-op
 * when no provider is configured. The caller is told so and falls back to
 * showing the link, so an admin is never left with an account nobody can
 * reach.
 */
const COPY: Record<
  LocaleCode,
  { subject: string; greeting: string; body: string; cta: string; signature: string }
> = {
  de: {
    subject: "ALLEMARO – Ihr Zugang",
    greeting: "Guten Tag,",
    body: "für Sie wurde ein ALLEMARO-Konto angelegt. Über den folgenden Link legen Sie Ihr Passwort fest und aktivieren das Konto. Der Link ist nur einmal gültig.",
    cta: "Passwort festlegen:",
    signature: "Ihr ALLEMARO-Team",
  },
  en: {
    subject: "ALLEMARO – your access",
    greeting: "Hello,",
    body: "an ALLEMARO account has been created for you. Use the link below to set your password and activate the account. The link can be used once.",
    cta: "Set your password:",
    signature: "Your ALLEMARO team",
  },
  fr: {
    subject: "ALLEMARO – votre accès",
    greeting: "Bonjour,",
    body: "un compte ALLEMARO a été créé pour vous. Utilisez le lien ci-dessous pour définir votre mot de passe et activer le compte. Ce lien n'est valable qu'une seule fois.",
    cta: "Définir le mot de passe :",
    signature: "Votre équipe ALLEMARO",
  },
  ar: {
    subject: "ALLEMARO – حسابك",
    greeting: "مرحبًا،",
    body: "تم إنشاء حساب ALLEMARO لك. استخدم الرابط أدناه لتعيين كلمة المرور وتفعيل الحساب. الرابط صالح لمرة واحدة فقط.",
    cta: "تعيين كلمة المرور:",
    signature: "فريق ALLEMARO",
  },
};

/** True when the message was actually handed to a provider. */
export async function sendInviteEmail(options: {
  to: string;
  locale: string;
  url: string;
}): Promise<boolean> {
  const locale = (localeCodes as readonly string[]).includes(options.locale)
    ? (options.locale as LocaleCode)
    : "de";
  const copy = COPY[locale];

  const result = await sendEmail({
    to: [options.to],
    subject: copy.subject,
    text: [
      copy.greeting,
      "",
      copy.body,
      "",
      `${copy.cta} ${options.url}`,
      "",
      copy.signature,
    ].join("\n"),
  });

  return result.status === "sent";
}
