import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { RetentionForm, DeleteAccountSection } from "./privacy-form";

export default async function PrivacySettingsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("retention_days, auto_delete")
    .eq("user_id", user.id)
    .maybeSingle();

  const typed = settings as { retention_days: number; auto_delete: boolean } | null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Privacy & data"
        description="Control how long your work is kept and delete your account."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Privacy & data" }]}
      />
      <div className="space-y-6">
        <RetentionForm
          initialDays={typed?.retention_days ?? 90}
          initialAutoDelete={typed?.auto_delete ?? false}
        />
        <DeleteAccountSection />
      </div>
    </div>
  );
}
