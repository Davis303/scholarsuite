import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <DashboardShell userEmail={user.email ?? null} isGuest={!!user.is_anonymous}>
      {children}
    </DashboardShell>
  );
}
