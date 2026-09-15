/* ALLEMARO V0.1 — deterministic matching tests (Prompt 04 §29).
 *
 * Pure functions, no database and no network: the matching module reads
 * only the employer-safe candidate projection, so it can be verified in
 * isolation. Run with `npm run test:matching`.
 */
import {
  evaluateCandidateForJob,
  germanLevelRank,
  meetsGermanLevel,
  compareOccupation,
  occupationVariants,
  rankCandidatesForJob,
  candidateTypeForJob,
  type JobRequirements,
} from "../src/lib/matching";
import type { EmployerCandidate } from "../src/lib/employer-data";

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS: ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Only fields the employer-safe view actually exposes. */
function candidate(over: Partial<EmployerCandidate>): EmployerCandidate {
  return {
    profile_id: "p", candidate_code: "NOR-00000",
    candidate_type: "apprenticeship_candidate", published_at: "2026-09-01",
    german_level: "B2", availability_date: null, relocation_ready: null,
    drivers_license: null, country: "MA", target_occupations: null,
    primary_occupation: null, desired_training_start: null,
    school_qualification: null, school_specialization: null,
    graduation_year: null, german_certificate_type: null,
    german_certificate_status: null, has_practical_experience: null,
    profession: null, specialization: null, years_experience: null,
    highest_qualification: null, preferred_positions: null,
    preferred_locations: null, skills: null, headline_occupation: null,
    ...over,
  } as EmployerCandidate;
}

const jobA: JobRequirements = {
  job_type: "apprenticeship",
  profession_or_training_occupation: "Pflegefachmann/-frau",
  required_german_level: "B1",
  training_start_date: "2027-09-01",
  minimum_experience_years: null,
  location: "Berlin",
};

const jobB: JobRequirements = {
  job_type: "skilled_position",
  profession_or_training_occupation: "Elektriker",
  required_german_level: "B1",
  training_start_date: "2026-11-01",
  minimum_experience_years: 3,
  location: "Köln",
};

const amina = candidate({
  candidate_code: "NOR-00011",
  candidate_type: "apprenticeship_candidate",
  german_level: "B2",
  target_occupations: ["Pflegefachmann/-frau", "Hotelfachmann/-frau"],
  primary_occupation: "Pflegefachmann/-frau",
  desired_training_start: "2027-09-01",
  preferred_locations: ["Berlin", "Hamburg"],
  relocation_ready: true,
  headline_occupation: "Pflegefachmann/-frau",
});

const youssef = candidate({
  candidate_code: "NOR-00012",
  candidate_type: "skilled_worker",
  german_level: "B2",
  profession: "Elektriker",
  years_experience: 6,
  availability_date: "2026-10-01",
  preferred_locations: ["Köln"],
  relocation_ready: false,
  headline_occupation: "Elektriker",
});

// --- 8. German level ordering ------------------------------------------
check("German levels order A1<A2<B1<B2<C1<C2",
  ["A1","A2","B1","B2","C1","C2"].every((l, i, a) =>
    i === 0 || (germanLevelRank(a[i - 1]) as number) < (germanLevelRank(l) as number)));
check("B2 satisfies a B1 requirement", meetsGermanLevel("B2", "B1") === true);
check("B1 does not satisfy a B2 requirement", meetsGermanLevel("B1", "B2") === false);
check("Unknown level is unknown, not false", meetsGermanLevel(null, "B1") === null);
check("Levels are not compared as strings (C1 > B2)",
  meetsGermanLevel("C1", "B2") === true);

// --- Occupation variant normalization -----------------------------------
// A paired German title is expanded into the exact spellings it stands for;
// nothing is truncated, so unrelated titles stay unrelated.
check("Pflegefachmann/-frau matches Pflegefachfrau",
  compareOccupation("Pflegefachmann/-frau", "Pflegefachfrau") === "exact",
  JSON.stringify([...occupationVariants("Pflegefachmann/-frau")]));
check("Pflegefachmann/-frau matches Pflegefachmann",
  compareOccupation("Pflegefachmann/-frau", "Pflegefachmann") === "exact");
