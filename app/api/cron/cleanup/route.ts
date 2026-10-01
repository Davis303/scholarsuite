import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const STORAGE_BUCKETS = ["documents", "reports", "exports"];
const SETTINGS_PAGE_SIZE = 100;
const GUEST_INACTIVITY_DAYS = 30;
const GUEST_PROCESS_CAP = 200;

interface ExpiredRow {
  id: string;
  storage_path: string;
}

/**
 * Scheduled cleanup (Vercel Cron). Guarded by a bearer token, CRON_SECRET is
 * never exposed to the client. Deletes:
 *  1. Documents and writing drafts older than each user's retention period
 *     (only for users who enabled automatic deletion), including stored files.
 *  2. Expired guest accounts (anonymous users inactive for 30+ days) and
 *     their stored files; row data is removed via ON DELETE CASCADE.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    let documentsDeleted = 0;
    let writingDocsDeleted = 0;
    let guestsDeleted = 0;

    // 1. Retention-based cleanup for users with auto_delete enabled.
    let page = 0;
    for (;;) {
      const { data: settings, error } = await supabase
        .from("user_settings")
        .select("user_id, retention_days")
        .eq("auto_delete", true)
        .range(page * SETTINGS_PAGE_SIZE, (page + 1) * SETTINGS_PAGE_SIZE - 1);
      if (error) throw new Error("settings query failed");
      if (!settings || settings.length === 0) break;

      for (const row of settings as Array<{ user_id: string; retention_days: number }>) {
        const cutoff = new Date(
          Date.now() - row.retention_days * 24 * 60 * 60 * 1000
        ).toISOString();

        const { data: docs, error: docsError } = await supabase
          .from("documents")
          .select("id, storage_path")
          .eq("user_id", row.user_id)
          .lt("created_at", cutoff);
        if (docsError) throw new Error("documents query failed");

        for (const doc of (docs ?? []) as ExpiredRow[]) {
          await removeFromAllBuckets(supabase, doc.storage_path);
          const { error: deleteError } = await supabase
            .from("documents")
            .delete()
            .eq("id", doc.id);
          if (deleteError) throw new Error("document delete failed");
          documentsDeleted += 1;
        }

        const { data: writingDocs, error: writingError } = await supabase
          .from("writing_docs")
          .select("id, storage_path")
          .eq("user_id", row.user_id)
          .lt("created_at", cutoff);
        if (writingError) throw new Error("writing docs query failed");

        for (const doc of (writingDocs ?? []) as ExpiredRow[]) {
          await removeFromAllBuckets(supabase, doc.storage_path);
          const { error: deleteError } = await supabase
            .from("writing_docs")
            .delete()
            .eq("id", doc.id);
          if (deleteError) throw new Error("writing doc delete failed");
          writingDocsDeleted += 1;
        }

        if (docs?.length || writingDocs?.length) {
          await supabase.from("audit_logs").insert({
            user_id: row.user_id,
            action: "auto_delete",
            entity_type: "retention_cleanup",
            entity_id: null,
            meta: {
              documents_deleted: docs?.length ?? 0,
              writing_docs_deleted: writingDocs?.length ?? 0,
              retention_days: row.retention_days,
            },
          });
        }
      }

      if (settings.length < SETTINGS_PAGE_SIZE) break;
      page += 1;
    }

    // 2. Expired guest cleanup.
    const guestCutoff = Date.now() - GUEST_INACTIVITY_DAYS * 24 * 60 * 60 * 1000;
    let guestPage = 1;
    const expiredGuests: string[] = [];
    for (;;) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page: guestPage,
        perPage: 100,
      });
      if (error) throw new Error("user listing failed");
      const users = data.users;
      for (const user of users) {
        const lastActive = user.last_sign_in_at ?? user.created_at;
        if (user.is_anonymous && new Date(lastActive).getTime() < guestCutoff) {
          expiredGuests.push(user.id);
          if (expiredGuests.length >= GUEST_PROCESS_CAP) break;
        }
      }
      if (users.length < 100 || expiredGuests.length >= GUEST_PROCESS_CAP) break;
      guestPage += 1;
    }

    for (const userId of expiredGuests) {
      for (const bucket of STORAGE_BUCKETS) {
        const { data: files } = await supabase.storage.from(bucket).list(userId);
        if (files && files.length > 0) {
          await supabase.storage
            .from(bucket)
            .remove(files.map((file) => `${userId}/${file.name}`));
        }
      }
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw new Error("guest delete failed");
      guestsDeleted += 1;
    }

    return NextResponse.json({
      ok: true,
      documents_deleted: documentsDeleted,
      writing_docs_deleted: writingDocsDeleted,
      guests_deleted: guestsDeleted,
    });
  } catch {
    // Never expose internals on error.
    return NextResponse.json(
      { error: "Cleanup failed. Please try again later." },
      { status: 500 }
    );
  }
}

async function removeFromAllBuckets(
  supabase: ReturnType<typeof createServiceClient>,
  storagePath: string
): Promise<void> {
  for (const bucket of STORAGE_BUCKETS) {
    // Missing objects are fine, the path may live in a different bucket.
    await supabase.storage.from(bucket).remove([storagePath]);
  }
}
