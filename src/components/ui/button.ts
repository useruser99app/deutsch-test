/**
 * Button styling as a class helper rather than a wrapper component, so
 * server-action forms keep using plain <button formAction=…> elements and no
 * extra client component is introduced.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "positive"
  | "critical";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-55";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink-900 text-white hover:bg-ink-800",
  secondary:
    "border border-hairline bg-surface text-ink-700 hover:bg-ink-50 hover:text-ink-900",
  ghost: "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
  positive: "bg-positive text-white hover:brightness-110",
  // Rejection is distinct but not louder than approval: outlined, not filled.
  critical:
    "border border-critical/35 bg-surface text-critical hover:bg-critical-soft",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra = ""
): string {
  return [base, variants[variant], sizes[size], extra].filter(Boolean).join(" ");
}

/** Shared form-control styling (inputs, selects, textareas). */
export const controlClass =
  "w-full rounded-md border border-hairline bg-surface px-3 py-2 text-base " +
  "text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none " +
  "focus:ring-1 focus:ring-accent sm:text-sm";
