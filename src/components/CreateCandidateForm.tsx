"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createCandidateAccountAction } from "@/lib/actions/admin";
import {
  candidateTypes,
  localeCodes,
  type InviteActionState,
} from "@/lib/domain";
import { buttonClass, controlClass } from "@/components/ui/button";

const initialState: InviteActionState = { status: "idle" };

/**
 * Admin candidate-account creation (§3A). Submitted via server action; the
 * one-time invite link is rendered from the POST response only and never
 * appears in a URL (no history/logs/analytics exposure).
 */
export default function CreateCandidateForm() {
  const locale = useLocale();
  const t = useTranslations("admin.candidates");
  const tEnums = useTranslations("enums");
  const [state, formAction, pending] = useActionState(
    createCandidateAccountAction,
    initialState
  );

  const inputClass = controlClass;
  const labelClass = "t-label mb-1.5 block";

  return (
    <div className="space-y-4">
      {state.status === "success" && (
        <div className="rounded-md border border-positive/25 bg-positive-soft px-3 py-2 text-sm text-positive">
          <p>
            {t("created")} ({state.candidateCode})
          </p>
          {state.inviteLink && (
            <div className="mt-2">
              <p className="font-medium">{t("inviteLinkLabel")}</p>
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
        <h2 className="t-section-title">{t("create")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="email">
              {t("email")}
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="candidate_type">
              {t("candidateType")}
            </label>
            <select
              id="candidate_type"
              name="candidate_type"
              className={inputClass}
            >
              {candidateTypes.map((type) => (
                <option key={type} value={type}>
                  {tEnums(`candidateType.${type}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="first_name">
              {t("firstName")}
            </label>
            <input
              id="first_name"
              type="text"
              name="first_name"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="last_name">
              {t("lastName")}
            </label>
            <input
              id="last_name"
              type="text"
              name="last_name"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="preferred_locale">
              {t("locale")}
            </label>
            <select
              id="preferred_locale"
              name="preferred_locale"
              defaultValue="fr"
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
            <label className={labelClass} htmlFor="invite_mode">
              {t("inviteMode")}
            </label>
            <select id="invite_mode" name="invite_mode" className={inputClass}>
              <option value="email">{t("inviteEmail")}</option>
              <option value="link">{t("inviteLink")}</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary", "md")}
        >
          {t("submit")}
        </button>
      </form>
    </div>
  );
}
