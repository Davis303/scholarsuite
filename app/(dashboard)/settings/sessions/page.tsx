import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { SessionsClient } from "./sessions-client";

export default async function SessionsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Active sessions"
        description="Review where you're signed in and revoke access you don't recognize."
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Active sessions" },
        ]}
      />
      <SessionsClient />
    </div>
  );
}
