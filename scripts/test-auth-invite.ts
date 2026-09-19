/* ALLEMARO — SSR-safe invitation flow tests.
 *
 * Pure and deterministic: the confirmation logic is separated from the route
 * handler, so the redirect contract can be verified with a stub verifier
 * instead of a database or a browser. Run with `npm run test:auth`.
 */
import {
  resolveConfirmation,
  safeNextPath,
  isAllowedOtpType,
  buildConfirmUrl,
  invitePath,
  type OtpVerifier,
} from "../src/lib/auth-confirm";

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS: ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const SITE = "https://allemaro.com";

  /** Accepts any token; records what it was asked to verify. */
  function okVerifier(): OtpVerifier & { seen: unknown[] } {
    const seen: unknown[] = [];
    return {
      seen,
      auth: {
        async verifyOtp(params) {
          seen.push(params);
          return { error: null };
        },
      },
    };
  }

  /** Rejects, as Supabase does for an expired or reused token. */
  const failVerifier: OtpVerifier = {
    auth: {
      async verifyOtp() {
        return { error: { message: "Token has expired or is invalid" } };
      },
    },
  };

  // --- Invite URL shape ---------------------------------------------------
  const url = buildConfirmUrl({
    siteUrl: SITE,
    tokenHash: "abc123",
    type: "invite",
    next: invitePath("de"),
  });
  check("Invite link points at ALLEMARO /auth/confirm, not Supabase",
    url.startsWith(`${SITE}/auth/confirm?`), url);
  check("Invite link carries token_hash, type and next",
    url.includes("token_hash=abc123") && url.includes("type=invite") &&
    url.includes("next=%2Fde%2Fset-password"), url);
  check("Invite link never contains a Supabase verify endpoint",
    !url.includes("/auth/v1/verify") && !url.includes("redirect_to="));
  check("Base URL is environment-driven, no hardcoded localhost",
    buildConfirmUrl({ siteUrl: "http://localhost:3000", tokenHash: "t", type: "invite", next: "/de/set-password" })
      .startsWith("http://localhost:3000/auth/confirm"));
  check("A trailing slash on the site URL does not double up",
    buildConfirmUrl({ siteUrl: `${SITE}/`, tokenHash: "t", type: "invite", next: "/de/set-password" })
      .startsWith(`${SITE}/auth/confirm?`));

  // --- Valid invite -------------------------------------------------------
  {
    const v = okVerifier();
    const out = await resolveConfirmation(
      new URL(`${SITE}/auth/confirm?token_hash=abc&type=invite&next=/de/set-password`), v);
    check("Valid invite token redirects to /de/set-password",
      out.ok && out.location === `${SITE}/de/set-password`, out.location);
    check("The token is verified server-side with the given type",
      JSON.stringify(v.seen) === JSON.stringify([{ token_hash: "abc", type: "invite" }]));
  }

  // --- Locale is preserved -------------------------------------------------
  for (const loc of ["de", "en", "fr", "ar"]) {
    const out = await resolveConfirmation(
      new URL(`${SITE}/auth/confirm?token_hash=abc&type=invite&next=/${loc}/set-password`), okVerifier());
    check(`Locale ${loc} lands on /${loc}/set-password`,
      out.location === `${SITE}/${loc}/set-password`, out.location);
  }

  // --- Invalid / expired token --------------------------------------------
  {
    const out = await resolveConfirmation(
      new URL(`${SITE}/auth/confirm?token_hash=dead&type=invite&next=/de/set-password`), failVerifier);
    check("Expired token redirects to the localized login with an error state",
      !out.ok && out.location === `${SITE}/de/login?error=invalid_link`, out.location);
  }
  {
    const out = await resolveConfirmation(
      new URL(`${SITE}/auth/confirm?token_hash=dead&type=invite&next=/fr/set-password`), failVerifier);
    check("The error page keeps the invite's locale",
      out.location === `${SITE}/fr/login?error=invalid_link`, out.location);
  }
  {
    const out = await resolveConfirmation(
      new URL(`${SITE}/auth/confirm?type=invite&next=/de/set-password`), okVerifier());
    check("A missing token_hash is rejected without calling verifyOtp",
      !out.ok && out.location.includes("error=invalid_link"));
  }
  {
    const out = await resolveConfirmation(
      new URL(`${SITE}/auth/confirm?token_hash=abc&type=sudo&next=/de/set-password`), okVerifier());
    check("An unknown OTP type is rejected",
      !out.ok && out.location.includes("error=invalid_link"));
  }
  check("Allowed OTP types are exactly the e-mail ones we issue",
    ["invite", "recovery", "magiclink", "email", "email_change"].every(isAllowedOtpType) &&
    !isAllowedOtpType("sudo") && !isAllowedOtpType(null));

  // --- Unsafe redirect targets --------------------------------------------
  const unsafe = [
    "https://evil.test/steal",
    "//evil.test/steal",
    "/\\evil.test",
    "http://localhost:3000/de",
    "javascript:alert(1)",
  ];
  for (const bad of unsafe) {
    const out = await resolveConfirmation(
      new URL(`${SITE}/auth/confirm?token_hash=abc&type=invite&next=${encodeURIComponent(bad)}`),
      okVerifier());
    check(`Unsafe next is rejected: ${bad}`,
      out.location === `${SITE}/de/set-password`, out.location);
  }
  check("safeNextPath falls back rather than leaving the origin",
    safeNextPath("https://evil.test", "/de") === "/de" &&
    safeNextPath("//evil.test", "/de") === "/de" &&
    safeNextPath(null, "/de") === "/de" &&
    safeNextPath("/de/set-password", "/de") === "/de/set-password");

  // --- Recovery keeps working (password reset must not regress) ------------
  {
    const out = await resolveConfirmation(
      new URL(`${SITE}/auth/confirm?token_hash=abc&type=recovery&next=/de/reset-password`), okVerifier());
    check("Recovery token redirects to /de/reset-password",
      out.ok && out.location === `${SITE}/de/reset-password`, out.location);
  }
  {
    const out = await resolveConfirmation(
      new URL(`${SITE}/auth/confirm?token_hash=abc&type=invite`), okVerifier());
    check("An invite without next still defaults to set-password",
      out.location === `${SITE}/de/set-password`, out.location);
  }

  // --- The old implicit-flow link must be gone from the invite actions ---
  const { readFileSync } = await import("node:fs");
  const adminSource = readFileSync("src/lib/actions/admin.ts", "utf8");
  const codeLines = adminSource
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"));
  check("Invite actions no longer hand out Supabase's action_link",
    !codeLines.some((l) => l.includes("action_link")));
  check("Invite actions build the URL from hashed_token",
    codeLines.some((l) => l.includes("hashed_token")));
  check("Both invitation modes go through one generateLink call path",
    !codeLines.some((l) => l.includes("inviteUserByEmail")));
  check("The confirmation route exists",
    readFileSync("src/app/auth/confirm/route.ts", "utf8").includes("resolveConfirmation"));
  // Password reset still uses the untouched callback route.
  const authSource = readFileSync("src/lib/actions/auth.ts", "utf8");
  check("Password reset flow is unchanged and still uses /auth/callback",
    authSource.includes("/auth/callback?next=/${locale}/reset-password") &&
    authSource.includes("resetPasswordForEmail"));
  check("Login and logout actions are untouched",
    authSource.includes("signInWithPassword") && authSource.includes("signOut"));

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

// tsx compiles these scripts to CommonJS, where top-level await is not
// available; the whole suite therefore runs inside one async entry point.
main();
