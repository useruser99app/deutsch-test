/* ALLEMARO V0.1 — Mandatory workflow & security test (§34).
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
import { provisionAccount } from "../src/lib/provisioning";

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

/** Stops the run with a readable diagnosis instead of a follow-up crash. */
function abort(lines: string[]): never {
  console.error("\n  DIAGNOSE — Abbruch:");
  for (const line of lines) {
    console.error(`    - ${line}`);
  }
  throw new Error(lines[0]);
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
    // Diagnostics before any workflow step. own_candidate_id() joins three
    // links: auth.uid() -> app_users (role + account_status = 'active') ->
    // candidates.user_id. If any link is missing or inactive the function
    // returns NULL, and the only symptom further down is the opaque
    // "Only active candidates may submit changes". Verify each link
    // explicitly here and abort with a readable diagnosis instead.
    // Prints ids, role and account_status only — never tokens or secrets.
    console.log("\n== 0. Diagnose: Identitaetskette Candidate A ==");
    const sessionA = await signIn(candA.email, candA.password);
    const problems: string[] = [];

    // (1) Does the signed-in session resolve to a user at all?
    const { data: authData, error: authError } = await sessionA.auth.getUser();
    const sessionUserId = authData?.user?.id ?? null;
    console.log(`  auth.getUser() user id : ${sessionUserId ?? "(keine)"}`);
    console.log(`  erwartete candA.id     : ${candA.id}`);
    if (authError) {
      problems.push(`auth.getUser() meldete einen Fehler: ${authError.message}`);
    }
    if (!sessionUserId) {
      problems.push(
        "auth.getUser() liefert keine User-ID — die Session traegt kein gueltiges JWT, " +
          "daher ist auth.uid() in der Datenbank NULL."
      );
    }

    // (2) Is it the same user the service role provisioned?
    if (sessionUserId && sessionUserId !== candA.id) {
      problems.push(
        `Session-User-ID (${sessionUserId}) weicht von candA.id (${candA.id}) ab — ` +
          "die Anmeldung traf ein anderes Konto als das angelegte."
      );
    }

    // (3) What does the service role see in public.app_users for this user?
    const { data: appUserService, error: appUserServiceError } = await service
      .from("app_users")
      .select("id, role, account_status")
      .eq("id", candA.id)
      .maybeSingle();
    console.log(
      `  app_users (service role): ${
        appUserService
          ? `id=${appUserService.id} role=${appUserService.role} account_status=${appUserService.account_status}`
          : "(kein Datensatz)"
      }`
    );
    if (appUserServiceError) {
      problems.push(
        `Lesen von app_users per Service-Role schlug fehl: ${appUserServiceError.message}`
      );
    }
    if (!appUserService) {
      problems.push(
        `Kein app_users-Datensatz fuer candA.id (${candA.id}). Der Trigger ` +
          "handle_new_user() auf auth.users hat keine Zeile angelegt."
      );
    } else {
      if (appUserService.role !== "candidate") {
        problems.push(
          `app_users.role ist '${appUserService.role}', erwartet 'candidate'. ` +
            "own_candidate_id() verlangt die Rolle 'candidate'."
        );
      }
      if (appUserService.account_status !== "active") {
        problems.push(
          `app_users.account_status ist '${appUserService.account_status}', erwartet 'active'. ` +
            "own_candidate_id() liefert nur fuer aktive Konten eine ID — das ist die " +
            "wahrscheinlichste Ursache von 'Only active candidates may submit changes'. " +
            "Die Metadaten aus createUser({app_metadata}) sind offenbar nicht im " +
            "Trigger angekommen, sodass die Defaults ('candidate'/'invited') griffen."
        );
      }
    }

    // (4) What does the candidate see of their own app_users row through RLS?
    const { data: appUserRls, error: appUserRlsError } = await sessionA
      .from("app_users")
      .select("id, role, account_status")
      .eq("id", candA.id)
      .maybeSingle();
    console.log(
      `  app_users (per RLS)     : ${
        appUserRls
          ? `id=${appUserRls.id} role=${appUserRls.role} account_status=${appUserRls.account_status}`
          : "(kein Datensatz)"
      }`
    );
    if (appUserRlsError) {
      problems.push(
        `Kandidat kann eigenen app_users-Datensatz nicht lesen: ${appUserRlsError.message}`
      );
    }
    if (appUserService && !appUserRls) {
      problems.push(
        "Der app_users-Datensatz existiert, ist fuer den eingeloggten Kandidaten per RLS " +
          "aber nicht sichtbar — die Policy \"users read own account\" greift nicht, " +
          "was ebenfalls auf ein fehlendes auth.uid() hindeutet."
      );
    }

    // (5) Does the canonical candidate row link back to this auth user?
    const { data: candidateService, error: candidateServiceError } = await service
      .from("candidates")
      .select("id, candidate_code, user_id, status")
      .eq("user_id", candA.id)
      .maybeSingle();
    console.log(
      `  candidates (service role): ${
        candidateService
          ? `id=${candidateService.id} code=${candidateService.candidate_code} user_id=${candidateService.user_id}`
          : "(kein Datensatz)"
      }`
    );
    if (candidateServiceError) {
      problems.push(
        `Lesen von candidates per Service-Role schlug fehl: ${candidateServiceError.message}`
      );
    }
    if (!candidateService) {
      problems.push(
        `Kein candidates-Datensatz mit user_id = ${candA.id}. Die Verknuepfung ` +
          "zwischen Auth-Konto und kanonischem Kandidaten fehlt."
      );
    } else if (candidateService.id !== candidateA.id) {
      problems.push(
        `candidates.user_id verweist auf einen anderen Datensatz (${candidateService.id}) ` +
          `als den angelegten (${candidateA.id}).`
      );
    }

    // (6) Can the candidate read their own canonical row through RLS?
    const { data: candidateRls, error: candidateRlsError } = await sessionA
      .from("candidates")
      .select("id, candidate_code, german_level")
      .eq("id", candidateA.id)
      .maybeSingle();
    console.log(
      `  candidates (per RLS)    : ${
        candidateRls
          ? `id=${candidateRls.id} code=${candidateRls.candidate_code} german_level=${candidateRls.german_level}`
          : "(kein Datensatz)"
      }`
    );
    if (candidateRlsError) {
      problems.push(
        `Kandidat kann eigenen candidates-Datensatz nicht lesen: ${candidateRlsError.message}`
      );
    }
    if (candidateService && !candidateRls) {
      problems.push(
        "Der candidates-Datensatz existiert, ist per RLS aber nicht sichtbar — " +
          "own_candidate_id() liefert fuer diese Session NULL."
      );
    }

    // Direct probe: what does the database itself compute for this session?
    const { data: ownCandidateId, error: ownCandidateIdError } =
      await sessionA.rpc("own_candidate_id");
    console.log(
      `  own_candidate_id()      : ${ownCandidateId ?? "(NULL)"}${
        ownCandidateIdError ? ` [Fehler: ${ownCandidateIdError.message}]` : ""
      }`
    );
    if (!ownCandidateId) {
      problems.push(
        "own_candidate_id() liefert NULL — submit_candidate_changes() wird deshalb " +
          "'Only active candidates may submit changes' werfen. Die Ursache steht in " +
          "den Punkten darueber."
      );
    }

    if (problems.length > 0) {
      abort([
        "Die Identitaetskette von Candidate A ist unvollstaendig.",
        ...problems,
      ]);
    }
    console.log("  Identitaetskette vollstaendig — Workflow-Test startet.");

    // ------------------------------------------------------------------
    console.log("\n== 1. Candidate A proposes German B1 → B2 ==");
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
    if (!pendingItem) {
      abort([
        "Kein ausstehendes change item fuer Candidate A vorhanden.",
        submitError
          ? `submit_candidate_changes() meldete: ${submitError.message}`
          : "submit_candidate_changes() lief ohne Fehler, legte aber keine Zeile an.",
        "Ohne dieses Item koennen die Freigabe-Schritte nicht geprueft werden.",
      ]);
    }
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
    console.log("\n== 5b. Anonymous access (public marketplace preparation) ==");
    const anon = anonClient();
    const { data: anonProfiles } = await anon
      .from("candidate_profiles")
      .select("id, profile_status");
    check(
      (anonProfiles ?? []).length >= 1 &&
        (anonProfiles ?? []).every((p) => p.profile_status === "published"),
      "anon sees only published profiles"
    );
    const { data: anonCandidates } = await anon.from("candidates").select("id");
    check((anonCandidates ?? []).length === 0, "anon sees no candidate identities");
    const { data: anonDocs } = await anon
      .from("candidate_documents")
      .select("id");
    check((anonDocs ?? []).length === 0, "anon sees no documents");
    const { data: anonFile } = await anon.storage
      .from("candidate-documents")
      .download(certificatePath);
    check(!anonFile, "anon cannot download candidate files");

    // ------------------------------------------------------------------
    // Regression for the production invite path (src/lib/actions/admin.ts).
    // It creates the auth user with generateLink/inviteUserByEmail — whose
    // metadata lands in user_metadata — and then provisions app_users
    // explicitly with the service role. Before that fix an invited employer
    // silently became a 'candidate'.
    console.log("\n== 5c. Real invite path: employer provisioning ==");
    const inviteEmail = `wf-invite-emp-${run}@norav.local`;
    const { data: inviteData, error: inviteError } =
      await service.auth.admin.generateLink({
        type: "invite",
        email: inviteEmail,
        options: {
          data: {
            norav_role: "employer",
            norav_account_status: "invited",
            norav_locale: "de",
          },
        },
      });
    check(
      !inviteError && !!inviteData?.user,
      "invite created an auth user",
      inviteError?.message
    );
    const invitedEmployerId = inviteData?.user?.id;
    if (invitedEmployerId) {
      cleanupUserIds.push(invitedEmployerId);

      // What the trigger alone produced — informational, and the reason the
      // explicit provisioning step exists.
      const { data: beforeProvisioning } = await service
        .from("app_users")
        .select("role, account_status")
        .eq("id", invitedEmployerId)
        .maybeSingle();
      console.log(
        `  nach dem Invite, vor Provisioning: role=${beforeProvisioning?.role} ` +
          `account_status=${beforeProvisioning?.account_status}`
      );

      // Exactly what createEmployerAccountAction() now does.
      await provisionAccount(service, {
        userId: invitedEmployerId,
        email: inviteEmail,
        role: "employer",
        accountStatus: "invited",
        locale: "de",
      });

      const { data: afterProvisioning } = await service
        .from("app_users")
        .select("role, account_status, preferred_locale")
        .eq("id", invitedEmployerId)
        .maybeSingle();
      check(
        afterProvisioning?.role === "employer",
        "invited employer has role 'employer' (not 'candidate')",
        afterProvisioning
      );
      check(
        afterProvisioning?.account_status === "invited",
        "invited employer starts with account_status 'invited'",
        afterProvisioning
      );
      check(
        afterProvisioning?.preferred_locale === "de",
        "invited employer keeps the requested locale",
        afterProvisioning
      );
    }

    // No signed-in user may raise their own role or status.
    const { data: escalated } = await sessionE
      .from("app_users")
      .update({ role: "admin", account_status: "active" })
      .eq("id", employer.id)
      .select("id");
    const { data: employerRow } = await service
      .from("app_users")
      .select("role")
      .eq("id", employer.id)
      .maybeSingle();
    check(
      (escalated ?? []).length === 0 && employerRow?.role === "employer",
      "signed-in employer cannot raise their own role to admin",
      employerRow
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
