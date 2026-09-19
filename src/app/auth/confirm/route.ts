import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveConfirmation } from "@/lib/auth-confirm";

/**
 * Server-side confirmation of a Supabase one-time e-mail token.
 *
 * This is the route ALLEMARO's own invite links point at. It verifies the
 * `token_hash` with the SSR client, which writes the session into cookies —
 * possible here because a route handler may mutate cookies and because the
 * middleware matcher excludes `/auth`. The user then arrives at
 * /set-password already authenticated.
 *
 * The decision logic lives in `resolveConfirmation` so it can be tested
 * without a database; this handler only supplies the real client.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const outcome = await resolveConfirmation(new URL(request.url), supabase);
  return NextResponse.redirect(outcome.location);
}
