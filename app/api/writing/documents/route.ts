import { NextRequest, NextResponse } from "next/server";
import {
  auditLog,
  createServiceClient,
  requireUser,
  storagePath,
} from "@/lib/writing/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK..

function matchesMagic(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((b, i) => bytes[i] === b);
}

function detectKind(
  bytes: Uint8Array,
  mimeType: string
): { ok: boolean; mime: string } {
  if (matchesMagic(bytes, PDF_MAGIC)) {
    return { ok: true, mime: "application/pdf" };
  }
  if (matchesMagic(bytes, ZIP_MAGIC)) {
    // A zip could be many things; require the DOCX mime from the client too,
    // or a .docx extension as a secondary signal.
    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return { ok: true, mime: mimeType };
    }
    return { ok: false, mime: "" };
  }
  return { ok: false, mime: "" };
}

function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB ?? "25");
  return (Number.isFinite(mb) && mb > 0 ? mb : 25) * 1024 * 1024;
}

/**
 * POST /api/writing/documents — upload a PDF or DOCX of the user's own
 * academic writing. Magic-byte validated; stored privately; creates a
 * writing_docs row with status 'uploaded'.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not read the uploaded file." },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }
  const maxBytes = maxUploadBytes();
  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        error: `The file is too large. Maximum size is ${Math.round(maxBytes / 1024 / 1024)} MB.`,
      },
      { status: 400 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectKind(bytes, file.type);
  if (!detected.ok) {
    return NextResponse.json(
      {
        error:
          "Only PDF and Word (.docx) documents are supported. The file contents did not match its type.",
      },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const path = storagePath(user.id, id, file.name || "document");

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const { error: uploadError } = await service.storage
    .from("documents")
    .upload(path, Buffer.from(bytes), {
      contentType: detected.mime,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json(
      { error: "The file could not be stored. Try again." },
      { status: 500 }
    );
  }

  const { data: doc, error: insertError } = await supabase
    .from("writing_docs")
    .insert({
      id,
      user_id: user.id,
      name: file.name || "Untitled document",
      mime_type: detected.mime,
      size_bytes: file.size,
      storage_path: path,
      status: "uploaded",
    })
    .select("id, name, mime_type, size_bytes, status, created_at")
    .single();

  if (insertError || !doc) {
    await service.storage.from("documents").remove([path]);
    return NextResponse.json(
      { error: "The document record could not be created. Try again." },
      { status: 500 }
    );
  }

  await auditLog(supabase, user.id, "writing_document.upload", "writing_doc", id, {
    name: file.name,
    size_bytes: file.size,
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}

const LIST_STATUSES = new Set([
  "uploaded",
  "analyzing",
  "processing",
  "review_ready",
  "completed",
  "error",
]);

/**
 * GET /api/writing/documents?search=&status= — list the user's writing docs
 * with derived stats (pages, sections processed, edits made).
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") ?? "").trim();
  const status = (searchParams.get("status") ?? "").trim();

  let query = supabase
    .from("writing_docs")
    .select(
      "id, name, mime_type, size_bytes, status, style_profile, created_at, updated_at"
    )
    .order("updated_at", { ascending: false });

  if (search) {
    query = query.ilike("name", `%${search.replace(/[%_]/g, "")}%`);
  }
  if (status && LIST_STATUSES.has(status)) {
    query = query.eq("status", status);
  }

  const { data: docs, error } = await query;
  if (error || !docs) {
    return NextResponse.json(
      { error: "Could not load your documents." },
      { status: 500 }
    );
  }

  const ids = docs.map((d) => d.id as string);
  let revisionsByDoc = new Map<string, { sections: Set<string>; edits: number }>();
  if (ids.length > 0) {
    const { data: revs } = await supabase
      .from("writing_revisions")
      .select("writing_doc_id, section_ref, status")
      .in("writing_doc_id", ids);
    revisionsByDoc = new Map();
    for (const r of revs ?? []) {
      const key = r.writing_doc_id as string;
      const entry = revisionsByDoc.get(key) ?? {
        sections: new Set<string>(),
        edits: 0,
      };
      if (r.section_ref) entry.sections.add(r.section_ref as string);
      if (r.status === "accepted" || r.status === "edited") entry.edits += 1;
      revisionsByDoc.set(key, entry);
    }
  }

  const documents = docs.map((d) => {
    const profile = (d.style_profile ?? {}) as {
      displayRows?: unknown;
      profile?: { technicalTerms?: unknown };
      pageCount?: number;
      sectionCount?: number;
    };
    const stats = revisionsByDoc.get(d.id as string);
    return {
      id: d.id,
      name: d.name,
      mimeType: d.mime_type,
      sizeBytes: d.size_bytes,
      status: d.status,
      hasProfile: Boolean(profile?.displayRows),
      pages: profile?.pageCount ?? null,
      sectionsProcessed: stats?.sections.size ?? 0,
      editsMade: stats?.edits ?? 0,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    };
  });

  return NextResponse.json({ documents });
}
