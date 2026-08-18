"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createEmployerAccountAction } from "@/lib/actions/admin";
import { localeCodes, type InviteActionState } from "@/lib/domain";

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

  const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2";
  const labelClass = "mb-1 block text-sm text-gray-700";

  return (
    <div className="space-y-4">
      {state.status === "success" && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          <p>{t("employerCreated")}</p>
          {state.inviteLink && (
            <div className="mt-2">
              <p className="font-medium">{tCandidates("inviteLinkLabel")}</p>
              <code className="mt-1 block break-all rounded bg-white p-2 text-xs">
                {state.inviteLink}
              </code>
            </div>
          )}
        </div>
      )}
      {state.status === "error" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("error")}
        </p>
      )}

      <form
        action={formAction}
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
      >
        <input type="hidden" name="locale" value={locale} />
        <h2 className="text-lg font-semibold">{t("createEmployer")}</h2>
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
          className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {tCandidates("submit")}
        </button>
      </form>
    </div>
  );
}
