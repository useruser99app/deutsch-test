"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  updatePlacementPhaseAction,
  type PlacementPhaseActionState,
} from "@/lib/actions/admin";
import { placementPhases, type PlacementPhase } from "@/lib/domain";
import { buttonClass, controlClass } from "@/components/ui/button";

const initialState: PlacementPhaseActionState = { status: "idle" };

/**
 * The admin's one control over the placement process: a select of the
 * eight fixed phases, no free text. Saving revalidates the candidate page,
 * so the timeline above re-renders from the stored value in the same
 * response — no extra page, no client-side copy of the truth.
 *
 * Save stays disabled until the selection differs from what is stored, so
 * a stray click cannot write the same phase again and reset its date.
 */
export default function PlacementPhaseForm({
  candidateId,
  current,
}: {
  candidateId: string;
  current: PlacementPhase | null;
}) {
  const locale = useLocale();
  const t = useTranslations("placement");
  const [state, formAction, pending] = useActionState(
    updatePlacementPhaseAction,
    initialState,
  );
  const [selected, setSelected] = useState<string>(current ?? "");
  const dirty = selected !== (current ?? "");

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="candidate_id" value={candidateId} />

      <div className="min-w-[14rem]">
        <label className="t-label mb-1.5 block" htmlFor="placement_phase">
          {t("currentPhase")}
        </label>
        <select
          id="placement_phase"
          name="placement_phase"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className={controlClass}
        >
          <option value="">{t("notSetOption")}</option>
          {placementPhases.map((phase, index) => (
            <option key={phase} value={phase}>
              {index + 1}. {t(`phase.${phase}`)}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={pending || !dirty}
        className={buttonClass("primary", "md")}
      >
        {pending ? t("saving") : t("save")}
      </button>

      {state.status === "success" && !dirty && (
        <p role="status" className="basis-full text-[13px] text-positive">
          {t("saved")}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="basis-full text-[13px] text-critical">
          {t("failed")}
        </p>
      )}
    </form>
  );
}
