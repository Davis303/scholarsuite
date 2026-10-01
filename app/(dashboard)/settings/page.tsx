import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Manage your preferences and privacy." />

      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-900">Privacy & data</h2>
          <p className="mt-1 text-sm text-slate-600">
            Control how long your documents are kept, automatic cleanup, and deleting your workspace data.
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
