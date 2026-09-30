"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export function ProfileForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string | null;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired. Please sign in again.");
      const { error } = await supabase.from("profiles").upsert(
        { id: user.id, email: user.email, full_name: name.trim(), updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
      if (error) throw new Error("We couldn't save your profile. Please try again.");
      toast("Profile updated.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-slate-900">Profile</h2>
      <form onSubmit={onSubmit} className="mt-4 max-w-md space-y-4">
        <Input label="Email address" type="email" value={email ?? ""} disabled hint="Email changes are handled through account conversion below." />
        <Input
          label="Full name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      </form>
    </Card>
  );
}

export function GuestUpgradeForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      // Converting a guest keeps the same user id, so all existing rows
      // (documents, reviews, writing docs) stay attached to the new account.
      const { error } = await supabase.auth.updateUser({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setSent(true);
      toast("Verification email sent. Confirm it to finish upgrading your account.", "success");
      router.refresh();
    } catch (err) {
      toast(
        err instanceof Error
          ? "We couldn't upgrade your account. Please check the details and try again."
          : "Something went wrong. Please try again.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  if (sent) {
    return (
      <Card className="border-brand-200 bg-brand-50 p-6">
        <h2 className="text-base font-semibold text-slate-900">Almost done</h2>
        <p className="mt-2 text-sm text-slate-700">
          We sent a confirmation link to <span className="font-medium">{email.trim()}</span>. Click
          it to finish creating your account — your guest work will be preserved.
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-brand-200 bg-brand-50 p-6">
      <h2 className="text-base font-semibold text-slate-900">Keep your work — create a free account</h2>
      <p className="mt-1 text-sm text-slate-600">
        You&apos;re browsing as a guest. Add an email and password to keep everything you&apos;ve
        created; nothing will be lost.
      </p>
      <form onSubmit={onSubmit} className="mt-4 max-w-md space-y-4">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" loading={saving}>
          Create account and keep my work
        </Button>
      </form>
    </Card>
  );
}
