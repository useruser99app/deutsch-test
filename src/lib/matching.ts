import type { CandidateType, GermanLevel } from "@/lib/domain";
import type { EmployerCandidate } from "@/lib/employer-data";

/**
 * Deterministic, explainable fit between a vacancy and a published
 * candidate. No AI, no scoring model, no hidden weights: the same pair
 * always produces the same result, and every point is attributable to one
 * named criterion that the UI renders as a sentence.
 *
 * DATA BOUNDARY: the candidate side is `EmployerCandidate`, i.e. the
 * `employer_candidate_profiles` view. That type has no name, e-mail, phone,
 * date of birth or document field, so private data cannot enter the
 * calculation even by mistake.
 *
 * EXPLICITLY NOT USED as a criterion: nationality, country of residence,
 * age, gender, or anything derived from them. Country is displayed in the
 * marketplace as context; it never earns or costs a point here.
 */

/** Canonical order. Never compare CEFR levels as plain strings. */
const GERMAN_ORDER: Record<string, number> = {
  none: 0,
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
  native: 7,
};

export function germanLevelRank(level: string | null | undefined): number | null {
  if (!level) return null;
  const rank = GERMAN_ORDER[level];
  return rank === undefined ? null : rank;
}

/** True when `candidate` is at least `required`. Null on either side = unknown. */
export function meetsGermanLevel(
  candidate: string | null | undefined,
  required: string | null | undefined
): boolean | null {
  const c = germanLevelRank(candidate);
  const r = germanLevelRank(required);
  if (c === null || r === null) return null;
  return c >= r;
}

/** The vacancy, reduced to the fields the calculation actually reads. */
export interface JobRequirements {
  job_type: "apprenticeship" | "skilled_position";
  profession_or_training_occupation: string | null;
  required_german_level: GermanLevel | null;
  /** Desired start: the training start for an apprenticeship, the entry
   *  date for a skilled position. Same column, same meaning. */
  training_start_date: string | null;
  minimum_experience_years: number | null;
  location: string | null;
}

export type FitLevel = "strong" | "good" | "partial" | "weak";
export type CriterionKind = "strength" | "gap" | "missing";

export interface FitCriterion {
  /** Canonical id; the UI translates it. Never a user-facing sentence. */
  key: string;
  kind: CriterionKind;
  /** Canonical values for interpolation, e.g. { required: "B1", actual: "B2" }. */
  values?: Record<string, string | number>;
}

export interface FitResult {
  /** 0-100 over the criteria that could actually be evaluated. */
  score: number;
  level: FitLevel;
  strengths: FitCriterion[];
  gaps: FitCriterion[];
  missing: FitCriterion[];
  /** False when the candidate type does not belong to this vacancy type. */
  eligible: boolean;
}

/** A candidate type belongs to exactly one job type. */
export function candidateTypeForJob(
  jobType: JobRequirements["job_type"]
): CandidateType {
  return jobType === "apprenticeship"
    ? "apprenticeship_candidate"
    : "skilled_worker";
}

/**
 * Occupation comparison.
 *
 * German job titles are written in several equivalent ways, and a vacancy
 * usually uses the paired form while a candidate wrote one gender:
 *
 *   job:       "Pflegefachmann/-frau"
 *   candidate: "Pflegefachfrau"
 *
 * These are the same occupation and must match. The solution is EXPANSION,
 * not truncation: a written form is expanded into the exact set of spellings
 * it stands for, and two titles match when their sets intersect. Nothing is
 * guessed and no ending is stripped speculatively, so "Elektriker" and
 * "Elektroniker" stay different occupations — they are not variants of one
 * another, they are two jobs.
 *
 * No fuzzy matching, no edit distance, no AI. Same input, same output.
 */

