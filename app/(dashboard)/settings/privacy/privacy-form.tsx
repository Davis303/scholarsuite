"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export function RetentionForm({
  initialDays,
  initialAutoDelete,
}: {
  initialDays: number;
  initialAutoDelete: boolean;
}) {
  const { toast } = useToast();
  const [days, setDays] = useState(initialDays);
  const [autoDelete, setAutoDelete] = useState(initialAutoDelete);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!Number.isInteger(days) || days < 7 || days > 3650) {
      setError("Retention must be between 7 and 3650 days.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired. Please sign in again.");
      const { error: upsertError } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          retention_days: days,
          auto_delete: autoDelete,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (upsertError) throw new Error("We couldn't save your privacy settings. Please try again.");
      toast("Privacy settings saved.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-slate-900">Data retention</h2>
      <p className="mt-1 text-sm text-slate-600">
        Choose how long your documents are kept. With automatic deletion on, documents and
        writing drafts older than your retention period are permanently removed, files and
        records alike.
      </p>
      <form onSubmit={onSubmit} className="mt-4 max-w-md space-y-4">
        <Input
          label="Keep documents for (days)"
          type="number"
          min={7}
          max={3650}
          required
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          error={error ?? undefined}
        />
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={autoDelete}
            onChange={(event) => setAutoDelete(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          />
          <span className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Automatically delete expired documents</span>
            <br />
            A scheduled cleanup permanently removes documents older than your retention period.
          </span>
        </label>
        <Button type="submit" loading={saving}>
          Save settings
        </Button>
      </form>
    </Card>
  );
}

export function DeleteAccountSection() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "We couldn't delete your account. Please try again later.");
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      window.localStorage.removeItem("scholarsuite.remember");
      window.sessionStorage.removeItem("scholarsuite.ephemeral");
      router.push("/");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong. Please try again.", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-red-200 p-6">
      <h2 className="text-base font-semibold text-slate-900">Delete account</h2>
      <p className="mt-1 text-sm text-slate-600">
        Permanently delete your account, all documents, reviews, writing drafts, and stored files.
        This cannot be undone.
      </p>
      <Button variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
        Delete my account
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your account?"
        actions={
          <Button
            variant="destructive"
            loading={deleting}
            disabled={confirmText.trim().toLowerCase() !== "delete"}
            onClick={deleteAccount}
          >
            Delete everything
          </Button>
        }
      >
        <p>
          This permanently removes your account, documents, reviews, writing drafts, exports, and
          all stored files. Type <span className="font-semibold">DELETE</span> to confirm.
        </p>
        <div className="mt-4">
          <Input
            label="Confirmation"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="Type DELETE to confirm"
            autoComplete="off"
          />
        </div>
      </Modal>
    </Card>
  );
}
