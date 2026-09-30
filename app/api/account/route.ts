import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

const STORAGE_BUCKETS = ["documents", "reports", "exports"];

/**
 * Permanently deletes the signed-in user's account, all of their stored files,
 * and (via ON DELETE CASCADE) all of their database rows.
 */
export async function DELETE() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in to delete your account." }, { status: 401 });
  }

  try {
    const service = createServiceClient();

    for (const bucket of STORAGE_BUCKETS) {
      const { data: files } = await service.storage.from(bucket).list(user.id);
      if (files && files.length > 0) {
        const paths = files.map((file) => `${user.id}/${file.name}`);
        const { error } = await service.storage.from(bucket).remove(paths);
        if (error) {
          throw new Error("storage cleanup failed");
        }
      }
    }

    await service.from("audit_logs").insert({
      user_id: user.id,
      action: "delete_account",
      entity_type: "user",
      entity_id: user.id,
      meta: {},
    });

    const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
    if (deleteError) {
      throw new Error("account deletion failed");
    }

    return NextResponse.json({ ok: true });
  } catch {
    // Never expose internals; the client shows a human-readable message.
    return NextResponse.json(
      { error: "We couldn't delete your account. Please try again later." },
      { status: 500 }
    );
  }
}
