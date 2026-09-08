/**
 * NORAV wordmark. Typographic rather than illustrative — no logo asset is
 * invented here.
 */
export default function BrandMark({
  tone = "light",
  subtitle,
}: {
  tone?: "light" | "dark";
  subtitle?: string;
}) {
  return (
    <div className="min-w-0">
      <span
        className={`block text-[15px] font-semibold tracking-[0.18em] ${
          tone === "light" ? "text-white" : "text-ink-900"
        }`}
      >
        NORAV
      </span>
      {subtitle && (
        <span
          className={`mt-0.5 block truncate text-[11px] tracking-wide ${
            tone === "light" ? "text-ink-300" : "text-ink-500"
          }`}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}
