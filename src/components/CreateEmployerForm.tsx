"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createEmployerAccountAction } from "@/lib/actions/admin";
import { localeCodes, type InviteActionState } from "@/lib/domain";
import { buttonClass, controlClass } from "@/components/ui/button";

const initialState: InviteActionState = { status: "idle" };

/**
 * Admin employer-account creation (§3A/§14). The one-time invite link is
 * rendered from the POST response only — never through URL parameters.
 */
export default function CreateEmployerForm({
  companies,
}: {
  companies: { id: string; name: string }[];
}) {
  const locale = useLocale();
  const t = useTranslations("admin.companies");
  const tCandidates = useTranslations("admin.candidates");
  const [state, formAction, pending] = useActionState(
    createEmployerAccountAction,
    initialState
  );

  const inputClass = controlClass;
  const labelClass = "t-label mb-1.5 block";

  return (
    <div className="space-y-4">
      {state.status === "success" && (
        <div className="rounded-md border border-positive/25 bg-positive-soft px-3 py-2 text-sm text-positive">
          <p>{t("employerCreated")}</p>
          {state.inviteLink && (
            <div className="mt-2">
              <p className="font-medium">{tCandidates("inviteLinkLabel")}</p>
              <code className="mt-1 block break-all rounded border border-hairline bg-surface p-2 font-mono text-xs text-ink-800">
                {state.inviteLink}
              </code>
            </div>
          )}
        </div>
      )}
      {state.status === "error" && (
        <p className="rounded-md border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical">
          {t("error")}
        </p>
      )}

      <form
        action={formAction}
        className="space-y-4"
      >
        <input type="hidden" name="locale" value={locale} />
        <h2 className="t-section-title">{t("createEmployer")}</h2>
        <div>
          <label className={labelClass} htmlFor="employer_email">
            {t("employerEmail")}
          </label>
          <input
            id="employer_email"
            type="email"
            name="email"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="company_id">
            {t("company")}
          </label>
          <select
            id="company_id"
            name="company_id"
            required
            className={inputClass}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="employer_locale">
              {tCandidates("locale")}
            </label>
            <select
              id="employer_locale"
              name="preferred_locale"
              defaultValue="de"
              className={inputClass}
            >
              {localeCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="employer_invite_mode">
              {tCandidates("inviteMode")}
            </label>
            <select
              id="employer_invite_mode"
              name="invite_mode"
              className={inputClass}
            >
              <option value="email">{tCandidates("inviteEmail")}</option>
              <option value="link">{tCandidates("inviteLink")}</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary", "md")}
        >
          {tCandidates("submit")}
        </button>
      </form>
    </div>
  );
}
