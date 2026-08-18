import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Serves a private candidate document via a short-lived signed URL.
 * Authorization is enforced by RLS: only the owning candidate or an active
 * admin can read the document row and the storage object. No permanent
 * public URLs are ever exposed (§7).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return new NextResponse("Missing id", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: document } = await supabase
    .from("candidate_documents")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (!document) return new NextResponse("Not found", { status: 404 });

  const { data: signed, error } = await supabase.storage
    .from("candidate-documents")
    .createSignedUrl(document.file_path, 60);
  if (error || !signed?.signedUrl) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
