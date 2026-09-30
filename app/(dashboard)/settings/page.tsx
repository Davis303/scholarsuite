import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileForm, GuestUpgradeForm } from "./account-forms";

export default async function SettingsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const fullName =
    (profile as { full_name: string | null } | null)?.full_name ??
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "");

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Manage your account, sessions, and privacy." />

      <div className="space-y-6">
        {user.is_anonymous ? <GuestUpgradeForm /> : null}

        <ProfileForm initialName={fullName} email={user.email ?? null} />

        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-900">Sessions & devices</h2>
          <p className="mt-1 text-sm text-slate-600">
            See where you&apos;re signed in and sign out of devices you don&apos;t recognize.
          </p>
          <Link
            href="/settings/sessions"
            className="mt-3 inline-block text-sm font-medium text-accent-700 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          >
            Manage active sessions →
          </Link>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-900">Privacy & data</h2>
          <p className="mt-1 text-sm text-slate-600">
            Control how long your documents are kept, automatic cleanup, and account deletion.
          </p>
          <Link
            href="/settings/privacy"
            className="mt-3 inline-block text-sm font-medium text-accent-700 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
          >
            Open privacy settings →
          </Link>
        </Card>
      </div>
    </div>
  );
}
