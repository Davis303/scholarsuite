import { createServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EnsureSession } from "@/components/auth/EnsureSession";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No accounts: first-time visitors get a free anonymous session started
  // automatically, then the page reloads with their workspace ready.
  if (!user) {
    return <EnsureSession />;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