check("Kaufmann/-frau matches Kauffrau",
  compareOccupation("Kaufmann/-frau", "Kauffrau") === "exact",
  JSON.stringify([...occupationVariants("Kaufmann/-frau")]));
check("Kaufmann/-frau matches Kaufmann",
  compareOccupation("Kaufmann/-frau", "Kaufmann") === "exact");
check("Elektriker is NOT the same occupation as Elektroniker",
  compareOccupation("Elektriker", "Elektroniker") === "none");
check("Pflegefachmann/-frau does not match Hotelfachmann/-frau",
  compareOccupation("Pflegefachmann/-frau", "Hotelfachmann/-frau") === "none");
check("Unrelated occupations do not match",
  compareOccupation("Pflegefachmann/-frau", "Elektriker") === "none");

// Further forms the expansion is responsible for.
check("Erzieher/-in matches Erzieherin",
  compareOccupation("Erzieher/-in", "Erzieherin") === "exact");
check("Erzieher*in matches Erzieher",
  compareOccupation("Erzieher*in", "Erzieher") === "exact");
check("A (m/w/d) suffix is ignored",
  compareOccupation("Elektriker (m/w/d)", "Elektriker") === "exact");
check("Hyphen and space spelling are one title",
  compareOccupation("Kfz-Mechatroniker", "Kfz Mechatroniker") === "exact");
check("Variant expansion is deterministic",
  JSON.stringify([...occupationVariants("Pflegefachmann/-frau")]) ===
    JSON.stringify([...occupationVariants("Pflegefachmann/-frau")]));
check("Pflegefachmann/-frau expands to exactly its two spellings",
  [...occupationVariants("Pflegefachmann/-frau")].sort().join("|") ===
    "pflegefachfrau|pflegefachmann");
check("Kaufmann/-frau expands to kaufmann and kauffrau",
  [...occupationVariants("Kaufmann/-frau")].sort().join("|") ===
    "kauffrau|kaufmann");
check("A specialisation is related, not identical",
  compareOccupation("Pflegefachmann", "Pflegefachmann Intensivpflege") === "related");
check("Pflegefachkraft is not silently merged with Pflegefachmann",
  compareOccupation("Pflegefachmann/-frau", "Pflegefachkraft") === "none");

// --- 9. Apprenticeship must not require work experience -----------------
const aminaFit = evaluateCandidateForJob(jobA, amina);
check("Apprenticeship: no experience criterion is produced",
  ![...aminaFit.strengths, ...aminaFit.gaps, ...aminaFit.missing]
    .some((c) => c.key.startsWith("experience")));
check("Apprenticeship: candidate without work experience still rates very good",
  aminaFit.level === "very_good",
  `level=${aminaFit.level} evidence=${JSON.stringify(aminaFit.evidence)}`);
check("Apprenticeship: first-choice occupation recognised",
  aminaFit.strengths.some((c) => c.key === "occupationPrimary"));
check("Apprenticeship: B2 recorded as meeting B1",
  aminaFit.strengths.some((c) => c.key === "germanMeets"));

// --- 10. Skilled worker respects relevant experience --------------------
const youssefFit = evaluateCandidateForJob(jobB, youssef);
check("Skilled: sufficient experience is a strength",
  youssefFit.strengths.some((c) => c.key === "experienceMeets"));
const junior = candidate({ ...youssef, years_experience: 1 });
const juniorFit = evaluateCandidateForJob(jobB, junior);
check("Skilled: insufficient experience is a gap",
  juniorFit.gaps.some((c) => c.key === "experienceBelow"));
check("Skilled: less experience scores lower",
  juniorFit.score < youssefFit.score, `${juniorFit.score} < ${youssefFit.score}`);

// --- 11. Missing data is missing, never false ---------------------------
const sparse = candidate({
  candidate_type: "skilled_worker", profession: "Elektriker",
  german_level: "B2", years_experience: null,
  availability_date: null, preferred_locations: null,
});
const sparseFit = evaluateCandidateForJob(jobB, sparse);
check("Unknown experience is reported as missing",
  sparseFit.missing.some((c) => c.key === "experience"));
check("Unknown experience is NOT reported as a gap",
  !sparseFit.gaps.some((c) => c.key.startsWith("experience")));
