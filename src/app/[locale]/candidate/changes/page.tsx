import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { submitChanges } from "@/lib/actions/candidate";
import { germanLevels, localeCodes, type Candidate } from "@/lib/domain";

export default async function ProposeChangesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const { supabase, profile } = await requireRole(locale, "candidate");

  const t = await getTranslations("candidate.changes");
  const tFields = await getTranslations("fields");

  const { data: candidate } = await supabase
    .from("candidates")
    .select("*")
    .maybeSingle<Candidate>();
  const isApprenticeship =
    candidate?.candidate_type === "apprenticeship_candidate";

  const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2";
  const labelClass = "mb-1 block text-sm text-gray-700";

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 text-2xl font-semibold">{t("title")}</h1>
      <p className="mb-6 text-sm text-gray-600">{t("description")}</p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("error")}
        </p>
      )}

      <form
        action={submitChanges}
        className="space-y-5 rounded-lg border border-gray-200 bg-white p-6"
      >
        <input type="hidden" name="locale" value={locale} />

        <div>
          <label className={labelClass} htmlFor="german_level">
            {tFields("german_level")}
            {candidate && (
              <span className="text-gray-400"> · {candidate.german_level}</span>
            )}
          </label>
          <select id="german_level" name="german_level" className={inputClass}>
            <option value="">{t("noChange")}</option>
            {germanLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="availability_date">
            {tFields("availability_date")}
            {candidate?.availability_date && (
              <span className="text-gray-400">
                {" "}
                · {candidate.availability_date}
              </span>
            )}
          </label>
          <input
            id="availability_date"
            type="date"
            name="availability_date"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="phone">
            {tFields("phone")}
            {candidate?.phone && (
              <span className="text-gray-400"> · {candidate.phone}</span>
            )}
          </label>
          <input id="phone" type="text" name="phone" className={inputClass} />
        </div>

        {isApprenticeship && (
          <div>
            <label className={labelClass} htmlFor="target_occupations">
              {tFields("target_occupations")}
              <span className="text-gray-400"> · {t("listHint")}</span>
            </label>
            <input
              id="target_occupations"
              type="text"
              name="target_occupations"
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="preferred_locations">
            {tFields("preferred_locations")}
            <span className="text-gray-400"> · {t("listHint")}</span>
          </label>
          <input
            id="preferred_locations"
            type="text"
            name="preferred_locations"
            className={inputClass}
          />
        </div>

        {isApprenticeship && (
          <div>
            <label className={labelClass} htmlFor="motivation_summary">
              {tFields("motivation_summary")}
            </label>
            <textarea
              id="motivation_summary"
              name="motivation_summary"
              rows={4}
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="source_language">
            {t("sourceLanguage")}
          </label>
          <select
            id="source_language"
            name="source_language"
            defaultValue={profile.preferred_locale}
            className={inputClass}
          >
            {localeCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
        >
          {t("submit")}
        </button>
      </form>
    </div>
  );
}
