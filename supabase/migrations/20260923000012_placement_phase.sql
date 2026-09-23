-- =====================================================================
-- ALLEMARO — Migration 0012: placement phase
-- =====================================================================
--
-- Where a candidate stands on the way from the first language course to
-- starting work in Germany. One current phase per candidate, set by an
-- admin. Earlier phases are implicitly complete and later ones open, so the
-- ORDER of the enum is the process and carries meaning — do not reorder.
--
-- Deliberately minimal: no event history. The one timestamp records when the
-- current phase was set, so the UI can say "since" without inventing dates.
--
-- NULL means "not yet set". Existing and new candidates start there rather
-- than in 'language_course': asserting that every candidate is in a language
-- course would be invented data, and skilled workers may join later in the
-- process.
--
-- RLS: nothing to add. The existing policies already give exactly the
-- access this needs:
--   * "admins manage candidates"   — admins read and write the row
--   * "candidates read own record" — a candidate may READ its own phase
--                                    (for the future read-only timeline)
-- Candidates have no UPDATE policy on public.candidates, and the column is
-- not part of the change-request field registry, so a candidate cannot set
-- it by either route. The employer view employer_candidate_profiles lists
-- its columns explicitly and does not include these, so employers never
-- see a candidate's placement phase.
-- ---------------------------------------------------------------------

create type public.placement_phase as enum (
  'language_course',
  'telc',
  'application_documents',
  'interviews',
  'contract',
  'pre_approval',
  'visa',
  'arrival'
);

alter table public.candidates
  add column placement_phase public.placement_phase,
  add column placement_phase_changed_at timestamptz;

comment on column public.candidates.placement_phase is
  'Current placement phase, set by admins. NULL = not yet set.';
comment on column public.candidates.placement_phase_changed_at is
  'When placement_phase was last set. No history is kept.';
