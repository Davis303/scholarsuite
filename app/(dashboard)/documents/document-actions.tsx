"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { LibraryDocument } from "./page";

const STORAGE_BUCKETS = ["documents", "reports", "exports"];

async function removeStorageObjects(storagePath: string): Promise<void> {
  const supabase = createClient();
  for (const bucket of STORAGE_BUCKETS) {
    const { error } = await supabase.storage.from(bucket).remove([storagePath]);
    if (error && !error.message.toLowerCase().includes("not found")) {
      throw new Error(`We couldn't remove the stored file from ${bucket}.`);
    }
  }
}

export function DocumentActions({ doc }: { doc: LibraryDocument }) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bridging, setBridging] = useState(false);

  const openInWritingAssistant = async () => {
    setBridging(true);
    try {
      const response = await fetch("/api/writing/from-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });
      const data = (await response.json()) as { writingDocId?: string; error?: string };
      if (!response.ok || !data.writingDocId) {
        throw new Error(data.error || "We couldn't open this document in the Writing Assistant.");
      }
      router.push(`/writing/${data.writingDocId}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong. Please try again.", "error");
    } finally {
      setBridging(false);
    }
  };

  const deleteDocument = async () => {
    setDeleting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired. Please refresh the page and try again.");

      await removeStorageObjects(doc.storage_path);

      if (doc.source === "documents") {
        const { error } = await supabase.from("documents").delete().eq("id", doc.id);
        if (error) throw new Error("We couldn't delete this document. Please try again.");
      } else {
        const { error } = await supabase.from("writing_docs").delete().eq("id", doc.id);
        if (error) throw new Error("We couldn't delete this document. Please try again.");
      }

      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "delete_document",
        entity_type: doc.source,
        entity_id: doc.id,
        meta: { name: doc.name, kind: doc.kind },
      });

      toast("Document deleted.", "success");
      setConfirmDelete(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong. Please try again.", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {doc.kind === "original" && doc.source === "documents" ? (
        <>
          <Link
            href={`/reviews/new?documentId=${doc.id}`}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-accent-700 hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          >
            Open review
          </Link>
          <Button variant="tertiary" size="sm" loading={bridging} onClick={openInWritingAssistant}>
            Open in Writing Assistant
          </Button>
        </>
      ) : null}
      {doc.kind === "writing" ? (
        doc.source === "writing_docs" ? (
          <Link
            href={`/writing/${doc.id}`}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-accent-700 hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          >
            Open in Writing Assistant
          </Link>
        ) : (
          <Button variant="tertiary" size="sm" loading={bridging} onClick={openInWritingAssistant}>
            Open in Writing Assistant
          </Button>
        )
      ) : null}
      {doc.kind === "similarity_report" ? (
        <Link
          href="/reviews"
          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-accent-700 hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
        >
          My Reviews
        </Link>
      ) : null}
      <Button variant="tertiary" size="sm" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${doc.name}`}>
        <span className="text-red-600">Delete</span>
      </Button>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete document"
        actions={
          <Button variant="destructive" loading={deleting} onClick={deleteDocument}>
            Delete permanently
          </Button>
        }
      >
        <p>
          Are you sure you want to permanently delete{" "}
          <span className="font-medium text-slate-900">{doc.name}</span>? The stored file will be
          removed and this cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
