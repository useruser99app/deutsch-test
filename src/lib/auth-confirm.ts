import type { EmailOtpType } from "@supabase/supabase-js";
import { locales } from "@/i18n/routing";

/**
 * SSR-safe e-mail confirmation.
 *
 * Supabase's `action_link` (`/auth/v1/verify?token=…&redirect_to=…`) verifies
 * at Supabase and then redirects with the session in the URL FRAGMENT. A
 * fragment is never sent to a server, so a Next.js route handler cannot see
 * it and the session is lost. The fix is not to parse the fragment — it is
 * to never hand out that link: we build our own URL carrying the one-time
 * `token_hash` and verify it server-side, where the SSR client can write the
 * session cookies.
 *
 * The helpers below are pure so the redirect and validation rules can be
 * tested without a database or a browser.
 */

/** OTP types this route accepts. Deliberately narrow. */
const ALLOWED_TYPES = [
  "invite",
  "recovery",
  "magiclink",
  "email",
  "email_change",
] as const;

export type AllowedOtpType = (typeof ALLOWED_TYPES)[number];

export function isAllowedOtpType(value: string | null): value is AllowedOtpType {
  return (ALLOWED_TYPES as readonly string[]).includes(value ?? "");
}

/**
 * Only same-origin relative paths may be redirected to. An absolute URL, a
 * protocol-relative `//evil.test` or a backslash variant is rejected in
 * favour of the fallback, so a crafted invite link cannot bounce a freshly
 * authenticated user off-site.
 */
export function safeNextPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  // "//host" and "/\host" are both browser-interpreted as protocol-relative.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("://")) return fallback;
  return value;
}

/** A locale segment we actually serve, else the employer-first default. */
export function safeLocale(value: unknown): string {
  return locales.includes(value as (typeof locales)[number])
    ? (value as string)
    : "de";
}

/**
 * The ALLEMARO-owned confirmation URL handed to an invited user.
 *
 * The base comes from NEXT_PUBLIC_SITE_URL so the same code produces a
 * localhost link in development and an allemaro.com link in production; no
 * host is written into application logic.
 */
export function buildConfirmUrl(options: {
  siteUrl: string;
  tokenHash: string;
  type: AllowedOtpType;
  next: string;
}): string {
  const base = options.siteUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({
    token_hash: options.tokenHash,
    type: options.type,
    next: options.next,
  });
  return `${base}/auth/confirm?${params.toString()}`;
}

/** The site base URL, environment-driven with a development fallback. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Where an invited user of this locale must land. */
export function invitePath(locale: string): string {
  return `/${safeLocale(locale)}/set-password`;
}

/** Minimal surface of the Supabase client this handler needs. */
export interface OtpVerifier {
  auth: {
    verifyOtp(params: {
      token_hash: string;
      type: EmailOtpType;
    }): Promise<{ error: { message: string } | null }>;
  };
}

export interface ConfirmOutcome {
  /** Absolute URL to redirect to. */
  location: string;
  ok: boolean;
}

/**
 * Verifies a one-time token and decides where the user goes.
 *
 * Separated from the route handler so the redirect contract can be tested
 * directly: the handler itself only supplies the real Supabase client.
 */
export async function resolveConfirmation(
  url: URL,
  supabase: OtpVerifier
): Promise<ConfirmOutcome> {
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  const origin = url.origin;

  // The locale of the intended destination also localizes the error page,
  // so a failed German invite does not dump the user on an English login.
  const rawNext = url.searchParams.get("next");
  const localeFromNext = safeLocale(rawNext?.split("/")[1]);

  if (!tokenHash || !isAllowedOtpType(rawType)) {
    return { ok: false, location: `${origin}/${localeFromNext}/login?error=invalid_link` };
  }

  // An invite always ends at set-password; anything else keeps its own
  // destination. Both are validated as same-origin relative paths.
  const fallback =
    rawType === "invite" ? invitePath(localeFromNext) : `/${localeFromNext}`;
  const next = safeNextPath(rawNext, fallback);

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: rawType as EmailOtpType,
  });

  if (error) {
    return { ok: false, location: `${origin}/${localeFromNext}/login?error=invalid_link` };
  }

  return { ok: true, location: `${origin}${next}` };
}
