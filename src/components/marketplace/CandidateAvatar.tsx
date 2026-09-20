import Icon from "@/components/shell/Icon";

/**
 * The visual anchor of a candidate row — WITHOUT a person in it.
 *
 * An employer never sees who this is, so there is no photo, no name and no
 * initials of a name: showing either would leak identity that the whole
 * publication model exists to withhold. What identifies the person here is
 * the candidate code, and the only thing the tile encodes beyond that is
 * the candidate type, which is public.
 *
 * The numeric tail of the code is shown because it is the part a recruiter
 * actually reads back ("die 11"); the prefix is identical on every row and
 * would only add noise.
 */
export default function CandidateAvatar({
  candidateCode,
  candidateType,
  size = "md",
}: {
  candidateCode: string;
  candidateType: string;
  size?: "sm" | "md" | "lg";
}) {
  const isApprenticeship = candidateType === "apprenticeship_candidate";

  // "NOR-00011" -> "11". Falls back to the icon alone when the code carries
  // no digits, so an unexpected code format cannot render an empty tile.
  const digits = candidateCode.replace(/\D/g, "").replace(/^0+/, "");
  const shortCode = digits.slice(-3);

  const box =
    size === "lg" ? "h-14 w-14" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const glyph =
    size === "lg" ? "h-5 w-5" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const label =
    size === "lg" ? "text-sm" : size === "sm" ? "text-[10px]" : "text-[11px]";

  return (
    <span
      aria-hidden
      className={`flex ${box} shrink-0 flex-col items-center justify-center rounded-control border ${
        isApprenticeship
          ? "border-track-apprenticeship/15 bg-track-apprenticeship-soft text-track-apprenticeship"
          : "border-track-skilled/15 bg-track-skilled-soft text-track-skilled"
      }`}
    >
      <Icon name="profile" className={glyph} />
      {shortCode && (
        <span className={`mt-0.5 font-mono font-semibold tabular-nums ${label}`}>
          {shortCode}
        </span>
      )}
    </span>
  );
}
