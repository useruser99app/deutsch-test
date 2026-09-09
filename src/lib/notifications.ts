import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Employer notification events. Every row is one semantic status transition
 * of an introduction request, created by a database trigger so the event
 * exists no matter which code path caused the transition.
 *
 * Nothing here reads a private candidate table: the employer-facing labels
 * come from `employer_candidate_profiles`, the publication whitelist.
 */

export const employerNotificationTypes = [
  "request_reviewing",
  "request_approved",
  "request_rejected",
  "request_introduced",
] as const;
export type EmployerNotificationType =
  (typeof employerNotificationTypes)[number];

/** The request status each event type corresponds to. */
export const notificationStatus: Record<EmployerNotificationType, string> = {
  request_reviewing: "reviewing",
  request_approved: "approved",
  request_rejected: "rejected",
  request_introduced: "introduced",
};

export interface EmployerNotification {
  id: string;
  type: EmployerNotificationType;
  created_at: string;
  read_at: string | null;
  interest_request_id: string;
  candidate_profile_id: string | null;
}

const NOTIFICATION_SELECT =
  "id, type, created_at, read_at, interest_request_id, candidate_profile_id";

/**
 * Unread events for the employer's company. This is the badge number: it
 * counts unseen UPDATES, never the total number of requests (§3).
 */
export async function countUnreadNotifications(
  supabase: SupabaseClient
): Promise<number> {
  const { count } = await supabase
    .from("employer_notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

/** Newest events first — the activity feed and the dashboard both use this. */
export async function loadNotifications(
  supabase: SupabaseClient,
  options: { limit?: number; unreadOnly?: boolean } = {}
): Promise<EmployerNotification[]> {
  let query = supabase
    .from("employer_notifications")
    .select(NOTIFICATION_SELECT);
  if (options.unreadOnly) query = query.is("read_at", null);

  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 20);
  return (data ?? []) as EmployerNotification[];
}

/** Unread event count per request, for marking rows in the request list. */
export function unreadByRequest(
  notifications: EmployerNotification[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of notifications) {
    if (item.read_at) continue;
    map.set(
      item.interest_request_id,
      (map.get(item.interest_request_id) ?? 0) + 1
    );
  }
  return map;
}