check("Missing data does not drag the score below a matching candidate",
  sparseFit.score >= 100 - 1,
  `sparse=${sparseFit.score} (only known criteria count)`);

// --- Candidate type is a hard gate (§30) --------------------------------
check("Apprenticeship job maps to apprenticeship candidates",
  candidateTypeForJob("apprenticeship") === "apprenticeship_candidate");
check("Skilled candidate is not eligible for an apprenticeship",
  evaluateCandidateForJob(jobA, youssef).eligible === false);
check("Apprenticeship candidate is not eligible for a skilled position",
  evaluateCandidateForJob(jobB, amina).eligible === false);

// --- 30. Acceptance scenario -------------------------------------------
const rankedA = rankCandidatesForJob(jobA, [amina, youssef]);
check("JOB A ranks only the apprenticeship candidate",
  rankedA.length === 1 && rankedA[0].candidate.candidate_code === "NOR-00011");
check("JOB A: matching German level alone does not admit the wrong type",
  !rankedA.some((r) => r.candidate.candidate_code === "NOR-00012"));

const rankedB = rankCandidatesForJob(jobB, [amina, youssef]);
check("JOB B ranks the skilled worker first",
  rankedB.length === 1 && rankedB[0].candidate.candidate_code === "NOR-00012");

// --- Determinism --------------------------------------------------------
const first = JSON.stringify(evaluateCandidateForJob(jobA, amina));
const second = JSON.stringify(evaluateCandidateForJob(jobA, amina));
check("Same input always produces the same result", first === second);

// --- 12. Sensitive attributes are not part of the calculation -----------
const otherCountry = candidate({ ...amina, country: "DE" });
check("Country of residence does not change the score",
  evaluateCandidateForJob(jobA, otherCountry).score ===
    evaluateCandidateForJob(jobA, amina).score);

// =======================================================================
// Match confidence: the band must follow the EVIDENCE, not the percentage.
// =======================================================================

// (A) Only the occupation is comparable -> GOOD, never VERY_GOOD.
const jobOccupationOnly: JobRequirements = {
  job_type: "apprenticeship",
  profession_or_training_occupation: "Pflegefachmann/-frau",
  required_german_level: null,
  training_start_date: null,
  minimum_experience_years: null,
  location: null,
};
const bareCandidate = candidate({
  candidate_type: "apprenticeship_candidate",
  target_occupations: ["Pflegefachmann/-frau"],
  primary_occupation: "Pflegefachmann/-frau",
  german_level: "B2",
  desired_training_start: null,
  preferred_locations: null,
  relocation_ready: null,
});
const fitA = evaluateCandidateForJob(jobOccupationOnly, bareCandidate);
check("A: a single comparable requirement rates GOOD, not VERY_GOOD",
  fitA.level === "good", `level=${fitA.level}`);
check("A: exactly one criterion was evaluated",
  fitA.evidence.evaluatedCriteria === 1, JSON.stringify(fitA.evidence));
check("A: that one criterion matched",
  fitA.evidence.matchedCriteria === 1);
check("A: no gaps",
  fitA.evidence.gapCriteria === 0);
check("A: the internal score is still 100 but is not the employer signal",
  fitA.score === 100 && fitA.level !== "very_good");

// (B) Occupation + German + start all confirmed -> VERY_GOOD.
const jobThree: JobRequirements = {
  job_type: "apprenticeship",
  profession_or_training_occupation: "Pflegefachmann/-frau",
  required_german_level: "B1",
  training_start_date: "2027-09-01",
  minimum_experience_years: null,
  location: null,
};
const fitB = evaluateCandidateForJob(jobThree, candidate({
  candidate_type: "apprenticeship_candidate",
  target_occupations: ["Pflegefachmann/-frau"],
  primary_occupation: "Pflegefachmann/-frau",
  german_level: "B2",
  desired_training_start: "2027-09-01",
}));
check("B: three confirmed criteria rate VERY_GOOD",
  fitB.level === "very_good", `level=${fitB.level}`);
check("B: three criteria evaluated, three matched, no gaps",
  fitB.evidence.evaluatedCriteria === 3 &&
  fitB.evidence.matchedCriteria === 3 &&
  fitB.evidence.gapCriteria === 0, JSON.stringify(fitB.evidence));

