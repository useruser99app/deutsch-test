/* ALLEMARO V0.1 — Dev seed (NOT for production).
 *
 * Creates test accounts without needing SMTP (the admin-based test-user
 * mechanism for development):
 *   - one admin, two candidates (Ausbildung + skilled worker), one employer
 *     with a company.
 * Passwords are generated per run and printed to the console only.
 *
 * Usage: npm run seed:dev
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * .env.local (never commit secrets).
 */
import { ensureUser, serviceClient } from "./lib";

async function main() {
  const service = serviceClient();

  const admin = await ensureUser(
    service,
    "admin@norav.local",
    "admin",
    "active",
    "de"
  );
  const candidateA = await ensureUser(
    service,
    "candidate-a@norav.local",
    "candidate",
    "active",
    "fr"
  );
  const candidateB = await ensureUser(
    service,
    "candidate-b@norav.local",
    "candidate",
    "active",
    "ar"
  );
  const employer = await ensureUser(
    service,
    "employer@norav.local",
    "employer",
    "active",
    "de"
  );

  // Candidate A — Ausbildung candidate, canonical German level B1 (§34).
  const { data: existingA } = await service
    .from("candidates")
    .select("id")
    .eq("user_id", candidateA.id)
    .maybeSingle();
  let candidateAId = existingA?.id as string | undefined;
  if (!candidateAId) {
    const { data, error } = await service
      .from("candidates")
      .insert({
        user_id: candidateA.id,
        candidate_type: "apprenticeship_candidate",
        first_name: "Amina",
        last_name: "El Idrissi",
        email: candidateA.email,
        german_level: "B1",
        country_of_residence: "MA",
        nationality: "MA",
      })
      .select("id")
      .single();
    if (error) throw error;
    candidateAId = data.id;
    await service
      .from("apprenticeship_details")
      .insert({ candidate_id: candidateAId });
    await service.from("candidate_target_occupations").insert({
      candidate_id: candidateAId,
      occupation: "Pflegefachmann/-frau",
      rank: 1,
    });
    await service.from("candidate_profiles").insert({
      candidate_id: candidateAId,
      candidate_type: "apprenticeship_candidate",
      country: "MA",
      german_level: "B1",
    });
  }

  // Candidate B — skilled worker.
  const { data: existingB } = await service
    .from("candidates")
    .select("id")
    .eq("user_id", candidateB.id)
    .maybeSingle();
  if (!existingB) {
    const { data, error } = await service
      .from("candidates")
      .insert({
        user_id: candidateB.id,
        candidate_type: "skilled_worker",
        first_name: "Youssef",
        last_name: "Benali",
        email: candidateB.email,
        german_level: "B2",
        country_of_residence: "MA",
        nationality: "MA",
      })
      .select("id")
      .single();
    if (error) throw error;
    await service
      .from("skilled_worker_details")
      .insert({ candidate_id: data.id, profession: "Elektriker" });
    await service.from("candidate_profiles").insert({
      candidate_id: data.id,
      candidate_type: "skilled_worker",
      country: "MA",
      german_level: "B2",
    });
  }

  // Employer company + membership.
  const { data: existingCompany } = await service
    .from("companies")
    .select("id")
    .eq("name", "Muster Klinik GmbH")
    .maybeSingle();
  let companyId = existingCompany?.id as string | undefined;
  if (!companyId) {
    const { data, error } = await service
      .from("companies")
      .insert({
        name: "Muster Klinik GmbH",
        industry: "healthcare",
        country: "DE",
        city: "Berlin",
      })
      .select("id")
      .single();
    if (error) throw error;
    companyId = data.id;
  }
  await service
    .from("company_members")
    .upsert(
      { company_id: companyId, user_id: employer.id, member_role: "owner" },
      { onConflict: "company_id,user_id" }
    );

  console.log("\nDev accounts ready (passwords generated for THIS run only):");
  for (const user of [admin, candidateA, candidateB, employer]) {
    console.log(`  ${user.email}  ${user.password}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
