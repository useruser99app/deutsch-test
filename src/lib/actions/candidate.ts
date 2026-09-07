"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { documentTypes, germanLevels, localeCodes } from "@/lib/domain";
import {
  certificateStatuses,
  fieldsFor,
  type CandidateFieldDef,
} from "@/lib/candidate-fields";
import { approvedValue, loadCandidateSnapshot } from "@/lib/candidate-data";

export interface CandidateFormState {
  status: "idle" | "success" | "error";
  /** Message key resolved against the i18n catalogs. */
  reason?: "empty" | "failed" | "unchanged";
  submittedCount?: number;
}

interface ProposedItem {
  field_key: string;
  proposed_value: unknown;
  source_language?: string | null;
}

function raw(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Parses one form value according to its field descriptor.
 * Returns null when the candidate left the field empty — the change
 * workflow stores proposed_value NOT NULL, so "empty" means "leave the
 * approved value as it is", never "clear it".
 */
function parseField(
  formData: FormData,
  field: CandidateFieldDef
): unknown | null {
  const value = raw(formData, field.key);
  if (value.length === 0) return null;

  switch (field.input) {
    case "list": {
      const items = value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      return items.length > 0 ? items : null;
    }
    case "number": {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    case "boolean":
      return value === "true" ? true : value === "false" ? false : null;
    case "german_level":
      return (germanLevels as readonly string[]).includes(value) ? value : null;
    case "certificate_status":
      return (certificateStatuses as readonly string[]).includes(value)
        ? value
        : null;
    default:
      return value;
  }
}

/** True when the proposal matches the approved value (nothing to submit). */
function isUnchanged(proposed: unknown, approved: unknown): boolean {
  if (approved === null || approved === undefined) return false;

  if (Array.isArray(proposed)) {
    if (!Array.isArray(approved)) return false;
    return (
      proposed.length === approved.length &&
      proposed.every((entry, index) => String(entry) === String(approved[index]))
    );
  }
  if (typeof proposed === "number") {
    return Number(approved) === proposed;
  }
  if (typeof proposed === "boolean") {
    return approved === proposed;
  }
  return String(approved) === String(proposed);
}

/**
 * Candidate change submission (§5/§6). Canonical tables are never written
 * here: every value goes into a pending change set through the
 * submit_candidate_changes() RPC and only becomes canonical after an admin
 * approves it.
 */
export async function submitChangesAction(
  _prev: CandidateFormState,
  formData: FormData
): Promise<CandidateFormState> {
  const locale = raw(formData, "locale");
  const { supabase, profile } = await requireRole(locale, "candidate");

  const snapshot = await loadCandidateSnapshot(supabase);
  if (!snapshot) return { status: "error", reason: "failed" };

  const sourceLanguageRaw = raw(formData, "source_language");
  const sourceLanguage = (localeCodes as readonly string[]).includes(
    sourceLanguageRaw
  )
    ? sourceLanguageRaw
    : profile.preferred_locale;

  const items: ProposedItem[] = [];
  let unchangedCount = 0;

  for (const field of fieldsFor(snapshot.candidate.candidate_type)) {
    const proposed = parseField(formData, field);
    if (proposed === null) continue;

    if (isUnchanged(proposed, approvedValue(snapshot, field.key))) {
      unchangedCount += 1;
      continue;
    }

    items.push({
      field_key: field.key,
      proposed_value: proposed,
      ...(field.freeText ? { source_language: sourceLanguage } : {}),
    });
  }

  if (items.length === 0) {
    return {
      status: "error",
      reason: unchangedCount > 0 ? "unchanged" : "empty",
    };
  }

  const { error } = await supabase.rpc("submit_candidate_changes", {
    p_items: items,
  });
  if (error) {
    return { status: "error", reason: "failed" };
  }

  revalidatePath(`/${locale}/candidate`);
  revalidatePath(`/${locale}/candidate/reviews`);
  return { status: "success", submittedCount: items.length };
}

/**
 * Candidate document upload (§7). The file goes to the private bucket under
 * <candidate_id>/…; the metadata row is created as pending_review. Both
 * writes run under the candidate's own RLS session.
 */
export async function uploadDocumentAction(
  _prev: CandidateFormState,
  formData: FormData
): Promise<CandidateFormState> {
  const locale = raw(formData, "locale");
  const { supabase, user } = await requireRole(locale, "candidate");

  const documentTypeRaw = raw(formData, "document_type");
  const documentType = (documentTypes as readonly string[]).includes(
    documentTypeRaw
  )
    ? documentTypeRaw
    : "other";

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", reason: "empty" };
  }

  const { data: candidate } = await supabase
    .from("candidates")
    .select("id")
    .maybeSingle();
  if (!candidate) return { status: "error", reason: "failed" };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const filePath = `${candidate.id}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("candidate-documents")
    .upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
    });
  if (uploadError) return { status: "error", reason: "failed" };

  const { error: insertError } = await supabase
    .from("candidate_documents")
    .insert({
      candidate_id: candidate.id,
      document_type: documentType,
      file_path: filePath,
      original_filename: file.name,
      mime_type: file.type || "application/octet-stream",
      file_size_bytes: file.size,
      verification_status: "pending_review",
      uploaded_by: user.id,
    });
  if (insertError) {
    await supabase.storage.from("candidate-documents").remove([filePath]);
    return { status: "error", reason: "failed" };
  }

  revalidatePath(`/${locale}/candidate`);
  revalidatePath(`/${locale}/candidate/documents`);
  return { status: "success", submittedCount: 1 };
}
