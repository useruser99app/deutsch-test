import { useTranslations } from "next-intl";

type Tone = "positive" | "attention" | "critical" | "neutral" | "accent";

/** Canonical status value → meaning. DB values stay language-neutral (§16). */
const tones: Record<string, Tone> = {
  approved: "positive",
  active: "positive",
  published: "positive",
  pending: "attention",
  pending_review: "attention",
  pending_verification: "attention",
  invited: "accent",
  rejected: "critical",
  suspended: "critical",
  superseded: "neutral",
  draft: "neutral",
  unpublished: "neutral",
  inactive: "neutral",
  archived: "neutral",
};

const toneClass: Record<Tone, string> = {
  positive: "bg-positive-soft text-positive",
  attention: "bg-attention-soft text-attention",
  critical: "bg-critical-soft text-critical",
  accent: "bg-accent-soft text-accent",
  neutral: "bg-ink-100 text-ink-600",
};

const dotClass: Record<Tone, string> = {
  positive: "bg-positive",
  attention: "bg-attention",
  critical: "bg-critical",
  accent: "bg-accent",
  neutral: "bg-ink-400",
};

/**
 * Status as a quiet, dotted chip. The dot carries the state redundantly with
 * the colour, so it stays readable without relying on hue alone.
 */
export default function StatusBadge({
  status,
  size = "md",
}: {
  status: string;
  size?: "sm" | "md";
}) {
  const t = useTranslations("status");
  const tone = tones[status] ?? "neutral";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        toneClass[tone]
      } ${size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass[tone]}`}
      />
      {t.has(status) ? t(status) : status}
    </span>
  );
}
