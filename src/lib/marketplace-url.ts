/**
 * URL state for the employer marketplace.
 *
 * The whole surface — tab, filters, job context and the selected profile —
 * lives in the query string. That is what makes the two-column layout work
 * without a single line of client state: every interaction is a link or a
 * GET form, the back button behaves, and a colleague can be sent the exact
 * view you are looking at.
 *
 * Pure string handling on purpose, so the rules are testable.
 */

/** Filter parameters that produce a removable chip. */
export const MARKETPLACE_FILTER_KEYS = [
  "occupation",
  "profession",
  "germanLevel",
  "location",
  "startFrom",
  "qualification",
  "availableFrom",
  "minExperience",
  "relocation",
  "practical",
] as const;

export type MarketplaceFilterKey = (typeof MARKETPLACE_FILTER_KEYS)[number];

/** Parameters that are context, not a filter: they survive a filter reset. */
export const MARKETPLACE_CONTEXT_KEYS = ["type", "job"] as const;

export type MarketplaceSearch = Record<string, string | string[] | undefined>;

/** First value of a query parameter, trimmed. */
export function param(search: MarketplaceSearch, key: string): string {
  const value = search[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * Builds a marketplace href from the current search plus an override map.
 * `null` removes a parameter; empty strings are dropped as well, so a
 * cleared field never leaves `?location=` behind.
 *
 * Keys are emitted in a fixed order so the same view always produces the
 * same URL — links stay stable and comparable.
 */
export function marketplaceHref(
  search: MarketplaceSearch,
  overrides: Partial<Record<string, string | null>> = {}
): string {
  const order = [
    ...MARKETPLACE_CONTEXT_KEYS,
    ...MARKETPLACE_FILTER_KEYS,
    "selected",
  ];
  const params = new URLSearchParams();

  for (const key of order) {
    const override = overrides[key];
    const value = override === undefined ? param(search, key) : (override ?? "");
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `/employer/candidates?${query}` : "/employer/candidates";
}

/** The filter keys that currently carry a value. */
export function activeFilterKeys(
  search: MarketplaceSearch
): MarketplaceFilterKey[] {
  return MARKETPLACE_FILTER_KEYS.filter((key) => param(search, key) !== "");
}

/**
 * Href with every filter cleared but the context kept: an employer resetting
 * filters wants to stay on the same tab and the same vacancy, not to be sent
 * back to the start.
 */
export function resetFiltersHref(search: MarketplaceSearch): string {
  const cleared = Object.fromEntries(
    MARKETPLACE_FILTER_KEYS.map((key) => [key, null])
  );
  return marketplaceHref(search, { ...cleared, selected: null });
}
