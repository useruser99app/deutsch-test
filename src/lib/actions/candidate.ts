"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { documentTypes, germanLevels, localeCodes } from "@/lib/domain";

interface ProposedItem {
  field_key: string;
  proposed_value: unknown;
  source_language?: string | null;
}

function textOrNull(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function listOrNull(formData: FormData, key: string): string[] | null {
  const raw = textOrNull(formData, key);
  if (!raw) return null;
  const items = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return items.length > 0 ? items : null;
}

/**
 * Candidate change submission (§5/§6). Builds a change set via the
 * SECURITY DEFINER RPC — the canonical data is never written here.
 */
export async function submitChanges(formData: FormData) {
  const locale = String(formData.get("locale") ?? "de");
  const { supabase, profile } = await requireRole(locale, "candidate");

  const sourceLanguageRaw = String(formData.get("source_language") ?? "");
  const sourceLanguage = (
    localeCodes as readonly string[]
  ).includes(sourceLanguageRaw)
    ? sourceLanguageRaw
    : profile.preferred_locale;

  const items: ProposedItem[] = [];

  const germanLevel = textOrNull(formData, "german_level");
  if (germanLevel && (germanLevels as readonly string[]).includes(germanLevel)) {
    items.push({ field_key: "german_level", proposed_value: germanLevel });
  }

  const availability = textOrNull(formData, "availability_date");
  if (availability) {
    items.push({ field_key: "availability_date", proposed_value: availability });
  }

  const phone = textOrNull(formData, "phone");
  if (phone) {
    items.push({ field_key: "phone", proposed_value: phone });
  }

  const preferredLocations = listOrNull(formData, "preferred_locations");
  if (preferredLocations) {
    items.push({
      field_key: "preferred_locations",
      proposed_value: preferredLocations,
    });
  }

  const targetOccupations = listOrNull(formData, "target_occupations");
  if (targetOccupations) {
    items.push({
      field_key: "target_occupations",
      proposed_value: targetOccupations,
    });
  }

  const motivation = textOrNull(formData, "motivation_summary");
  if (motivation) {
    items.push({
      field_key: "motivation_summary",
      proposed_value: motivation,
      source_language: sourceLanguage,
    });
  }

  if (items.length === 0) {
    redirect(`/${locale}/candidate/changes?error=empty`);
  }

  const { error } = await supabase.rpc("submit_candidate_changes", {
    p_items: items,
  });
  if (error) {
    redirect(`/${locale}/candidate/changes?error=failed`);
  }
  redirect(`/${locale}/candidate?submitted=1`);
}

/**
 * Candidate document upload (§7): file goes to the private bucket under
 * <candidate_id>/…, metadata row starts as pending_review. Both writes are
 * governed by RLS of the candidate's own session.
 */
export async function uploadDocument(formData: FormData) {
  const locale = String(formData.get("locale") ?? "de");
  const { supabase, user } = await requireRole(locale, "candidate");

  const documentTypeRaw = String(formData.get("document_type") ?? "");
  const documentType = (documentTypes as readonly string[]).includes(
    documentTypeRaw
  )
    ? documentTypeRaw
    : "other";

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/${locale}/candidate/documents?error=failed`);
  }

  const { data: candidate } = await supabase
    .from("candidates")
    .select("id")
    .maybeSingle();
  if (!candidate) {
    redirect(`/${locale}/candidate/documents?error=failed`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const filePath = `${candidate.id}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("candidate-documents")
    .upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
    });
  if (uploadError) {
    redirect(`/${locale}/candidate/documents?error=failed`);
  }

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
    redirect(`/${locale}/candidate/documents?error=failed`);
  }

  redirect(`/${locale}/candidate/documents?ok=1`);
}