/** Lowercase, NFC, drop "(m/w/d)" noise, normalise dashes and whitespace. */
function normalizeOccupationText(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")        // (m/w/d), (Vollzeit)
    .replace(/\b[mwd]\b/g, " ")      // bare m / w / d
    .replace(/[\u2010-\u2015]/g, "-") // unicode dashes -> hyphen
    .replace(/[,.;:]/g, " ")
    .replace(/\s*\/\s*/g, "/")       // "mann / -frau" -> "mann/-frau"
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The paired short forms German job titles actually use. Each rule matches a
 * whole title and states exactly which spellings it abbreviates — the list
 * is explicit on purpose, so adding a form is a deliberate act.
 */
const PAIRED_FORMS: { pattern: RegExp; expand: (stem: string) => string[] }[] = [
  // "Pflegefachmann/-frau", "Kaufmann/frau" -> mann + frau
  {
    pattern: /^(.*?)mann\/-?frau$/,
    expand: (stem) => [`${stem}mann`, `${stem}frau`],
  },
  // "Kauffrau/-mann" — the same pair written the other way round
  {
    pattern: /^(.*?)frau\/-?mann$/,
    expand: (stem) => [`${stem}frau`, `${stem}mann`],
  },
  // "Erzieher/-in", "Erzieher/in" -> base + base+in
  {
    pattern: /^(.*?)\/-?in$/,
    expand: (stem) => [stem, `${stem}in`],
  },
  // Gender star / colon / underscore: "Erzieher*in", "Erzieher:in"
  {
    // (?:innen|in), not "innen?" — the latter reads as "inne" plus an
    // optional "n" and would never match "Erzieher*in".
    pattern: /^(.*?)[*:_](?:innen|in)$/,
    expand: (stem) => [stem, `${stem}in`],
  },
];

/**
 * Every spelling one written occupation stands for. Reusable and
 * deterministic: the returned set depends only on the input string.
 */
export function occupationVariants(value: string): Set<string> {
  const base = normalizeOccupationText(value);
  if (!base) return new Set();

  const variants = new Set<string>();
  let expanded = false;

  for (const { pattern, expand } of PAIRED_FORMS) {
    const match = base.match(pattern);
    if (match && match[1]) {
      for (const form of expand(match[1])) {
        const cleaned = form.replace(/[-/]/g, "").trim();
        if (cleaned) variants.add(cleaned);
      }
      expanded = true;
      break;
    }
  }

  // Not a paired form: the title stands only for itself. Remaining
  // separators become spaces so "Kfz-Mechatroniker" and "Kfz Mechatroniker"
  // are one spelling.
  if (!expanded) {
    variants.add(base.replace(/[-/]/g, " ").replace(/\s+/g, " ").trim());
  }

  return variants;
}

export type OccupationMatch = "exact" | "related" | "none";

const tokensOf = (value: string) =>
  new Set(value.split(" ").filter(Boolean));

const isSubset = (a: Set<string>, b: Set<string>) =>
  a.size > 0 && [...a].every((t) => b.has(t));

export function compareOccupation(
  a: string | null | undefined,
  b: string | null | undefined
): OccupationMatch {
  if (!a || !b) return "none";
  const va = occupationVariants(a);
  const vb = occupationVariants(b);
  if (va.size === 0 || vb.size === 0) return "none";

  // Same occupation, possibly written differently.
  for (const variant of va) if (vb.has(variant)) return "exact";

  // A specialisation of the same occupation: every word of one title also
  // appears in the other, e.g. "Pflegefachmann" within "Pflegefachmann
  // Intensivpflege". Word sets, never substrings — "Elektriker" is not a
  // part of "Elektroniker".
  for (const x of va) {
    for (const y of vb) {
      const tx = tokensOf(x);
      const ty = tokensOf(y);
      if (tx.size !== ty.size && (isSubset(tx, ty) || isSubset(ty, tx))) {
        return "related";
      }
    }
  }

  return "none";
}

function sameLocation(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** One weighted criterion: `earned` of `weight`, or null when unknowable. */
interface Scored {
  key: string;
  weight: number;
  earned: number | null;
  kind: CriterionKind;
  values?: Record<string, string | number>;
}

/**
 * Weights, stated openly because the employer is shown the reasons.
 *
 * Apprenticeship deliberately has NO experience criterion: a school leaver
 * applying for training cannot have years of professional experience, and
 * scoring them down for it would make the whole ranking useless.
 */
const WEIGHTS = {
  apprenticeship: {
    occupation: 40,
    german: 25,
    start: 15,
    location: 10,
    relocation: 10,
  },
  skilled_position: {
    occupation: 35,
    experience: 25,
    german: 20,
    start: 10,
    location: 10,
  },
} as const;

export function evaluateCandidateForJob(
  job: JobRequirements,
  candidate: EmployerCandidate
): FitResult {
  const eligible = candidate.candidate_type === candidateTypeForJob(job.job_type);
  const isApprenticeship = job.job_type === "apprenticeship";
  const scored: Scored[] = [];

  // --- Occupation -----------------------------------------------------
  const w = isApprenticeship
    ? WEIGHTS.apprenticeship
    : WEIGHTS.skilled_position;

  if (job.profession_or_training_occupation) {
    if (isApprenticeship) {
      const targets = candidate.target_occupations ?? [];
      if (targets.length === 0) {
        scored.push({ key: "occupation", weight: w.occupation, earned: null, kind: "missing" });
      } else {
        const primary = candidate.primary_occupation;
        const primaryMatch = compareOccupation(
          job.profession_or_training_occupation,
          primary
        );
        const anyMatch = targets
          .map((t) => compareOccupation(job.profession_or_training_occupation, t))
          .sort((a, b) => rankMatch(b) - rankMatch(a))[0];

        // A first-choice occupation counts fully; a secondary target still
        // counts, but less — the candidate ranked it lower themselves.
        const best = rankMatch(primaryMatch) >= rankMatch(anyMatch) ? primaryMatch : anyMatch;
        const isPrimary = rankMatch(primaryMatch) >= rankMatch(anyMatch);
        const factor =
          best === "exact" ? 1 : best === "related" ? 0.6 : 0;
        scored.push({
          key: best === "none"
            ? "occupationMismatch"
            : isPrimary
              ? "occupationPrimary"
              : "occupationSecondary",
          weight: w.occupation,
          earned: w.occupation * (isPrimary ? factor : factor * 0.75),
          kind: best === "none" ? "gap" : "strength",
          values: { job: job.profession_or_training_occupation, candidate: (isPrimary ? primary : targets[0]) ?? "" },
        });
      }
    } else {
      const match = compareOccupation(
        job.profession_or_training_occupation,
        candidate.profession
      );
      if (!candidate.profession) {
        scored.push({ key: "profession", weight: w.occupation, earned: null, kind: "missing" });
      } else {
        const factor = match === "exact" ? 1 : match === "related" ? 0.6 : 0;
        scored.push({
          key: match === "none" ? "professionMismatch" : "professionMatch",
          weight: w.occupation,
          earned: w.occupation * factor,
          kind: match === "none" ? "gap" : "strength",
          values: { job: job.profession_or_training_occupation, candidate: candidate.profession },
        });
      }
    }
  }

  // --- German level ----------------------------------------------------
  if (job.required_german_level) {
    const meets = meetsGermanLevel(candidate.german_level, job.required_german_level);
    if (meets === null) {
      scored.push({ key: "german", weight: w.german, earned: null, kind: "missing" });
    } else {
      scored.push({
        key: meets ? "germanMeets" : "germanBelow",
        weight: w.german,
        earned: meets ? w.german : 0,
        kind: meets ? "strength" : "gap",
        values: { required: job.required_german_level, actual: candidate.german_level },
      });
    }
  }

  // --- Start / availability -------------------------------------------
  if (job.training_start_date) {
    const candidateDate = isApprenticeship
      ? candidate.desired_training_start
      : candidate.availability_date;
    if (!candidateDate) {
      scored.push({
        key: isApprenticeship ? "trainingStart" : "availability",
        weight: w.start,
        earned: null,
        kind: "missing",
      });
    } else {
      // Ready on or before the vacancy's start date.
      const fits = candidateDate <= job.training_start_date;
      scored.push({
        key: isApprenticeship
          ? fits ? "trainingStartFits" : "trainingStartLate"
          : fits ? "availabilityFits" : "availabilityLate",
        weight: w.start,
        earned: fits ? w.start : 0,
        kind: fits ? "strength" : "gap",
        values: { job: job.training_start_date, candidate: candidateDate },
      });
    }
  }

  // --- Experience — skilled positions only (§13) ------------------------
  if (!isApprenticeship && job.minimum_experience_years !== null) {
    const years = candidate.years_experience;
    if (years === null || years === undefined) {
      scored.push({ key: "experience", weight: WEIGHTS.skilled_position.experience, earned: null, kind: "missing" });
    } else {
      const meets = years >= job.minimum_experience_years;
      scored.push({
        key: meets ? "experienceMeets" : "experienceBelow",
        weight: WEIGHTS.skilled_position.experience,
        earned: meets ? WEIGHTS.skilled_position.experience : 0,
        kind: meets ? "strength" : "gap",
        values: { required: job.minimum_experience_years, actual: years },
      });
    }
  }

  // --- Location --------------------------------------------------------
  if (job.location) {
    const preferred = candidate.preferred_locations ?? [];
    if (preferred.length === 0) {
      scored.push({ key: "location", weight: w.location, earned: null, kind: "missing" });
    } else {
      const hit = preferred.some((p) => sameLocation(p, job.location as string));
      scored.push({
        key: hit ? "locationMatch" : "locationElsewhere",
        weight: w.location,
        earned: hit ? w.location : 0,
        kind: hit ? "strength" : "gap",
        values: { job: job.location, candidate: preferred.join(", ") },
      });
    }
  }

  // --- Relocation — apprenticeship only; for skilled it is folded into
  //     availability, which matters more for an already-employed worker.
  if (isApprenticeship) {
    const ready = candidate.relocation_ready;
    if (ready === null || ready === undefined) {
      scored.push({ key: "relocation", weight: WEIGHTS.apprenticeship.relocation, earned: null, kind: "missing" });
    } else {
      scored.push({
        key: ready ? "relocationReady" : "relocationNo",
        weight: WEIGHTS.apprenticeship.relocation,
        earned: ready ? WEIGHTS.apprenticeship.relocation : 0,
        kind: ready ? "strength" : "gap",
      });
    }
  }

  // Missing data is NOT a negative (§16): unknown criteria leave the
  // denominator entirely instead of scoring zero.
  const evaluated = scored.filter((s) => s.earned !== null);
  const possible = evaluated.reduce((sum, s) => sum + s.weight, 0);
  const earned = evaluated.reduce((sum, s) => sum + (s.earned as number), 0);
  const score = possible === 0 ? 0 : Math.round((earned / possible) * 100);

  const toCriterion = (s: Scored): FitCriterion => ({
    key: s.key,
    kind: s.kind,
    ...(s.values ? { values: s.values } : {}),
  });

  return {
    score,
    level: fitLevel(score, possible),
    strengths: scored.filter((s) => s.kind === "strength").map(toCriterion),
    gaps: scored.filter((s) => s.kind === "gap").map(toCriterion),
    missing: scored.filter((s) => s.kind === "missing").map(toCriterion),
    eligible,
  };
}

function rankMatch(m: OccupationMatch): number {
  return m === "exact" ? 2 : m === "related" ? 1 : 0;
}

/**
 * A band, not a precise measurement. With nothing evaluable the result is
 * "weak" rather than a confident zero — the employer should read that as
 * "not enough information", which the missing list then spells out.
 */
function fitLevel(score: number, possible: number): FitLevel {
  if (possible === 0) return "weak";
  if (score >= 85) return "strong";
  if (score >= 65) return "good";
  if (score >= 40) return "partial";
  return "weak";
}

/** Eligible candidates only, best fit first, ties broken deterministically. */
export function rankCandidatesForJob(
  job: JobRequirements,
  candidates: EmployerCandidate[]
): { candidate: EmployerCandidate; fit: FitResult }[] {
  return candidates
    .map((candidate) => ({ candidate, fit: evaluateCandidateForJob(job, candidate) }))
    .filter((entry) => entry.fit.eligible)
    .sort(
      (a, b) =>
        b.fit.score - a.fit.score ||
        a.candidate.candidate_code.localeCompare(b.candidate.candidate_code)
    );
}