// (C) A German requirement the candidate does not reach -> PARTIAL.
const jobGermanB2: JobRequirements = { ...jobThree, required_german_level: "B2", training_start_date: null };
const fitC = evaluateCandidateForJob(jobGermanB2, candidate({
  candidate_type: "apprenticeship_candidate",
  target_occupations: ["Pflegefachmann/-frau"],
  primary_occupation: "Pflegefachmann/-frau",
  german_level: "B1",
}));
check("C: an unmet requirement rates PARTIAL",
  fitC.level === "partial", `level=${fitC.level}`);
check("C: the German requirement appears as a gap",
  fitC.gaps.some((g) => g.key === "germanBelow"));
check("C: one match and one gap were counted",
  fitC.evidence.matchedCriteria === 1 && fitC.evidence.gapCriteria === 1,
  JSON.stringify(fitC.evidence));

// (D) Nothing comparable beyond candidate type -> INSUFFICIENT_DATA.
// german_level is `not null default 'none'` in the database, so it is never
// absent; a candidate at 'none' genuinely fails a B1 requirement and that is
// a GAP, not missing data. This case therefore uses a vacancy that states no
// language requirement, and a profile that carries neither occupation nor
// desired start.
const jobNoLanguage: JobRequirements = {
  job_type: "apprenticeship",
  profession_or_training_occupation: "Pflegefachmann/-frau",
  required_german_level: null,
  training_start_date: "2027-09-01",
  minimum_experience_years: null,
  location: null,
};
const fitD = evaluateCandidateForJob(jobNoLanguage, candidate({
  candidate_type: "apprenticeship_candidate",
  target_occupations: null,
  primary_occupation: null,
  desired_training_start: null,
}));
check("D: nothing comparable rates INSUFFICIENT_DATA",
  fitD.level === "insufficient_data", `level=${fitD.level}`);
check("D: nothing was evaluated, everything is reported as missing",
  fitD.evidence.evaluatedCriteria === 0 && fitD.evidence.missingCriteria === 2,
  JSON.stringify(fitD.evidence));

// A candidate at 'none' against a stated requirement is a gap, not a blank.
const noGerman = evaluateCandidateForJob(jobGermanB2, candidate({
  candidate_type: "apprenticeship_candidate",
  target_occupations: ["Pflegefachmann/-frau"],
  primary_occupation: "Pflegefachmann/-frau",
  german_level: "none",
}));
check("German level 'none' is a gap against a B2 requirement, not missing",
  noGerman.gaps.some((g) => g.key === "germanBelow") &&
  !noGerman.missing.some((g) => g.key === "german"));
check("D: nothing comparable produces no gaps",
  fitD.evidence.gapCriteria === 0);

// A requirement the employer left blank is not a candidate shortcoming.
check("An unspecified job field produces no criterion at all",
  fitA.evidence.evaluatedCriteria + fitA.evidence.missingCriteria === 1,
  JSON.stringify(fitA.evidence));

// Relocation only counts once the vacancy names a place to move to.
const noLocationJob: JobRequirements = { ...jobOccupationOnly };
const willingCandidate = candidate({
  candidate_type: "apprenticeship_candidate",
  target_occupations: ["Pflegefachmann/-frau"],
  primary_occupation: "Pflegefachmann/-frau",
  relocation_ready: true,
});
check("Relocation is not a criterion when the vacancy states no location",
  !["strengths", "gaps", "missing"].some((k) =>
    (evaluateCandidateForJob(noLocationJob, willingCandidate) as unknown as
      Record<string, { key: string }[]>)[k].some((c) => c.key.startsWith("relocation"))));

// The counting invariant must always hold.
for (const f of [fitA, fitB, fitC, fitD, aminaFit, youssefFit]) {
  check(`Counts are consistent (${f.level})`,
    f.evidence.matchedCriteria + f.evidence.gapCriteria === f.evidence.evaluatedCriteria &&
    f.evidence.matchedCriteria === f.strengths.length &&
    f.evidence.gapCriteria === f.gaps.length &&
    f.evidence.missingCriteria === f.missing.length);
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
