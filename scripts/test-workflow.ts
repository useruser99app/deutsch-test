/* NORAV V0.1 — Mandatory workflow & security test (§34).
 *
 * Runs against a real Supabase project (env vars from .env.local):
 *   1. Candidate A: canonical German B1, proposes B2 → canonical stays B1,
 *      pending item shows B1 → B2.
 *   2. Admin approves → canonical becomes B2; history (B1) preserved.
 *   3. Candidate A uploads a B2 certificate → pending_review; admin
 *      approves → approved.
 *   4. Security: Candidate B sees nothing of A; employer sees no identity,
 *      documents or private data; suspended and invited accounts are locked
 *      out of protected data at RLS level.
 *   5. Canonical values stay language-neutral regardless of UI locale.
 *
 * Usage: npm run test:workflow
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, ensureUser, serviceClient } from "./lib";

let passed = 0;
let failed = 0;

function check(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}`, detail ?? "");
  }
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function main() {
  const service = serviceClient();
  const run = Date.now().toString(36);
  const cleanupUserIds: string[] = [];
  const cleanupCandidateIds: string[] = [];
  let companyId: string | null = null;
  let certificatePath: string | null = null;

  try {
    console.log("\n== Setup ==");
    const admin = await ensureUser(service, `wf-admin-${run}@norav.local`, "admin", "active", "de");
    const candA = await ensureUser(service, `wf-cand-a-${run}@norav.local`, "candidate", "active", "fr");
    const candB = await ensureUser(service, `wf-cand-b-${run}@norav.local`, "candidate", "active", "ar");
    const employer = await ensureUser(service, `wf-employer-${run}@norav.local`, "employer", "active", "de");
    const invited = await ensureUser(service, `wf-invited-${run}@norav.local`, "candidate", "invited", "fr");
    cleanupUserIds.push(admin.id, candA.id, candB.id, employer.id, invited.id);

    const { data: candidateA, error: candAError } = await service
      .from("candidates")
      .insert({
        user_id: candA.id,
        candidate_type: "apprenticeship_candidate",
        first_name: "Amina",
        last_name: "Testfall",
        email: candA.email,
        german_level: "B1",
        date_of_birth: "2004-03-15",
        phone: "+212600000000",
      })
      .select("id, candidate_code")
      .single();
    if (candAError) throw candAError;
    cleanupCandidateIds.push(candidateA.id);
    await service.from("apprenticeship_details").insert({ candidate_id: candidateA.id });
    await service.from("candidate_profiles").insert({
      candidate_id: candidateA.id,
      candidate_type: "apprenticeship_candidate",
      country: "MA",
      german_level: "B1",
    });

    const { data: candidateB, error: candBError } = await service
      .from("candidates")
      .insert({
        user_id: candB.id,
        candidate_type: "skilled_worker",
        first_name: "Youssef",
        last_name: "Testfall",
        email: candB.email,
        german_level: "B2",
      })
      .select("id")
      .single();
    if (candBError) throw candBError;
    cleanupCandidateIds.push(candidateB.id);

    const { data: company, error: companyError } = await service
      .from("companies")
      .insert({ name: `WF Test GmbH ${run}`, country: "DE", city: "Berlin" })
      .select("id")
      .single();
    if (companyError) throw companyError;
    companyId = company.id;
    await service.from("company_members").insert({
      company_id: company.id,
      user_id: employer.id,
      member_role: "owner",
    });

    console.log(`Candidate A = ${candidateA.candidate_code}`);

    // ------------------------------------------------------------------
    console.log("\n== 1. Candidate A proposes German B1 → B2 ==");
    const sessionA = await signIn(candA.email, candA.password);
    const { data: setId, error: submitError } = await sessionA.rpc(
      "submit_candidate_changes",
      { p_items: [{ field_key: "german_level", proposed_value: "B2" }] }
    );
    check(!submitError && !!setId, "change set submitted", submitError?.message);

    const { data: canonicalAfterSubmit } = await sessionA
      .from("candidates")
      .select("german_level")
      .eq("id", candidateA.id)
      .single();
    check(
      canonicalAfterSubmit?.german_level === "B1",
      "canonical value still B1 while pending"
    );

    const { data: pendingItems } = await sessionA
      .from("candidate_change_items")
      .select("id, field_key, current_value, proposed_value, status")
      .eq("status", "pending");
    const pendingItem = (pendingItems ?? [])[0];
    check(
      !!pendingItem &&
        pendingItem.current_value === "B1" &&
        pendingItem.proposed_value === "B2",
      "pending item snapshot: current B1, proposed B2",
      pendingItem
    );

    // ------------------------------------------------------------------
    console.log("\n== 2. Admin reviews and approves ==");
    const sessionAdmin = await signIn(admin.email, admin.password);
    const { data: adminView } = await sessionAdmin
      .from("candidate_change_items")
      .select("id, current_value, proposed_value")
      .eq("id", pendingItem.id)
      .single();
    check(
      adminView?.current_value === "B1" && adminView?.proposed_value === "B2",
      "admin sees current B1 / proposed B2"
    );

    const { error: approveError } = await sessionAdmin.rpc("approve_change_item", {
      p_item_id: pendingItem.id,
      p_comment: "Certificate check follows",
    });
    check(!approveError, "approve_change_item succeeded", approveError?.message);

    const { data: canonicalAfterApprove } = await sessionA
      .from("candidates")
      .select("german_level")
      .eq("id", candidateA.id)
      .single();
    check(
      canonicalAfterApprove?.german_level === "B2",
      "canonical value is B2 after approval"
    );

    const { data: historyItem } = await sessionAdmin
      .from("candidate_change_items")
      .select("status, current_value, reviewed_by, review_comment")
      .eq("id", pendingItem.id)
      .single();
    check(
      historyItem?.status === "approved" &&
        historyItem?.current_value === "B1" &&
        !!historyItem?.reviewed_by,
      "history preserved (old value B1, reviewer, comment)",
      historyItem
    );

    // Candidate must not be able to approve their own changes.
    const { data: setId2 } = await sessionA.rpc("submit_candidate_changes", {
      p_items: [{ field_key: "german_level", proposed_value: "C1" }],
    });
    const { data: ownPending } = await sessionA
      .from("candidate_change_items")
      .select("id")
      .eq("status", "pending");
    const ownItemId = (ownPending ?? [])[0]?.id;
    const { error: selfApprove } = await sessionA.rpc("approve_change_item", {
      p_item_id: ownItemId,
    });
    check(!!selfApprove, "candidate cannot approve own change (rejected)", setId2);
    await sessionAdmin.rpc("reject_change_item", {
      p_item_id: ownItemId,
      p_comment: "test cleanup",
    });

    // Candidate must not be able to write canonical data directly.
    const { data: directUpdate } = await sessionA
      .from("candidates")
      .update({ german_level: "C2" })
      .eq("id", candidateA.id)
      .select("id");
    check(
      (directUpdate ?? []).length === 0,
      "candidate cannot directly modify canonical data (RLS)"
    );

    // ------------------------------------------------------------------
    console.log("\n== 3. Document upload & review ==");
    certificatePath = `${candidateA.id}/${crypto.randomUUID()}-b2-certificate.txt`;
    const { error: uploadError } = await sessionA.storage
      .from("candidate-documents")
      .upload(certificatePath, new Blob(["B2 certificate (test)"]), {
        contentType: "text/plain",
      });
    check(!uploadError, "candidate uploaded certificate file", uploadError?.message);

    const { data: docRow, error: docInsertError } = await sessionA
      .from("candidate_documents")
      .insert({
        candidate_id: candidateA.id,
        document_type: "language_certificate",
        file_path: certificatePath,
        original_filename: "b2-certificate.txt",
        mime_type: "text/plain",
        uploaded_by: candA.id,
      })
      .select("id, verification_status")
      .single();
    check(
      !docInsertError && docRow?.verification_status === "pending_review",
      "document metadata created as pending_review",
      docInsertError?.message
    );

    const { error: docReviewError } = await sessionAdmin.rpc("review_document", {
      p_document_id: docRow!.id,
      p_approve: true,
      p_note: "B2 certificate verified",
    });
    check(!docReviewError, "admin approved document", docReviewError?.message);

    const { data: docAfter } = await sessionA
      .from("candidate_documents")
      .select("verification_status, review_note")
      .eq("id", docRow!.id)
      .single();
    check(
      docAfter?.verification_status === "approved",
      "document status is approved"
    );

    // ------------------------------------------------------------------
    console.log("\n== 4. Security: Candidate B isolation ==");
    const sessionB = await signIn(candB.email, candB.password);
    const { data: bCandidates } = await sessionB
      .from("candidates")
      .select("id");
    check(
      (bCandidates ?? []).every((row) => row.id === candidateB.id),
      "candidate B sees only their own candidate row"
    );
    const { data: bChanges } = await sessionB
      .from("candidate_change_items")
      .select("id");
    check((bChanges ?? []).length === 0, "candidate B sees no changes of A");
    const { data: bDocs } = await sessionB
      .from("candidate_documents")
      .select("id");
    check((bDocs ?? []).length === 0, "candidate B sees no documents of A");
    const { data: bFile } = await sessionB.storage
      .from("candidate-documents")
      .download(certificatePath);
    check(!bFile, "candidate B cannot download A's file");

    // ------------------------------------------------------------------
    console.log("\n== 5. Security: employer isolation ==");
    const sessionE = await signIn(employer.email, employer.password);
    const { data: eCandidates } = await sessionE.from("candidates").select("id");
    check((eCandidates ?? []).length === 0, "employer sees no candidate identities");
    const { data: eDocs } = await sessionE
      .from("candidate_documents")
      .select("id");
    check((eDocs ?? []).length === 0, "employer sees no documents");
    const { data: eFile } = await sessionE.storage
      .from("candidate-documents")
      .download(certificatePath);
    check(!eFile, "employer cannot download candidate files");
    const { data: eProfilesDraft } = await sessionE
      .from("candidate_profiles")
      .select("id");
    check(
      (eProfilesDraft ?? []).length === 0,
      "employer sees no unpublished profiles"
    );

    await service
      .from("candidate_profiles")
      .update({ profile_status: "published", published_at: new Date().toISOString() })
      .eq("candidate_id", candidateA.id);
    const { data: eProfiles } = await sessionE
      .from("candidate_profiles")
      .select("*")
      .eq("candidate_id", candidateA.id);
    const profileRow = (eProfiles ?? [])[0] ?? {};
    const exposedKeys = Object.keys(profileRow);
    const forbidden = ["first_name", "last_name", "email", "phone", "date_of_birth", "file_path"];
    check(
      exposedKeys.length > 0 && forbidden.every((key) => !exposedKeys.includes(key)),
      "published profile contains no identity fields",
      exposedKeys
    );

    // ------------------------------------------------------------------
    console.log("\n== 6. Security: suspended & invited accounts ==");
    await service
      .from("app_users")
      .update({ account_status: "suspended" })
      .eq("id", candA.id);
    const { data: suspendedRead } = await sessionA
      .from("candidates")
      .select("id");
    check(
      (suspendedRead ?? []).length === 0,
      "suspended candidate can no longer read protected data"
    );
    const { error: suspendedSubmit } = await sessionA.rpc(
      "submit_candidate_changes",
      { p_items: [{ field_key: "phone", proposed_value: "+491700000000" }] }
    );
    check(!!suspendedSubmit, "suspended candidate cannot submit changes");

    const sessionInvited = await signIn(invited.email, invited.password);
    const { data: invitedRead } = await sessionInvited
      .from("candidates")
      .select("id");
    check(
      (invitedRead ?? []).length === 0,
      "invited (not yet activated) account reads no protected data"
    );

    // ------------------------------------------------------------------
    console.log("\n== 7. Language neutrality ==");
    const { data: neutral } = await service
      .from("candidates")
      .select("candidate_type, german_level")
      .eq("id", candidateA.id)
      .single();
    check(
      neutral?.candidate_type === "apprenticeship_candidate" &&
        neutral?.german_level === "B2",
      "canonical values are language-neutral keys (UI locale fr/ar independent)"
    );
  } finally {
    console.log("\n== Cleanup ==");
    if (certificatePath) {
      await service.storage.from("candidate-documents").remove([certificatePath]);
    }
    for (const id of cleanupCandidateIds) {
      await service.from("candidates").delete().eq("id", id);
    }
    if (companyId) {
      await service.from("companies").delete().eq("id", companyId);
    }
    for (const id of cleanupUserIds) {
      await service.auth.admin.deleteUser(id);
    }
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
