import "server-only";

/**
 * Transactional e-mail, server-side only.
 *
 * The provider is behind this one interface so it can be swapped without
 * touching the notification workflow. No API key ever reaches the browser:
 * this module is `server-only` and reads process.env, which Next.js does not
 * expose to client bundles unless the name starts with NEXT_PUBLIC_.
 */

export interface EmailMessage {
  to: string[];
  subject: string;
  text: string;
}

export type EmailResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/**
 * Resend's REST API, called with plain fetch — no npm dependency, and the
 * whole vendor surface is these few lines.
 */
async function sendViaResend(
  message: EmailMessage,
  apiKey: string,
  from: string
): Promise<EmailResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    }),
    // A hanging provider must not hold the admin's request open.
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    // The body may echo request data, so only the status is retained.
    return { status: "failed", error: `provider responded ${response.status}` };
  }
  return { status: "sent" };
}

/**
 * Sends one message. Never throws: the caller has already committed a
 * business status change and must not be rolled back by a mail failure.
 *
 * With no provider configured the message is skipped, not failed — that is
 * the normal state in development and keeps the workflow fully usable.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NORAV_EMAIL_FROM;

  if (!apiKey || !from) {
    return { status: "skipped", reason: "no provider configured" };
  }
  if (message.to.length === 0) {
    return { status: "skipped", reason: "no recipient" };
  }

  try {
    return await sendViaResend(message, apiKey, from);
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.name : "unknown transport error",
    };
  }
}
